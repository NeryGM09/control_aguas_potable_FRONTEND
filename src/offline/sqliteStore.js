import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

const DB_NAME = "control_aguas";
const DB_VERSION = 1;

let sqlite = null;
let db = null;

export function isNative() {
  return Capacitor.isNativePlatform();
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

export async function initDb() {
  const database = await getDb();
  if (!database) return false;

  await database.execute(`
    CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_id INTEGER UNIQUE,
      client_ref TEXT UNIQUE,
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

  return true;
}

export async function listLocalRegistros() {
  const database = await getDb();
  if (!database) return [];

  const result = await database.query(
    "SELECT id, remote_id, client_ref, payload, sync_status FROM registros ORDER BY id DESC"
  );

  return (result.values || []).map((row) => {
    const payload = JSON.parse(row.payload);
    const recordId = row.remote_id ?? row.client_ref ?? row.id;
    return {
      ...payload,
      id: recordId,
      _localId: row.id,
      _remoteId: row.remote_id ?? null,
      _clientRef: row.client_ref ?? null,
      _syncStatus: row.sync_status,
    };
  });
}

export async function saveLocalRegistro(payload, options = {}) {
  const database = await getDb();
  if (!database) return null;

  const { remoteId = null, clientRef = null, syncStatus = "pending" } = options;
  const now = new Date().toISOString();
  const data = JSON.stringify(payload);

  if (remoteId !== null) {
    const existing = await database.query("SELECT id FROM registros WHERE remote_id = ?", [remoteId]);
    if (existing.values?.length) {
      await database.run(
        "UPDATE registros SET payload = ?, sync_status = ?, updated_at = ? WHERE remote_id = ?",
        [data, syncStatus, now, remoteId]
      );
      return { remoteId };
    }
  }

  if (clientRef) {
    const existing = await database.query("SELECT id FROM registros WHERE client_ref = ?", [clientRef]);
    if (existing.values?.length) {
      await database.run(
        "UPDATE registros SET payload = ?, sync_status = ?, updated_at = ? WHERE client_ref = ?",
        [data, syncStatus, now, clientRef]
      );
      return { clientRef };
    }
  }

  await database.run(
    "INSERT INTO registros (remote_id, client_ref, payload, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [remoteId, clientRef, data, syncStatus, now, now]
  );

  return { remoteId, clientRef };
}

export async function updateLocalByClientRef(clientRef, payload, syncStatus = "pending") {
  const database = await getDb();
  if (!database) return;
  const now = new Date().toISOString();
  await database.run(
    "UPDATE registros SET payload = ?, sync_status = ?, updated_at = ? WHERE client_ref = ?",
    [JSON.stringify(payload), syncStatus, now, clientRef]
  );
}

export async function updateLocalByRemoteId(remoteId, payload, syncStatus = "synced") {
  const database = await getDb();
  if (!database) return;
  const now = new Date().toISOString();
  await database.run(
    "UPDATE registros SET payload = ?, sync_status = ?, updated_at = ? WHERE remote_id = ?",
    [JSON.stringify(payload), syncStatus, now, remoteId]
  );
}

export async function setRemoteIdForClientRef(clientRef, remoteId) {
  const database = await getDb();
  if (!database) return;
  const now = new Date().toISOString();
  await database.run(
    "UPDATE registros SET remote_id = ?, sync_status = ?, updated_at = ? WHERE client_ref = ?",
    [remoteId, "synced", now, clientRef]
  );
}

export async function getPendingCreates() {
  const database = await getDb();
  if (!database) return [];

  const result = await database.query(
    "SELECT client_ref, payload FROM registros WHERE sync_status = 'pending' AND remote_id IS NULL"
  );

  return (result.values || []).map((row) => ({
    client_ref: row.client_ref,
    payload: JSON.parse(row.payload),
  }));
}

export async function queueUpdate(recordRef, remoteId, payload) {
  const database = await getDb();
  if (!database) return;
  const now = new Date().toISOString();
  await database.run(
    "INSERT INTO sync_queue (op, client_ref, remote_id, payload, created_at) VALUES (?, ?, ?, ?, ?)",
    ["update", recordRef, remoteId, JSON.stringify(payload), now]
  );
}

export async function getPendingUpdates() {
  const database = await getDb();
  if (!database) return [];

  const result = await database.query(
    "SELECT id, client_ref, remote_id, payload FROM sync_queue WHERE op = 'update' ORDER BY id ASC"
  );

  return (result.values || []).map((row) => ({
    id: row.id,
    client_ref: row.client_ref,
    remote_id: row.remote_id,
    payload: JSON.parse(row.payload),
  }));
}

export async function markUpdateDone(queueId) {
  const database = await getDb();
  if (!database) return;
  await database.run("DELETE FROM sync_queue WHERE id = ?", [queueId]);
}

export async function getMeta(key) {
  const database = await getDb();
  if (!database) return null;
  const result = await database.query("SELECT value FROM meta WHERE key = ?", [key]);
  return result.values?.[0]?.value ?? null;
}

export async function setMeta(key, value) {
  const database = await getDb();
  if (!database) return;
  await database.run(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, String(value)]
  );
}

export async function upsertRemoteRegistro(remoteId, payload) {
  return saveLocalRegistro(payload, { remoteId, syncStatus: "synced" });
}
