import { Network } from "@capacitor/network";
import { v4 as uuidv4 } from "uuid";
import { api } from "../api/api";
import {
  getMeta,
  getPendingCreates,
  getPendingUpdates,
  initDb,
  isNative,
  listLocalRegistros,
  markUpdateDone,
  queueUpdate,
  saveLocalRegistro,
  setMeta,
  setRemoteIdForClientRef,
  updateLocalByClientRef,
  updateLocalByRemoteId,
  upsertRemoteRegistro,
} from "./sqliteStore";

const LAST_SYNC_ID_KEY = "last_sync_id";

function normalizeUsername(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).trim().replace(",", ".");
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return normalized;
  return String(parsed);
}

function buildRegistroSignature(registro = {}) {
  return [
    normalizeText(registro.fecha),
    normalizeText(registro.hora),
    normalizeText(registro.encargado),
    normalizeText(registro.punto_muestreo),
    normalizeText(registro.observaciones),
    normalizeNumber(registro.cruda?.ph),
    normalizeNumber(registro.cruda?.conductividad),
    normalizeNumber(registro.cruda?.turbidez),
    normalizeNumber(registro.decantada?.ph),
    normalizeNumber(registro.decantada?.conductividad),
    normalizeNumber(registro.decantada?.turbidez),
    normalizeNumber(registro.tratada?.ph),
    normalizeNumber(registro.tratada?.conductividad),
    normalizeNumber(registro.tratada?.turbidez),
    normalizeNumber(registro.tratada?.cloro),
  ].join("|");
}

function dedupeRegistros(registros = []) {
  const seen = new Set();
  const output = [];

  for (const registro of registros) {
    const signature = buildRegistroSignature(registro);
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    output.push(registro);
  }

  return output;
}

function filterRegistrosByOwner(registros = [], ownerFilter = null) {
  const normalizedFilter = normalizeUsername(ownerFilter);
  const safeRegistros = Array.isArray(registros) ? registros : [];
  if (!normalizedFilter) {
    return safeRegistros;
  }

  return safeRegistros.filter(
    (registro) => normalizeUsername(registro?.encargado) === normalizedFilter
  );
}

function resolveOwnerContext(options = {}) {
  const user = options.user || null;
  const username = options.username ?? user?.username ?? "";
  const ownerUsername = normalizeUsername(username);
  const ownerFilter =
    options.ownerFilter !== undefined
      ? normalizeUsername(options.ownerFilter)
      : ownerUsername;
  return { ownerUsername, ownerFilter };
}

function getSyncMetaKey(ownerFilter) {
  if (!ownerFilter) return LAST_SYNC_ID_KEY;
  return `${LAST_SYNC_ID_KEY}:${ownerFilter}`;
}

export async function getOnlineStatus() {
  if (isNative()) {
    const status = await Network.getStatus();
    return status.connected;
  }
  if (typeof navigator !== "undefined" && "onLine" in navigator) {
    return navigator.onLine;
  }
  return true;
}

