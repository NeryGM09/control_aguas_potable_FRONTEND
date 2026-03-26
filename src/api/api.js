import axios from "axios";
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const envBaseURL = import.meta.env.VITE_API_BASE_URL;
const envNativeBaseURL =
  import.meta.env.VITE_API_BASE_URL_NATIVE || import.meta.env.VITE_API_BASE_URL_ANDROID;
const envTimeout = import.meta.env.VITE_API_TIMEOUT;
const isNative = Capacitor?.isNativePlatform?.() ?? false;
const STORAGE_KEY = "api_base_url_override";

const fallbackWebBaseURL = "localhost:8000";
const fallbackNativeBaseURL = "localhost:8000";

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

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch (err) {
    return null;
  }
}

function getStoredBaseURL() {
  const storage = getStorage();
  if (!storage) return "";
  const value = storage.getItem(STORAGE_KEY);
  return value ? value.trim() : "";
}

const defaultRawBaseURL = isNative
  ? envNativeBaseURL || envBaseURL || fallbackNativeBaseURL
  : envBaseURL || fallbackWebBaseURL;
const defaultBaseURL = normalizeBaseURL(defaultRawBaseURL);
const storedBaseURL = getStoredBaseURL();
const rawBaseURL = storedBaseURL || defaultRawBaseURL;
const baseURL = normalizeBaseURL(rawBaseURL) || defaultBaseURL;
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
  const fullUrl = base ? new URL(url, base).toString() : url;
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

  return {
    data: response.data,
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

  const normalized = normalizeBaseURL(value);
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
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
