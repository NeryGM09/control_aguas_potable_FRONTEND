import { getApiBaseURL } from "../api/api";
import defaultLogo from "../assets/logo.png";
import chimbaguaLogo from "../assets/CACH.png";

const ENV_LOGOS = {
  chimbagua: import.meta.env.VITE_LOGO_CHIMBAGUA_URL || "",
  tres_valles: import.meta.env.VITE_LOGO_TRESVALLES_URL || "",
};

const LOCAL_LOGOS = {
  chimbagua: chimbaguaLogo,
  tres_valles: defaultLogo,
};

const normalizeText = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

const resolveSociedadId = (user) => {
  const raw =
    user?.sociedad_id ??
    user?.sociedadId ??
    user?.sociedad?.id ??
    user?.sociedadID ??
    null;
  if (raw === null || raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveSociedadKey = (user) => {
  const sociedadId = resolveSociedadId(user);
  if (sociedadId === 1) {
    return "chimbagua";
  }
  if (sociedadId === 2) {
    return "tres_valles";
  }

  const candidates = [
    user?.sociedad_nombre,
    user?.sociedad?.nombre,
    user?.sociedad,
    user?.sociedad_name,
    user?.sociedadName,
    user?.sociedad_codigo,
    user?.sociedadCodigo,
    user?.sociedad_code,
    user?.sociedadCode,
  ];
  const rawCandidate = candidates.find((value) => typeof value === "string" && value.trim());
  const normalized = normalizeText(rawCandidate).replace(/\s+/g, "");
  if (
    normalized === "cach" ||
    normalized.includes("cach") ||
    normalized.includes("chimbagua") ||
    normalized.includes("chumbagua")
  ) {
    return "chimbagua";
  }
  if (
    normalized === "catv" ||
    normalized.includes("catv") ||
    normalized.includes("tresvalles") ||
    normalized.includes("tresvalle")
  ) {
    return "tres_valles";
  }

  const username = normalizeText(user?.username).replace(/\s+/g, "");
  if (
    username === "cach" ||
    username.includes("cach") ||
    username.includes("chimbagua") ||
    username.includes("chumbagua")
  ) {
    return "chimbagua";
  }
  if (
    username === "catv" ||
    username.includes("catv") ||
    username.includes("tresvalles") ||
    username.includes("tresvalle")
  ) {
    return "tres_valles";
  }

  return "";
};

const toAbsoluteUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^data:/i.test(raw) || /^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) {
    if (typeof window !== "undefined") {
      return `${window.location.protocol}${raw}`;
    }
    return `https:${raw}`;
  }

  const base =
    getApiBaseURL() || (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return raw;
  try {
    return new URL(raw, base).toString();
  } catch (err) {
    return raw;
  }
};

export const getSociedadLogoSrc = (user) => {
  const key = resolveSociedadKey(user);
  const local = key ? LOCAL_LOGOS[key] : "";
  if (local) return local;

  const fromEnv = toAbsoluteUrl(key ? ENV_LOGOS[key] : "");
  if (fromEnv) return fromEnv;

  const fromUser = toAbsoluteUrl(user?.sociedad_logo_url || user?.sociedad?.logo_url || "");
  if (fromUser) return fromUser;

  const fallbackEnv = toAbsoluteUrl(import.meta.env.VITE_LOGO_DEFAULT_URL || "");
  if (fallbackEnv) return fallbackEnv;

  return defaultLogo;
};

export const getSociedadKey = (user) => resolveSociedadKey(user);
