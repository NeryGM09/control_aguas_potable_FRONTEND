import { getApiBaseURL } from "../api/api";
import defaultLogo from "../assets/logo.png";
import catvLogo from "../assets/logo.png";
import chumbaguaLogo from "../assets/CACH.png";

const ENV_LOGOS = {
  chumbagua:
    import.meta.env.VITE_LOGO_CHUMBAGUA_URL ||
    import.meta.env.VITE_LOGO_CHUMBAagua_URL ||
    "",
  tres_valles: import.meta.env.VITE_LOGO_TRESVALLES_URL || "",
};

const LOCAL_LOGOS = {
  chumbagua: chumbaguaLogo,
  tres_valles: catvLogo,
};

const LOCAL_SOCIEDAD_NAMES = {
  chumbagua: "Chumbagua",
  tres_valles: "Tres Valles",
};

const asNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    user?.society_id ??
    user?.societyId ??
    user?.society?.id ??
    user?.societyID ??
    (typeof user?.sociedad === "number" ? user.sociedad : null) ??
    (typeof user?.sociedad === "string" && /^\d+$/.test(user.sociedad.trim())
      ? user.sociedad
      : null) ??
    (typeof user?.society === "number" ? user.society : null) ??
    (typeof user?.society === "string" && /^\d+$/.test(user.society.trim())
      ? user.society
      : null) ??
    null;
  return asNumber(raw);
};

const resolveSociedadKey = (user) => {
  const sociedadId = resolveSociedadId(user);
  if (sociedadId === 1) {
    return "tres_valles";
  }
  if (sociedadId === 2) {
    return "chumbagua";
  }

  const candidates = [
    user?.sociedad_nombre,
    user?.sociedadNombre,
    user?.sociedad?.nombre,
    user?.sociedad?.name,
    user?.society_nombre,
    user?.society_name,
    user?.societyName,
    user?.society?.nombre,
    user?.society?.name,
    user?.sociedad,
    user?.society,
    user?.sociedad_name,
    user?.sociedadName,
    user?.sociedad_codigo,
    user?.sociedadCodigo,
    user?.sociedad_code,
    user?.sociedadCode,
    user?.bukrs,
    user?.society_code,
    user?.societyCode,
  ];
  const rawCandidate = candidates.find((value) => typeof value === "string" && value.trim());
  const normalized = normalizeText(rawCandidate).replace(/\s+/g, "");
  if (
    normalized === "cach" ||
    normalized.includes("cach") ||
    normalized.includes("chumbagua")
  ) {
    return "chumbagua";
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
    username.includes("chumbagua")
  ) {
    return "chumbagua";
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
  } catch {
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

const findSociedadInCatalog = (user, sociedades = []) => {
  const items = Array.isArray(sociedades) ? sociedades : [];
  if (items.length === 0) return null;

  const sociedadId = resolveSociedadId(user);
  if (sociedadId !== null) {
    const byId = items.find((item) => {
      const itemId = asNumber(item?.id ?? item?.sociedad_id ?? item?.society_id);
      return itemId === sociedadId;
    });
    if (byId) return byId;
  }

  const codeCandidates = [
    user?.sociedad_codigo,
    user?.sociedadCodigo,
    user?.sociedad_code,
    user?.sociedadCode,
    user?.bukrs,
    user?.society_code,
    user?.societyCode,
  ]
    .map((value) => normalizeText(value).replace(/\s+/g, ""))
    .filter(Boolean);

  if (codeCandidates.length > 0) {
    const byCode = items.find((item) => {
      const itemCodes = [
        item?.codigo,
        item?.code,
        item?.bukrs,
        item?.sociedad_codigo,
        item?.sociedadCode,
      ].map((value) => normalizeText(value).replace(/\s+/g, ""));
      return itemCodes.some((code) => code && codeCandidates.includes(code));
    });
    if (byCode) return byCode;
  }

  return items.length === 1 ? items[0] : null;
};

export const getSociedadName = (user, sociedades = []) => {
  const nameCandidates = [
    user?.sociedad_nombre,
    user?.sociedadNombre,
    user?.sociedad?.nombre,
    user?.sociedad?.name,
    user?.sociedad_name,
    user?.sociedadName,
    user?.society_nombre,
    user?.society_name,
    user?.societyName,
    user?.society?.nombre,
    user?.society?.name,
  ];
  const explicitName = nameCandidates.find(
    (value) => typeof value === "string" && value.trim()
  );
  if (explicitName) return explicitName.trim();

  if (
    typeof user?.sociedad === "string" &&
    user.sociedad.trim() &&
    !/^\d+$/.test(user.sociedad.trim())
  ) {
    const keyFromSociedad = resolveSociedadKey(user);
    if (keyFromSociedad) return LOCAL_SOCIEDAD_NAMES[keyFromSociedad];
    return user.sociedad.trim();
  }

  if (
    typeof user?.society === "string" &&
    user.society.trim() &&
    !/^\d+$/.test(user.society.trim())
  ) {
    const keyFromSociety = resolveSociedadKey(user);
    if (keyFromSociety) return LOCAL_SOCIEDAD_NAMES[keyFromSociety];
    return user.society.trim();
  }

  const catalogSociedad = findSociedadInCatalog(user, sociedades);
  const catalogName =
    catalogSociedad?.nombre ||
    catalogSociedad?.name ||
    catalogSociedad?.sociedad_nombre ||
    catalogSociedad?.society_name;
  if (typeof catalogName === "string" && catalogName.trim()) {
    return catalogName.trim();
  }

  const codeCandidates = [
    user?.sociedad_codigo,
    user?.sociedadCodigo,
    user?.sociedad_code,
    user?.sociedadCode,
    user?.bukrs,
    user?.society_code,
    user?.societyCode,
  ];
  const explicitCode = codeCandidates.find(
    (value) => typeof value === "string" && value.trim()
  );

  const key = resolveSociedadKey(user);
  if (key) return LOCAL_SOCIEDAD_NAMES[key];

  return explicitCode ? explicitCode.trim() : "No especificada";
};

export const getSociedadKey = (user) => resolveSociedadKey(user);
