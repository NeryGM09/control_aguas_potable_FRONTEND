import axios from "axios";
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const envBaseURL = import.meta.env.VITE_API_BASE_URL;
const envNativeBaseURL =
  import.meta.env.VITE_API_BASE_URL_NATIVE || import.meta.env.VITE_API_BASE_URL_ANDROID;
const envTimeout = import.meta.env.VITE_API_TIMEOUT;
const isNative = Capacitor?.isNativePlatform?.() ?? false;
const STORAGE_KEY = "api_base_url_override";
const CONTROL_AGUAS_APP_DESTINO = "control_aguas";
const LEGACY_BASE_PATHS = new Set(["/control-aguas", "/api/control-aguas"]);

const fallbackWebBaseURL = "/";
const fallbackNativeBaseURL = "http://localhost:8000";

function normalizeBaseURL(value) {
  if (!value) return value;
  let trimmed = String(value).trim();
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }
  const ipPortFix = trimmed.match(
    /^(https?:\/\/(?:\d{1,3}\.){3}\d{1,3})\.(\d+)(\/.*)?$/
  );
  if (ipPortFix) {
    const [, host, port, rest] = ipPortFix;
    return `${host}:${port}${rest || ""}`;
  }
  return trimmed;
}

function stripLegacyModulePath(value) {
  if (!value) return value;
  if (value.startsWith("/")) {
    const currentPath = value.replace(/\/+$/, "") || "/";
    if (LEGACY_BASE_PATHS.has(currentPath)) {
      return "/";
    }
    return value;
  }
  try {
    const url = new URL(value);
    const currentPath = (url.pathname || "").replace(/\/+$/, "") || "/";
    if (LEGACY_BASE_PATHS.has(currentPath)) {
      url.pathname = "/";
      return url.toString();
    }
    return value;
  } catch (err) {
    return value;
  }
}

const ABSOLUTE_URL_REGEX = /^([a-z][a-z\d+-.]*:)?\/\//i;

function isAbsoluteURL(value) {
  return ABSOLUTE_URL_REGEX.test(value || "");
}

function combineURLs(baseURL, relativeURL) {
  if (!relativeURL) return baseURL;
  return `${baseURL.replace(/\/+$/, "")}/${relativeURL.replace(/^\/+/, "")}`;
}

function buildFullPath(baseURL, requestedURL) {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
}

function getRequiredBasePath() {
  const candidates = [envBaseURL, envNativeBaseURL].filter(Boolean);
  for (const candidate of candidates) {
    const normalized = normalizeBaseURL(candidate);
    if (!normalized) continue;
    if (normalized.startsWith("/")) {
      return normalized.replace(/\/+$/, "") || "/";
    }
    try {
      const url = new URL(normalized);
      const path = (url.pathname || "").replace(/\/+$/, "");
      if (path) {
        return path;
      }
    } catch (err) {
      // Ignore invalid URLs; fall through to other candidates.
    }
  }
  return "";
}

function applyRequiredPath(baseURL, requiredPath) {
  if (!baseURL || !requiredPath) return baseURL;
  const cleanRequired = requiredPath.replace(/\/+$/, "");
  if (!cleanRequired || cleanRequired === "/") return baseURL;
  if (baseURL.startsWith("/")) {
    if (baseURL === "/" || baseURL === "" || !baseURL.startsWith(cleanRequired)) {
      return cleanRequired;
    }
    return baseURL;
  }
  try {
    const url = new URL(baseURL);
    const currentPath = (url.pathname || "").replace(/\/+$/, "");
    if (
      !currentPath ||
      currentPath === "/" ||
      !currentPath.startsWith(cleanRequired)
    ) {
      url.pathname = cleanRequired;
      return url.toString();
    }
    return baseURL;
  } catch (err) {
    return baseURL;
  }
}

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch (err) {
    return null;
  }
}

function isLegacyBaseURL(value) {
  const normalized = normalizeBaseURL(value);
  if (!normalized || normalized.startsWith("/")) return false;
  try {
    const url = new URL(normalized);
    const currentPath = (url.pathname || "").replace(/\/+$/, "") || "/";
    return LEGACY_BASE_PATHS.has(currentPath);
  } catch (err) {
    return false;
  }
}

function getStoredBaseURL() {
  const storage = getStorage();
  if (!storage) return "";
  const value = storage.getItem(STORAGE_KEY);
  const normalized = value ? stripLegacyModulePath(normalizeBaseURL(value.trim())) : "";
  if (isLegacyBaseURL(normalized)) {
    storage.removeItem(STORAGE_KEY);
    console.info("Cleared legacy API base URL override:", normalized);
    return "";
  }
  return normalized || "";
}

