const STORAGE_KEY = "offline_users_v1";
const DEFAULT_ITERATIONS = 100000;

function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function getBrowserCrypto() {
  if (typeof window === "undefined") return null;
  return window.crypto || null;
}

function createCryptoUnavailableError() {
  const err = new Error("CRYPTO_UNAVAILABLE");
  err.code = "CRYPTO_UNAVAILABLE";
  return err;
}

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch {
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
  } catch {
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
  const cryptoApi = getBrowserCrypto();
  if (!cryptoApi?.subtle || !cryptoApi?.getRandomValues) {
    throw createCryptoUnavailableError();
  }
  const encoder = new TextEncoder();
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const salt = base64ToBuffer(saltBase64);
  const derivedBits = await cryptoApi.subtle.deriveBits(
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

function getUserIdentifiers(user, loginIdentifier = "") {
  const candidates = [
    loginIdentifier,
    user?.username,
    user?.user,
    user?.usuario,
    user?.nombre_usuario,
    user?.username_or_email,
    user?.email,
    user?.correo,
  ];

  return [...new Set(candidates.map(normalizeIdentifier).filter(Boolean))];
}

function getUserDisplayUsername(user, identifiers = []) {
  return (
    user?.username ||
    user?.user ||
    user?.usuario ||
    user?.nombre_usuario ||
    identifiers[0] ||
    ""
  );
}

function recordMatchesIdentifier(record, normalized) {
  if (!record || !normalized) return false;
  const identifiers = Array.isArray(record.identifiers)
    ? record.identifiers.map(normalizeIdentifier)
    : [];
  const user = record.user || {};
  return [
    record.username,
    user.username,
    user.user,
    user.usuario,
    user.nombre_usuario,
    user.username_or_email,
    user.email,
    user.correo,
    ...identifiers,
  ]
    .map(normalizeIdentifier)
    .some((value) => value === normalized);
}

function getUserRecord(username) {
  const normalized = normalizeIdentifier(username);
  if (!normalized) return null;
  const users = loadUsers();
  return users.find((item) => recordMatchesIdentifier(item, normalized)) || null;
}

export async function upsertOfflineUser(user, password, token, options = {}) {
  if (!user || !password) return false;
  const identifiers = getUserIdentifiers(user, options.loginIdentifier);
  const username = identifiers[0] || normalizeIdentifier(getUserDisplayUsername(user, identifiers));
  if (!username) {
    const err = new Error("OFFLINE_USER_IDENTIFIER_MISSING");
    err.code = "OFFLINE_USER_IDENTIFIER_MISSING";
    throw err;
  }

  const cryptoApi = getBrowserCrypto();
  if (!cryptoApi?.getRandomValues) {
    throw createCryptoUnavailableError();
  }
  const saltBytes = new Uint8Array(16);
  cryptoApi.getRandomValues(saltBytes);
  const salt = bufferToBase64(saltBytes);
  const iterations = DEFAULT_ITERATIONS;
  const hash = await deriveHash(password, salt, iterations);

  const users = loadUsers();
  const entry = {
    username,
    identifiers,
    user: {
      id: user.id,
      username: getUserDisplayUsername(user, identifiers),
      user: user.user ?? null,
      usuario: user.usuario ?? null,
      email: user.email ?? user.correo ?? null,
      role: user.role ?? user.rol ?? null,
      rol: user.rol ?? user.role ?? null,
      roles: Array.isArray(user.roles) ? user.roles : [],
      sociedad_id:
        user.sociedad_id ??
        user.sociedadId ??
        user.sociedad?.id ??
        user.society_id ??
        user.societyId ??
        user.society?.id ??
        (typeof user.sociedad === "number" ? user.sociedad : null) ??
        (typeof user.sociedad === "string" && /^\d+$/.test(user.sociedad.trim())
          ? user.sociedad
          : null) ??
        (typeof user.society === "number" ? user.society : null) ??
        (typeof user.society === "string" && /^\d+$/.test(user.society.trim())
          ? user.society
          : null) ??
        null,
      sociedad_nombre:
        user.sociedad_nombre ??
        user.sociedadNombre ??
        user.sociedad?.nombre ??
        user.sociedad?.name ??
        user.society_nombre ??
        user.societyName ??
        user.society?.nombre ??
        user.society?.name ??
        (typeof user.sociedad === "string" && !/^\d+$/.test(user.sociedad.trim())
          ? user.sociedad
          : null) ??
        (typeof user.society === "string" && !/^\d+$/.test(user.society.trim())
          ? user.society
          : null) ??
        null,
      sociedad_logo_url:
        user.sociedad_logo_url ??
        user.sociedadLogoUrl ??
        user.sociedad?.logo_url ??
        user.society_logo_url ??
        user.societyLogoUrl ??
        user.society?.logo_url ??
        null,
    },
    salt,
    iterations,
    hash,
    token: token || "",
    updated_at: new Date().toISOString(),
  };

  const existingIndex = users.findIndex((item) =>
    identifiers.some((identifier) => recordMatchesIdentifier(item, identifier))
  );
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
