import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

const DB_NAME = "control_aguas";
const DB_VERSION = 1;
const OWNER_COLUMN = "owner_username";

let sqlite = null;
let db = null;
let schemaReady = false;

export function isNative() {
  return Capacitor.isNativePlatform();
}

function normalizeOwnerUsername(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

async function getDb() {
  if (!isNative()) return null;

  if (!sqlite) {
    sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  if (!db) {
    await sqlite.checkConnectionsConsistency();
    const isConn = await sqlite.isConnection(DB_NAME, false);
    if (isConn.result) {
      db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      db = await sqlite.createConnection(DB_NAME, false, "no-encryption", DB_VERSION, false);
    }
    await db.open();
  }

  return db;
}

async function ensureColumn(database, table, column, type) {
  const info = await database.query(`PRAGMA table_info(${table})`);
  const exists = (info.values || []).some((row) => row.name === column);
  if (!exists) {
    await database.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

async function backfillRegistroOwners(database) {
  const result = await database.query(
    `SELECT id, payload FROM registros WHERE ${OWNER_COLUMN} IS NULL OR ${OWNER_COLUMN} = ''`
  );

  for (const row of result.values || []) {
    let owner = null;
    try {
      const payload = JSON.parse(row.payload);
      owner = normalizeOwnerUsername(payload?.encargado);
    } catch (err) {
      owner = null;
    }

    if (owner) {
      await database.run(`UPDATE registros SET ${OWNER_COLUMN} = ? WHERE id = ?`, [
        owner,
        row.id,
      ]);
    }
  }
}

async function backfillQueueOwners(database) {
  const result = await database.query(
    `SELECT id, client_ref, remote_id FROM sync_queue WHERE ${OWNER_COLUMN} IS NULL OR ${OWNER_COLUMN} = ''`
  );

  for (const row of result.values || []) {
    let owner = null;

    if (row.client_ref) {
      const match = await database.query(
        `SELECT ${OWNER_COLUMN} FROM registros WHERE client_ref = ?`,
        [row.client_ref]
      );
      owner = normalizeOwnerUsername(match.values?.[0]?.[OWNER_COLUMN]);
    }

    if (!owner && row.remote_id !== null && row.remote_id !== undefined) {
      const match = await database.query(
        `SELECT ${OWNER_COLUMN} FROM registros WHERE remote_id = ?`,
        [row.remote_id]
      );
      owner = normalizeOwnerUsername(match.values?.[0]?.[OWNER_COLUMN]);
    }

    if (owner) {
      await database.run(`UPDATE sync_queue SET ${OWNER_COLUMN} = ? WHERE id = ?`, [
        owner,
        row.id,
      ]);
    }
  }
}

async function ensureSchema(database) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_id INTEGER UNIQUE,
      client_ref TEXT UNIQUE,
      ${OWNER_COLUMN} TEXT,
      payload TEXT NOT NULL,
      sync_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      op TEXT NOT NULL,
      client_ref TEXT,
      remote_id INTEGER,
      ${OWNER_COLUMN} TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await ensureColumn(database, "registros", OWNER_COLUMN, "TEXT");
  await ensureColumn(database, "sync_queue", OWNER_COLUMN, "TEXT");
  await backfillRegistroOwners(database);
  await backfillQueueOwners(database);
}

async function ensureDb() {
  const database = await getDb();
  if (!database) return null;
  if (!schemaReady) {
    await ensureSchema(database);
    schemaReady = true;
  }
  return database;
}

export async function initDb() {
  const database = await ensureDb();
  return Boolean(database);
}

export async function listLocalRegistros(options = {}) {
  const database = await ensureDb();
  if (!database) return [];

  const ownerFilter = normalizeOwnerUsername(options.ownerUsername);
  const params = [];
  let query =
    "SELECT id, remote_id, client_ref, payload, sync_status, owner_username FROM registros";

  if (ownerFilter) {
    query += " WHERE owner_username = ? OR owner_username IS NULL OR owner_username = ''";
    params.push(ownerFilter);
  }

  query += " ORDER BY id DESC";
  const result = await database.query(query, params);

  const mapped = (result.values || []).map((row) => {
    const payload = JSON.parse(row.payload);
    const recordId = row.remote_id ?? row.client_ref ?? row.id;
    const rowOwner = normalizeOwnerUsername(row.owner_username);
    const payloadOwner = normalizeOwnerUsername(payload?.encargado);
    const resolvedOwner = rowOwner || payloadOwner || null;
    return {
      ...payload,
      id: recordId,
      _localId: row.id,
      _remoteId: row.remote_id ?? null,
      _clientRef: row.client_ref ?? null,
      _syncStatus: row.sync_status,
      _ownerUsername: resolvedOwner,
    };
  });

  if (!ownerFilter) return mapped;
  return mapped.filter((row) => row._ownerUsername === ownerFilter);
}

export async function saveLocalRegistro(payload, options = {}) {
  const database = await ensureDb();
  if (!database) return null;

  const { remoteId = null, clientRef = null, syncStatus = "pending", ownerUsername = null } =
    options;
  const now = new Date().toISOString();
  const data = JSON.stringify(payload);
  const owner = normalizeOwnerUsername(ownerUsername ?? payload?.encargado);

  if (remoteId !== null && remoteId !== undefined) {
    const existing = await database.query("SELECT id FROM registros WHERE remote_id = ?", [
      remoteId,
    ]);
    if (existing.values?.length) {
      await database.run(
        `UPDATE registros SET payload = ?, sync_status = ?, updated_at = ?, ${OWNER_COLUMN} = COALESCE(?, ${OWNER_COLUMN}) WHERE remote_id = ?`,
        [data, syncStatus, now, owner, remoteId]
      );
      return { remoteId };
    }
  }

  if (clientRef) {
    const existing = await database.query("SELECT id FROM registros WHERE client_ref = ?", [
      clientRef,
    ]);
    if (existing.values?.length) {
      await database.run(
        `UPDATE registros SET payload = ?, sync_status = ?, updated_at = ?, ${OWNER_COLUMN} = COALESCE(?, ${OWNER_COLUMN}) WHERE client_ref = ?`,
        [data, syncStatus, now, owner, clientRef]
      );
      return { clientRef };
    }
  }

  await database.run(
    `INSERT INTO registros (remote_id, client_ref, ${OWNER_COLUMN}, payload, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [remoteId, clientRef, owner, data, syncStatus, now, now]
  );

  return { remoteId, clientRef };
}

export async function updateLocalByClientRef(
  clientRef,
  payload,
  syncStatus = "pending",
  ownerUsername = null
) {
  const database = await ensureDb();
  if (!database) return;
  const now = new Date().toISOString();
  const owner = normalizeOwnerUsername(ownerUsername ?? payload?.encargado);
  await database.run(
    `UPDATE registros SET payload = ?, sync_status = ?, updated_at = ?, ${OWNER_COLUMN} = COALESCE(?, ${OWNER_COLUMN}) WHERE client_ref = ?`,
    [JSON.stringify(payload), syncStatus, now, owner, clientRef]
  );
}

export async function updateLocalByRemoteId(
  remoteId,
  payload,
  syncStatus = "synced",
  ownerUsername = null
) {
  const database = await ensureDb();
  if (!database) return;
  const now = new Date().toISOString();
  const owner = normalizeOwnerUsername(ownerUsername ?? payload?.encargado);
  await database.run(
    `UPDATE registros SET payload = ?, sync_status = ?, updated_at = ?, ${OWNER_COLUMN} = COALESCE(?, ${OWNER_COLUMN}) WHERE remote_id = ?`,
    [JSON.stringify(payload), syncStatus, now, owner, remoteId]
  );
}

export async function setRemoteIdForClientRef(clientRef, remoteId, ownerUsername = null) {
  const database = await ensureDb();
  if (!database) return;
  const now = new Date().toISOString();
  const owner = normalizeOwnerUsername(ownerUsername);
  await database.run(
    `UPDATE registros SET remote_id = ?, sync_status = ?, updated_at = ?, ${OWNER_COLUMN} = COALESCE(?, ${OWNER_COLUMN}) WHERE client_ref = ?`,
    [remoteId, "synced", now, owner, clientRef]
  );
}

export async function getPendingCreates(options = {}) {
  const database = await ensureDb();
  if (!database) return [];

  const ownerFilter = normalizeOwnerUsername(options.ownerUsername);
  const params = [];
  let query =
    "SELECT client_ref, payload, owner_username FROM registros WHERE sync_status = 'pending' AND remote_id IS NULL";

  if (ownerFilter) {
    query += " AND (owner_username = ? OR owner_username IS NULL OR owner_username = '')";
    params.push(ownerFilter);
  }

  const result = await database.query(query, params);
  const pending = (result.values || []).map((row) => {
    const payload = JSON.parse(row.payload);
    const rowOwner = normalizeOwnerUsername(row.owner_username);
    const payloadOwner = normalizeOwnerUsername(payload?.encargado);
    const resolvedOwner = rowOwner || payloadOwner || null;
    return {
      client_ref: row.client_ref,
      payload,
      _owner: resolvedOwner,
    };
  });

  if (!ownerFilter) {
    return pending.map(({ client_ref, payload }) => ({ client_ref, payload }));
  }

  return pending
    .filter((row) => row._owner === ownerFilter)
    .map(({ client_ref, payload }) => ({ client_ref, payload }));
}

export async function queueUpdate(recordRef, remoteId, payload, ownerUsername = null) {
  const database = await ensureDb();
  if (!database) return;
  const now = new Date().toISOString();
  const owner = normalizeOwnerUsername(ownerUsername ?? payload?.encargado);
  await database.run(
    `INSERT INTO sync_queue (op, client_ref, remote_id, ${OWNER_COLUMN}, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ["update", recordRef, remoteId, owner, JSON.stringify(payload), now]
  );
}

export async function getPendingUpdates(options = {}) {
  const database = await ensureDb();
  if (!database) return [];

  const ownerFilter = normalizeOwnerUsername(options.ownerUsername);
  const params = [];
  let query = `
    SELECT q.id, q.client_ref, q.remote_id, q.payload,
           q.${OWNER_COLUMN} AS queue_owner,
           r.${OWNER_COLUMN} AS record_owner
    FROM sync_queue q
    LEFT JOIN registros r
      ON (q.client_ref IS NOT NULL AND r.client_ref = q.client_ref)
      OR (q.remote_id IS NOT NULL AND r.remote_id = q.remote_id)
    WHERE q.op = 'update'
  `;

  if (ownerFilter) {
    query += ` AND (q.${OWNER_COLUMN} = ? OR ((q.${OWNER_COLUMN} IS NULL OR q.${OWNER_COLUMN} = '') AND r.${OWNER_COLUMN} = ?))`;
    params.push(ownerFilter, ownerFilter);
  }

  query += " ORDER BY q.id ASC";
  const result = await database.query(query, params);

  return (result.values || []).map((row) => ({
    id: row.id,
    client_ref: row.client_ref,
    remote_id: row.remote_id,
    payload: JSON.parse(row.payload),
  }));
}

export async function markUpdateDone(queueId) {
  const database = await ensureDb();
  if (!database) return;
  await database.run("DELETE FROM sync_queue WHERE id = ?", [queueId]);
}

export async function getMeta(key) {
  const database = await ensureDb();
  if (!database) return null;
  const result = await database.query("SELECT value FROM meta WHERE key = ?", [key]);
  return result.values?.[0]?.value ?? null;
}

export async function setMeta(key, value) {
  const database = await ensureDb();
  if (!database) return;
  await database.run(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, String(value)]
  );
}

export async function upsertRemoteRegistro(remoteId, payload, options = {}) {
  return saveLocalRegistro(payload, {
    remoteId,
    syncStatus: "synced",
    ownerUsername: options.ownerUsername ?? payload?.encargado ?? null,
  });
}