const requiredBasePath = getRequiredBasePath();
const defaultRawBaseURL = isNative
  ? envNativeBaseURL || envBaseURL || fallbackNativeBaseURL
  : envBaseURL || fallbackWebBaseURL;
const normalizedDefaultBaseURL = stripLegacyModulePath(normalizeBaseURL(defaultRawBaseURL));
const defaultBaseURL = applyRequiredPath(normalizedDefaultBaseURL, requiredBasePath);

let storedBaseURL = getStoredBaseURL();
let normalizedStoredBaseURL = normalizeBaseURL(storedBaseURL);
const normalizedStoredWithPath = applyRequiredPath(normalizedStoredBaseURL, requiredBasePath);
if (normalizedStoredBaseURL && normalizedStoredWithPath !== normalizedStoredBaseURL) {
  const storage = getStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY, normalizedStoredWithPath);
  }
  storedBaseURL = normalizedStoredWithPath;
  normalizedStoredBaseURL = normalizedStoredWithPath;
}

const rawBaseURL = storedBaseURL || defaultRawBaseURL;
const normalizedRawBaseURL = stripLegacyModulePath(normalizeBaseURL(rawBaseURL));
const baseURL = applyRequiredPath(normalizedRawBaseURL, requiredBasePath) || defaultBaseURL;
const timeout = envTimeout ? Number(envTimeout) : undefined;

if (!envBaseURL && !import.meta.env.DEV && !envNativeBaseURL && !storedBaseURL) {
  console.warn(
    "VITE_API_BASE_URL / VITE_API_BASE_URL_NATIVE is not set. Using fallback base URL:",
    isNative ? fallbackNativeBaseURL : fallbackWebBaseURL
  );
}
if (rawBaseURL !== baseURL) {
  console.warn("Normalized API base URL:", rawBaseURL, "=>", baseURL);
}
if (storedBaseURL) {
  console.info("Using API base URL override:", baseURL);
}

async function nativeAdapter(config) {
  const method = String(config.method || "get").toUpperCase();
  const base = config.baseURL || "";
  const url = config.url || "";
  const fullUrl = base ? buildFullPath(base, url) : url;
  const headers = config.headers?.toJSON ? config.headers.toJSON() : config.headers || {};
  const params = config.params || undefined;
  const data = config.data ?? undefined;

  const response = await CapacitorHttp.request({
    method,
    url: fullUrl,
    headers,
    params,
    data,
    connectTimeout: Number.isFinite(config.timeout) ? config.timeout : undefined,
    readTimeout: Number.isFinite(config.timeout) ? config.timeout : undefined,
  });

  let responseData = response.data;
  if (typeof responseData === "string") {
    const headerKey = Object.keys(response.headers || {}).find(
      (key) => key.toLowerCase() === "content-type"
    );
    const contentType = headerKey ? response.headers[headerKey] : "";
    const trimmed = responseData.trim();
    if (
      (typeof contentType === "string" && contentType.includes("application/json")) ||
      trimmed.startsWith("{") ||
      trimmed.startsWith("[")
    ) {
      try {
        responseData = JSON.parse(responseData);
      } catch (err) {
        // Keep original string if JSON parsing fails.
      }
    }
  }

  return {
    data: responseData,
    status: response.status,
    statusText: String(response.status),
    headers: response.headers || {},
    config,
    request: null,
  };
}

const apiConfig = {
  baseURL,
  timeout: Number.isFinite(timeout) ? timeout : undefined,
};
if (isNative) {
  apiConfig.adapter = nativeAdapter;
}

export const api = axios.create(apiConfig);

export function getApiBaseURL() {
  return api.defaults.baseURL;
}

export function getApiBaseURLOverride() {
  return getStoredBaseURL();
}

export function setApiBaseURL(nextValue) {
  const storage = getStorage();
  const value = String(nextValue || "").trim();
  if (!value) {
    if (storage) {
      storage.removeItem(STORAGE_KEY);
    }
    api.defaults.baseURL = defaultBaseURL;
    return api.defaults.baseURL;
  }

  const normalized = applyRequiredPath(
    stripLegacyModulePath(normalizeBaseURL(value)),
    requiredBasePath
  );
  if (storage) {
    storage.setItem(STORAGE_KEY, normalized);
  }
  api.defaults.baseURL = normalized;
  return api.defaults.baseURL;
}

export function clearApiBaseURLOverride() {
  return setApiBaseURL("");
}

api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!config.headers["x-app-destino"] && !config.headers["X-App-Destino"]) {
    config.headers["x-app-destino"] = CONTROL_AGUAS_APP_DESTINO;
  }
  return config;
});