export function onNetworkStatusChange(handler) {
  if (typeof handler !== "function") return () => {};

  if (isNative()) {
    let remove = () => {};
    let removed = false;
    const maybeHandle = Network.addListener("networkStatusChange", (status) => {
      handler(Boolean(status?.connected));
    });

    const attach = (handle) => {
      remove = () => handle.remove();
      if (removed) {
        handle.remove();
      }
    };

    if (maybeHandle?.then) {
      maybeHandle.then((handle) => attach(handle));
    } else if (maybeHandle?.remove) {
      attach(maybeHandle);
    }

    return () => {
      removed = true;
      remove();
    };
  }

  if (typeof window !== "undefined") {
    const handleOnline = () => handler(true);
    const handleOffline = () => handler(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }

  return () => {};
}

function mergeUpdatedRecord(record, updatePayload) {
  return {
    fecha: record.fecha,
    hora: record.hora,
    punto_muestreo: updatePayload.punto_muestreo,
    observaciones: updatePayload.observaciones ?? record.observaciones ?? "",
    encargado: record.encargado,
    cruda: updatePayload.cruda,
    decantada: updatePayload.decantada,
    tratada: updatePayload.tratada,
  };
}

async function cacheRemote(registros = [], ownerFilter = null) {
  const normalizedFilter = normalizeUsername(ownerFilter);

  for (const registro of registros) {
    const registroOwner = normalizeUsername(registro?.encargado);
    if (normalizedFilter) {
      if (!registroOwner || registroOwner !== normalizedFilter) {
        continue;
      }
    }
    await upsertRemoteRegistro(registro.id, registro, {
      ownerUsername: registroOwner ?? normalizedFilter,
    });
  }
}

async function pushPendingCreates(ownerFilter = null) {
  const pending = await getPendingCreates({ ownerUsername: ownerFilter });
  if (!pending.length) return;

  const items = pending.map((item) => ({
    client_ref: item.client_ref,
    registro: item.payload,
  }));

  const res = await api.post("/api/control-aguas/sync/push", { items });
  const results = res?.data?.results || [];

  for (const result of results) {
    if (!result?.client_ref) continue;
    if (result?.registro_id) {
      await setRemoteIdForClientRef(result.client_ref, result.registro_id);
    }
  }
}

async function pushPendingUpdates(ownerFilter = null) {
  const updates = await getPendingUpdates({ ownerUsername: ownerFilter });
  if (!updates.length) return;

  for (const item of updates) {
    if (!item.remote_id) {
      continue;
    }

    try {
      await api.put(`/api/control-aguas/registros/${item.remote_id}`, item.payload);
      await markUpdateDone(item.id);
    } catch (err) {
      const status = err?.response?.status;
      if (![404, 405, 422].includes(status)) {
        throw err;
      }
    }
  }
}

async function pullRemoteUpdates(ownerFilter = null) {
  const metaKey = getSyncMetaKey(ownerFilter);
  const lastIdValue = await getMeta(metaKey);
  const sinceId = Number(lastIdValue || 0);

  const res = await api.get("/api/control-aguas/sync/pull", {
    params: { since_id: sinceId },
  });
  const data = res?.data;

  if (data?.registros?.length) {
    await cacheRemote(data.registros, ownerFilter);
  }

  if (typeof data?.last_id === "number") {
    await setMeta(metaKey, data.last_id);
  }
}

export async function syncNow(options = {}) {
  const { ownerFilter } = resolveOwnerContext(options);
  const online = await getOnlineStatus();
  if (!online) return false;

  await pushPendingCreates(ownerFilter);
  await pushPendingUpdates(ownerFilter);
  await pullRemoteUpdates(ownerFilter);
  return true;
}

export async function initOffline(options = {}) {
  await initDb();

  if (await getOnlineStatus()) {
    await syncNow(options);
  }

  return onNetworkStatusChange(async (connected) => {
    if (connected) {
      await syncNow(options);
    }
  });
}

export async function getRegistros(options = {}) {
  const { ownerFilter } = resolveOwnerContext(options);
  const includeAllUsers = options.includeAllUsers === true;
  const online = await getOnlineStatus();
  let remoteData = null;

  if (online) {
    try {
      const res = await api.get("/api/control-aguas/registros/", {
        params: includeAllUsers ? { all_users: true } : undefined,
      });
      remoteData = res?.data || [];
      await cacheRemote(remoteData, ownerFilter);
    } catch {
      remoteData = null;
    }
  }

  if (includeAllUsers) {
    const local = await listLocalRegistros({ ownerUsername: ownerFilter });

    if (!online || !Array.isArray(remoteData)) {
      return dedupeRegistros(local);
    }

    if (!isNative()) {
      return dedupeRegistros(remoteData);
    }

    return dedupeRegistros([...remoteData, ...local]);
  }

  if (isNative()) {
    const local = await listLocalRegistros({ ownerUsername: ownerFilter });
    return dedupeRegistros(local);
  }

  if (online && Array.isArray(remoteData)) {
    return dedupeRegistros(filterRegistrosByOwner(remoteData, ownerFilter));
  }

  const local = await listLocalRegistros({ ownerUsername: ownerFilter });
  return dedupeRegistros(local);
}

export async function getRegistrosForWeeklyReport(options = {}) {
  const { ownerUsername } = resolveOwnerContext(options);
  const online = await getOnlineStatus();
  if (!online) {
    return [];
  }

  let remoteData = [];
  try {
    const res = await api.get("/api/control-aguas/sync/pull", {
      params: { since_id: 0 },
    });
    remoteData = res?.data?.registros || [];
  } catch {
    try {
      const res = await api.get("/api/control-aguas/registros/");
      remoteData = res?.data || [];
    } catch {
      remoteData = [];
    }
  }

  if (!isNative()) {
    return dedupeRegistros(remoteData);
  }

  const local = await listLocalRegistros({ ownerUsername });
  return dedupeRegistros([...remoteData, ...local]);
}

export async function createRegistro(payload, options = {}) {
  const { ownerUsername } = resolveOwnerContext(options);
  const online = await getOnlineStatus();

  if (online) {
    try {
      const res = await api.post("/api/control-aguas/registros/", payload);
      if (res?.data) {
        await upsertRemoteRegistro(res.data.id, res.data, { ownerUsername });
      }
      return res.data;
    } catch {
      // fall back to local
    }
  }

  const clientRef = uuidv4();
  await saveLocalRegistro(payload, { clientRef, syncStatus: "pending", ownerUsername });
  return { ...payload, id: clientRef, _clientRef: clientRef, _syncStatus: "pending" };
}

export async function updateRegistro(record, payloadEditable, payloadFull, options = {}) {
  const { ownerUsername } = resolveOwnerContext(options);
  const online = await getOnlineStatus();
  const updatePayload = payloadEditable || payloadFull;

  if (!updatePayload) return;

  const remoteId = record?._remoteId ?? record?.id ?? null;
  const mergedPayload = mergeUpdatedRecord(record, updatePayload);

  if (online && remoteId && typeof remoteId === "number") {
    try {
      await api.put(`/api/control-aguas/registros/${remoteId}`, payloadEditable);
      await updateLocalByRemoteId(remoteId, mergedPayload, "synced", ownerUsername);
      return true;
    } catch (err) {
      const status = err?.response?.status;
      if (![404, 405, 422].includes(status)) {
        throw err;
      }
    }
  }

  if (record?._clientRef) {
    await updateLocalByClientRef(record._clientRef, mergedPayload, "pending", ownerUsername);
    await queueUpdate(record._clientRef, record._remoteId ?? null, payloadEditable, ownerUsername);
    return false;
  }

  if (remoteId && typeof remoteId === "number") {
    await updateLocalByRemoteId(remoteId, mergedPayload, "pending", ownerUsername);
    await queueUpdate(null, remoteId, payloadEditable, ownerUsername);
  }

  return false;
}
