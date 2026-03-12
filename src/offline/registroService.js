import { Capacitor } from "@capacitor/core";
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

async function getOnlineStatus() {
  if (isNative()) {
    const status = await Network.getStatus();
    return status.connected;
  }
  if (typeof navigator !== "undefined" && "onLine" in navigator) {
    return navigator.onLine;
  }
  return true;
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

async function cacheRemote(registros = []) {
  for (const registro of registros) {
    await upsertRemoteRegistro(registro.id, registro);
  }
}

async function pushPendingCreates() {
  const pending = await getPendingCreates();
  if (!pending.length) return;

  const items = pending.map((item) => ({
    client_ref: item.client_ref,
    registro: item.payload,
  }));

  const res = await api.post("/sync/push", { items });
  const results = res?.data?.results || [];

  for (const result of results) {
    if (!result?.client_ref) continue;
    if (result?.registro_id) {
      await setRemoteIdForClientRef(result.client_ref, result.registro_id);
    }
  }
}

async function pushPendingUpdates() {
  const updates = await getPendingUpdates();
  if (!updates.length) return;

  for (const item of updates) {
    if (!item.remote_id) {
      continue;
    }

    try {
      await api.put(`/registros/${item.remote_id}`, item.payload);
      await markUpdateDone(item.id);
    } catch (err) {
      const status = err?.response?.status;
      if (![404, 405, 422].includes(status)) {
        throw err;
      }
    }
  }
}

async function pullRemoteUpdates() {
  const lastIdValue = await getMeta(LAST_SYNC_ID_KEY);
  const sinceId = Number(lastIdValue || 0);

  const res = await api.get("/sync/pull", { params: { since_id: sinceId } });
  const data = res?.data;

  if (data?.registros?.length) {
    await cacheRemote(data.registros);
  }

  if (typeof data?.last_id === "number") {
    await setMeta(LAST_SYNC_ID_KEY, data.last_id);
  }
}

export async function syncNow() {
  const online = await getOnlineStatus();
  if (!online) return false;

  await pushPendingCreates();
  await pushPendingUpdates();
  await pullRemoteUpdates();
  return true;
}

export async function initOffline() {
  await initDb();

  if (await getOnlineStatus()) {
    await syncNow();
  }

  if (isNative()) {
    Network.addListener("networkStatusChange", async (status) => {
      if (status.connected) {
        await syncNow();
      }
    });
  }
}

export async function getRegistros() {
  const online = await getOnlineStatus();
  if (online) {
    try {
      const res = await api.get("/registros");
      await cacheRemote(res.data || []);
      return res.data || [];
    } catch (err) {
      return await listLocalRegistros();
    }
  }

  return await listLocalRegistros();
}

export async function createRegistro(payload) {
  const online = await getOnlineStatus();

  if (online) {
    try {
      const res = await api.post("/registros", payload);
      if (res?.data) {
        await upsertRemoteRegistro(res.data.id, res.data);
      }
      return res.data;
    } catch (err) {
      // fall back to local
    }
  }

  const clientRef = uuidv4();
  await saveLocalRegistro(payload, { clientRef, syncStatus: "pending" });
  return { ...payload, id: clientRef, _clientRef: clientRef, _syncStatus: "pending" };
}

export async function updateRegistro(record, payloadEditable, payloadFull) {
  const online = await getOnlineStatus();
  const updatePayload = payloadEditable || payloadFull;

  if (!updatePayload) return;

  const remoteId = record?._remoteId ?? record?.id ?? null;
  const mergedPayload = mergeUpdatedRecord(record, updatePayload);

  if (online && remoteId && typeof remoteId === "number") {
    try {
      await api.put(`/registros/${remoteId}`, payloadEditable);
      await updateLocalByRemoteId(remoteId, mergedPayload, "synced");
      return true;
    } catch (err) {
      const status = err?.response?.status;
      if (![404, 405, 422].includes(status)) {
        throw err;
      }
    }
  }

  if (record?._clientRef) {
    await updateLocalByClientRef(record._clientRef, mergedPayload, "pending");
    await queueUpdate(record._clientRef, record._remoteId ?? null, payloadEditable);
    return false;
  }

  if (remoteId && typeof remoteId === "number") {
    await updateLocalByRemoteId(remoteId, mergedPayload, "pending");
    await queueUpdate(null, remoteId, payloadEditable);
  }

  return false;
}
