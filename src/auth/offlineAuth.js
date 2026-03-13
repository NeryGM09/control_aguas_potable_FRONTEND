const STORAGE_KEY = "offline_users_v1";
const DEFAULT_ITERATIONS = 100000;

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch (err) {
    return null;
  }
}

function loadUsers() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveUsers(users) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveHash(password, saltBase64, iterations = DEFAULT_ITERATIONS) {
  if (!window?.crypto?.subtle || !window?.crypto?.getRandomValues) {
    throw new Error("CRYPTO_UNAVAILABLE");
  }
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const salt = base64ToBuffer(saltBase64);
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bufferToBase64(derivedBits);
}

function getUserRecord(username) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) return null;
  const users = loadUsers();
  return users.find((item) => item.username === normalized) || null;
}

export async function upsertOfflineUser(user, password, token) {
  if (!user || !password) return false;
  const username = String(user.username || "").trim().toLowerCase();
  if (!username) return false;

  const saltBytes = new Uint8Array(16);
  window.crypto.getRandomValues(saltBytes);
  const salt = bufferToBase64(saltBytes);
  const iterations = DEFAULT_ITERATIONS;
  const hash = await deriveHash(password, salt, iterations);

  const users = loadUsers();
  const entry = {
    username,
    user: { id: user.id, username: user.username, role: user.role },
    salt,
    iterations,
    hash,
    token: token || "",
    updated_at: new Date().toISOString(),
  };

  const existingIndex = users.findIndex((item) => item.username === username);
  if (existingIndex >= 0) {
    users[existingIndex] = entry;
  } else {
    users.push(entry);
  }

  saveUsers(users);
  return true;
}

export async function verifyOfflineUser(username, password) {
  const record = getUserRecord(username);
  if (!record) {
    const err = new Error("OFFLINE_NO_USER");
    err.code = "OFFLINE_NO_USER";
    throw err;
  }

  const hash = await deriveHash(password, record.salt, record.iterations);
  if (hash !== record.hash) {
    const err = new Error("OFFLINE_INVALID");
    err.code = "OFFLINE_INVALID";
    throw err;
  }

  return {
    user: record.user,
    token: record.token || "",
  };
}
