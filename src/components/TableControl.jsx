import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, getApiBaseURL } from "../api/api";
import {
  createRegistro,
  getOnlineStatus,
  getRegistros,
  initOffline,
  onNetworkStatusChange,
  updateRegistro,
} from "../offline/registroService";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { getSociedadLogoSrc, getSociedadName } from "../utils/sociedadLogo";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import "../styles/components/TableControl.css";

// Esta función convierte cualquier valor a número
// Maneja casos donde viene como texto o con coma (ej: "12,5")
const parseNumber = (value) => {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  if (!text) return Number.NaN;

  // Reemplazo coma por punto para evitar errores
  const normalized = text.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

// Formatea fecha en formato YYYY-MM-DD (para guardar en api_catv)
const formatDateYMD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Formatea fecha en formato DD/MM/YYYY (para mostrar en la interfaz)
const formatDateDMY = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatTimeHM = (date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

// Formatea hora con horas, minutos y segundos
const formatTimeHMS = (date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const HORA_SERVER_UTC_STORAGE_KEY = "registro_hora_server_utc";
const DUPLICATE_SUBMIT_WINDOW_MS = 10000;

// Aquí lo que hago es separar una hora tipo "12:30:45"
// en partes para poder trabajarla mejor
const parseHoraParts = (value) => {
  if (!value) return null;
  const text = String(value).trim();

  // Expresión regular para validar formato de hora
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] !== undefined ? Number(match[3]) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }
  return { hours, minutes, seconds, hasSeconds: match[3] !== undefined };
};

const getCircularDiffMinutes = (left, right) => {
  const diff = Math.abs(left - right) % 1440;
  return diff > 720 ? 1440 - diff : diff;
};

// Aquí intento detectar si el servidor está guardando la hora en UTC
// comparando la hora local con la que viene del backend
const detectServerHoraUtc = (localHora, serverHora) => {
  const localParts = parseHoraParts(localHora);
  const serverParts = parseHoraParts(serverHora);
  if (!localParts || !serverParts) return null;
  const localMinutes = localParts.hours * 60 + localParts.minutes;
  const serverMinutes = serverParts.hours * 60 + serverParts.minutes;
  const offsetMinutes = new Date().getTimezoneOffset();
  const expectedUtcMinutes = (localMinutes + offsetMinutes + 1440) % 1440;
  if (getCircularDiffMinutes(serverMinutes, expectedUtcMinutes) <= 2) return true;
  if (getCircularDiffMinutes(serverMinutes, localMinutes) <= 2) return false;
  return null;
};

const detectServerHoraUtcFromRecord = (record) => {
  const horaParts = parseHoraParts(record?.hora);
  const referenceIso = record?.created_at ?? record?.updated_at;
  if (!horaParts || !referenceIso) return null;
  const referenceDate = new Date(referenceIso);
  if (Number.isNaN(referenceDate.getTime())) return null;
  const horaMinutes = horaParts.hours * 60 + horaParts.minutes;
  const refMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  const offsetMinutes = referenceDate.getTimezoneOffset();
  const localFromUtc = (horaMinutes - offsetMinutes + 1440) % 1440;
  if (getCircularDiffMinutes(refMinutes, localFromUtc) <= 2) return true;
  if (getCircularDiffMinutes(refMinutes, horaMinutes) <= 2) return false;
  return null;
};

const convertUtcToLocalDateTime = (fecha, hora) => {
  if (!fecha || !hora) return null;
  const horaParts = parseHoraParts(hora);
  if (!horaParts) return null;
  const hh = String(horaParts.hours).padStart(2, "0");
  const mm = String(horaParts.minutes).padStart(2, "0");
  const ss = String(horaParts.seconds ?? 0).padStart(2, "0");
  const utcDate = new Date(`${fecha}T${hh}:${mm}:${ss}Z`);
  if (Number.isNaN(utcDate.getTime())) return null;
  return {
    fecha: formatDateYMD(utcDate),
    hora: horaParts.hasSeconds ? formatTimeHMS(utcDate) : formatTimeHM(utcDate),
  };
};

const getWeekRange = (baseDate = new Date()) => {
  const date = new Date(baseDate);
  const day = date.getDay(); // 0 = Sunday
  const diffToMonday = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const parseLocalDate = (dateText) => {
  if (!dateText) return null;
  const raw = String(dateText).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) {
      year = 2000 + year;
    }
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

export default function TableControl({ isAdmin = false }) {
  const { user } = useAuth();
  const theme = useTheme();
  const [controles, setControles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [puntoMuestreo, setPuntoMuestreo] = useState("");
  const [cruda, setCruda] = useState({ ph: "", conductividad: "", turbidez: "" });
  const [decantada, setDecantada] = useState({ ph: "", conductividad: "", turbidez: "" });
  const [tratada, setTratada] = useState({ ph: "", conductividad: "", turbidez: "", cloro: "" });
  const [observaciones, setObservaciones] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineNoticeOpen, setOfflineNoticeOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNotice, setPdfNotice] = useState({ open: false, message: "", severity: "info" });
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelNotice, setExcelNotice] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [syncNotice, setSyncNotice] = useState({ open: false, message: "", severity: "success" });
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [sociedadesCatalog, setSociedadesCatalog] = useState([]);
  const [reportWeekDate, setReportWeekDate] = useState(() => formatDateYMD(new Date()));
  const [serverHoraUTC, setServerHoraUTC] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(HORA_SERVER_UTC_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return null;
  });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timerId;
    const tick = () => {
      const next = new Date();
      setNow(next);
      const delay = 1000 - next.getMilliseconds();
      timerId = setTimeout(tick, delay);
    };
    tick();
    return () => clearTimeout(timerId);
  }, []);
  const fechaActual = useMemo(() => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [now]);
  const horaActual = useMemo(() => {
    return formatTimeHMS(now);
  }, [now]);
  const selectedReportWeek = useMemo(() => {
    const selectedDate = parseLocalDate(reportWeekDate) || new Date();
    return getWeekRange(selectedDate);
  }, [reportWeekDate]);
  const weekLabel = `${formatDateDMY(selectedReportWeek.start)} al ${formatDateDMY(
    selectedReportWeek.end
  )}`;

  const persistServerHoraUTC = (value) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HORA_SERVER_UTC_STORAGE_KEY, value ? "true" : "false");
  };

  const updateServerHoraUTC = (value) => {
    setServerHoraUTC(value);
    persistServerHoraUTC(value);
  };

  const getDisplayDateTime = (record) => {
    const fecha = record?.fecha || "";
    const hora = record?.hora || "";
    if (serverHoraUTC !== true) return { fecha, hora };
    if (record?._syncStatus === "pending") return { fecha, hora };
    const converted = convertUtcToLocalDateTime(fecha, hora);
    return converted ?? { fecha, hora };
  };

  const applyDisplayFields = (rows = []) =>
    rows.map((row) => {
      const { fecha, hora } = getDisplayDateTime(row);
      return { ...row, _displayFecha: fecha, _displayHora: hora };
    });

  const controlesDisplay = useMemo(
    () => applyDisplayFields(controles),
    [controles, serverHoraUTC]
  );

  useEffect(() => {
    if (serverHoraUTC !== null) return;
    const sample = controles.find(
      (control) => control?.hora && (control?.created_at || control?.updated_at)
    );
    if (!sample) return;
    const guess = detectServerHoraUtcFromRecord(sample);
    if (guess !== null) {
      updateServerHoraUTC(guess);
    }
  }, [controles, serverHoraUTC]);


  const getTratadaIndicatorColor = (value, { min, max, lt } = {}) => {
    if (value === null || value === undefined || value === "") return "inherit";
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return "inherit";
    const outOfRange =
      typeof lt === "number" ? numeric >= lt : numeric < min || numeric > max;
    return outOfRange ? theme.palette.error.main : "inherit";
  };

  const selectedRecord = useMemo(
    () => controlesDisplay.find((control) => control.id === selectedRecordId) || null,
    [controlesDisplay, selectedRecordId]
  );
  const editingDisplay = useMemo(() => {
    if (!editingRecord) return { fecha: "", hora: "" };
    return getDisplayDateTime(editingRecord);
  }, [editingRecord, serverHoraUTC]);
  const logoSrc = useMemo(() => getSociedadLogoSrc(user), [user]);
  const sociedadName = useMemo(
    () => getSociedadName(user, sociedadesCatalog),
    [user, sociedadesCatalog]
  );

  const pendingCount = useMemo(
    () => controles.filter((control) => control._syncStatus === "pending").length,
    [controles]
  );
  const pendingCountRef = useRef(pendingCount);
  const loadingCountRef = useRef(0);
  const submitGuardRef = useRef(false);
  const activeSubmitKeyRef = useRef("");
  const lastSavedSubmitRef = useRef({ key: "", at: 0 });
  const pendingNoticeSeverity = isOnline ? "info" : "warning";
  const pendingNoticeMessage = useMemo(() => {
    if (pendingCount === 0) return "";
    if (isOnline) {
      return `Sincronizando ${pendingCount} registro${pendingCount === 1 ? "" : "s"} pendiente${
        pendingCount === 1 ? "" : "s"
      }...`;
    }
    return pendingCount === 1
      ? "Registro pendiente de envío. Se enviará automáticamente cuando vuelva el internet."
      : `Hay ${pendingCount} registros pendientes de envío. Se enviarán automáticamente cuando vuelva el internet.`;
  }, [isOnline, pendingCount]);

  const handleReportWeekDateChange = (event) => {
    const nextValue = event.target.value || fechaActual;
    setReportWeekDate(nextValue > fechaActual ? fechaActual : nextValue);
  };

  const handleUseCurrentReportWeek = () => {
    setReportWeekDate(fechaActual);
  };

  const buildSubmitKey = () =>
    JSON.stringify([
      user?.username || "",
      puntoMuestreo,
      observaciones,
      cruda.ph,
      cruda.conductividad,
      cruda.turbidez,
      decantada.ph,
      decantada.conductividad,
      decantada.turbidez,
      tratada.ph,
      tratada.conductividad,
      tratada.turbidez,
      tratada.cloro,
    ].map((value) => String(value ?? "").trim()));

  const openEdit = (control) => {
    setEditError("");
    setEditingRecord(control);
    setEditValues({
      punto_muestreo: control.punto_muestreo || "",
      observaciones: control.observaciones || "",
      cruda: {
        ph: control.cruda?.ph ?? "",
        conductividad: control.cruda?.conductividad ?? "",
        turbidez: control.cruda?.turbidez ?? "",
      },
      decantada: {
        ph: control.decantada?.ph ?? "",
        conductividad: control.decantada?.conductividad ?? "",
        turbidez: control.decantada?.turbidez ?? "",
      },
      tratada: {
        ph: control.tratada?.ph ?? "",
        conductividad: control.tratada?.conductividad ?? "",
        turbidez: control.tratada?.turbidez ?? "",
        cloro: control.tratada?.cloro ?? "",
      },
    });
  };

  const closeEdit = () => {
    setEditingRecord(null);
    setEditValues(null);
    setEditError("");
  };

  const openSelectedEdit = () => {
    if (!selectedRecord) return;
    openEdit(selectedRecord);
  };

  const buildUpdatePayload = (includeReadonlyFields = false) => {
    const editablePayload = {
      punto_muestreo: editValues?.punto_muestreo ?? "",
      observaciones: editValues?.observaciones ?? "",
      cruda: {
        ph: parseNumber(editValues?.cruda?.ph),
        conductividad: parseNumber(editValues?.cruda?.conductividad),
        turbidez: parseNumber(editValues?.cruda?.turbidez),
      },
      decantada: {
        ph: parseNumber(editValues?.decantada?.ph),
        conductividad: parseNumber(editValues?.decantada?.conductividad),
        turbidez: parseNumber(editValues?.decantada?.turbidez),
      },
      tratada: {
        ph: parseNumber(editValues?.tratada?.ph),
        conductividad: parseNumber(editValues?.tratada?.conductividad),
        turbidez: parseNumber(editValues?.tratada?.turbidez),
        cloro: parseNumber(editValues?.tratada?.cloro),
      },
    };

    if (!includeReadonlyFields || !editingRecord) return editablePayload;

    return {
      fecha: editingRecord.fecha,
      hora: editingRecord.hora,
      encargado: editingRecord.encargado,
      ...editablePayload,
    };
  };

  const extractApiErrorMessage = (err, fallbackMessage) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (typeof first?.msg === "string" && first.msg.trim()) return first.msg;
    }
    return fallbackMessage;
  };
  const buildErrorDetail = (err) => {
    const baseURL = getApiBaseURL();
    const status = err?.response?.status;
    const pieces = [];
    if (status) {
      pieces.push(`HTTP ${status}`);
    } else if (err?.message) {
      pieces.push(err.message);
    }
    if (baseURL) {
      pieces.push(`URL: ${baseURL}`);
    }
    return pieces.join(" | ");
  };

  const refreshRegistros = async () => {
    loadingCountRef.current += 1;
    setIsLoading(true);
    try {
      const data = await getRegistros({
        user,
        includeAllUsers: isAdmin,
        ownerFilter: isAdmin ? null : undefined,
      });
      setControles(data);
    } finally {
      loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
      if (loadingCountRef.current === 0) {
        setIsLoading(false);
      }
    }
  };

  const showPdfNotice = (severity, message) => {
    setPdfNotice({ open: true, severity, message });
  };

  const showExcelNotice = (severity, message) => {
    setExcelNotice({ open: true, severity, message });
  };

  const getWeekRowsFromSource = (rows = [], range = getWeekRange(new Date())) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const weekRows = safeRows.filter((row) => {
      const displayFecha = row?._displayFecha ?? row?.fecha;
      const date = parseLocalDate(displayFecha);
      if (!date) return false;
      return date >= range.start && date <= range.end;
    });
    return { range, weekRows };
  };

  const loadWeeklyExportRows = async () => {
    const online = await getOnlineStatus();
    if (!online) {
      return { online: false, rows: [] };
    }

    const rows = await getRegistros({ user, includeAllUsers: true });
    return { online: true, rows: applyDisplayFields(rows) };
  };

  const buildWeeklyPdf = (rows, range, logoUrl, sociedadLabel) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 32;
    const marginTop = 28;
    const marginBottom = 36;
    const tableWidth = pageWidth - marginX * 2;
    const palette = {
      primary: [37, 99, 235],
      primarySoft: [239, 246, 255],
      textDark: [15, 23, 42],
      textMuted: [100, 116, 139],
      border: [226, 232, 240],
      rowAlt: [248, 250, 252],
      header: [241, 245, 249],
      cruda: [223, 243, 230],
      decantada: [255, 240, 194],
      tratada: [221, 235, 255],
    };

    const columns = [
      { key: "fecha", label: "Fecha", width: 48, align: "center" },
      { key: "hora", label: "Hora", width: 40, align: "center" },
      { key: "cruda_ph", label: "pH", width: 26, align: "center" },
      { key: "cruda_cond", label: "Cond\n(uS/cm2)", width: 44, align: "center" },
      { key: "cruda_turb", label: "Turb\n(NTU)", width: 40, align: "center" },
      { key: "dec_ph", label: "pH", width: 26, align: "center" },
      { key: "dec_cond", label: "Cond\n(uS/cm2)", width: 44, align: "center" },
      { key: "dec_turb", label: "Turb\n(NTU)", width: 40, align: "center" },
      { key: "trat_ph", label: "pH", width: 26, align: "center" },
      { key: "trat_cond", label: "Cond\n(uS/cm2)", width: 44, align: "center" },
      { key: "trat_turb", label: "Turb\n(NTU)", width: 40, align: "center" },
      { key: "trat_cloro", label: "Cloro\n(ppm)", width: 34, align: "center" },
      { key: "punto_muestreo", label: "Punto", width: 70, align: "left" },
      { key: "encargado", label: "Encargado", width: 70, align: "left" },
      { key: "observaciones", label: "Observaciones", width: 120, align: "left" },
    ];

    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    if (totalWidth !== tableWidth) {
      const delta = tableWidth - totalWidth;
      columns[columns.length - 1].width += delta;
    }

    const headerTopHeight = 18;
    const headerBottomHeight = 22;
    const totalHeaderHeight = headerTopHeight + headerBottomHeight;
    const rowHeight = 18;

    const columnPositions = [];
    let cursorX = marginX;
    columns.forEach((col) => {
      columnPositions.push({ ...col, x: cursorX });
      cursorX += col.width;
    });

    const fitText = (text, maxWidth) => {
      const value = String(text ?? "");
      if (!value) return "";
      if (doc.getTextWidth(value) <= maxWidth) return value;
      const ellipsis = "...";
      const ellipsisWidth = doc.getTextWidth(ellipsis);
      if (ellipsisWidth >= maxWidth) return "";
      let end = value.length;
      while (end > 0 && doc.getTextWidth(value.slice(0, end)) + ellipsisWidth > maxWidth) {
        end -= 1;
      }
      if (end <= 0) return value.slice(0, 1);
      return `${value.slice(0, end)}${ellipsis}`;
    };

    const drawCellText = (text, col, baselineY, options = {}) => {
      const padding = options.padding ?? 4;
      const align = col.align || "left";
      const safeText = fitText(text, Math.max(0, col.width - padding * 2));
      if (align === "center") {
        doc.text(safeText, col.x + col.width / 2, baselineY, { align: "center" });
        return;
      }
      if (align === "right") {
        doc.text(safeText, col.x + col.width - padding, baselineY, {
          align: "right",
        });
        return;
      }
      doc.text(safeText, col.x + padding, baselineY);
    };

    let y = marginTop;
    const headerHeight = 56;

    doc.setFillColor(...palette.primarySoft);
    doc.rect(marginX, y, tableWidth, headerHeight, "F");
    doc.setFillColor(...palette.primary);
    doc.rect(marginX, y, tableWidth, 3, "F");

    const logoSize = 32;
    const textStartX = logoUrl ? marginX + 12 + logoSize + 8 : marginX + 12;

    if (logoUrl) {
      try {
        doc.addImage(logoUrl, "PNG", marginX + 12, y + 12, logoSize, logoSize);
      } catch {
        // ignore logo render errors
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...palette.textDark);
    doc.text("Reporte semanal de registros", textStartX, y + 26);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...palette.textMuted);
    doc.text(`Sociedad: ${sociedadLabel}`, textStartX, y + 44);

    const generatedAt = new Date();
    const badgeY = y + 18;
    const badges = [
      `Semana: ${formatDateDMY(range.start)} al ${formatDateDMY(range.end)}`,
      `Generado: ${formatDateDMY(generatedAt)} ${formatTimeHM(generatedAt)}`,
      `Registros: ${rows.length}`,
    ];

    let badgeX = marginX + tableWidth - 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    badges
      .slice()
      .reverse()
      .forEach((label) => {
        const paddingX = 6;
        const textWidth = doc.getTextWidth(label);
        const badgeWidth = textWidth + paddingX * 2;
        badgeX -= badgeWidth;
        doc.setFillColor(...palette.header);
        doc.roundedRect(badgeX, badgeY, badgeWidth, 16, 6, 6, "F");
        doc.setTextColor(...palette.textDark);
        doc.text(label, badgeX + paddingX, badgeY + 11);
        badgeX -= 8;
      });

    y += headerHeight + 14;

    const renderHeader = () => {
      const columnByKey = Object.fromEntries(columnPositions.map((col) => [col.key, col]));

      const headerGroups = [
        { label: "Fecha", keys: ["fecha"], spanRows: true, fill: palette.header },
        { label: "Hora", keys: ["hora"], spanRows: true, fill: palette.header },
        { label: "Agua Cruda", keys: ["cruda_ph", "cruda_cond", "cruda_turb"], fill: palette.cruda },
        { label: "Agua Decantada", keys: ["dec_ph", "dec_cond", "dec_turb"], fill: palette.decantada },
        {
          label: "Agua Tratada",
          keys: ["trat_ph", "trat_cond", "trat_turb", "trat_cloro"],
          fill: palette.tratada,
        },
        { label: "Punto\nmuestreado", keys: ["punto_muestreo"], spanRows: true, fill: palette.header },
        { label: "Encargado\nde la Planta", keys: ["encargado"], spanRows: true, fill: palette.header },
        { label: "Observaciones", keys: ["observaciones"], spanRows: true, fill: palette.header },
      ];

      let x = marginX;
      doc.setFont("helvetica", "bold");
      headerGroups.forEach((group) => {
        const groupWidth = group.keys.reduce((sum, key) => sum + columnByKey[key].width, 0);
        doc.setFillColor(...(group.fill || palette.header));
        const height = group.spanRows ? totalHeaderHeight : headerTopHeight;
        doc.rect(x, y, groupWidth, height, "F");
        doc.setTextColor(...palette.textDark);
        const groupFontSize =
          group.spanRows && groupWidth < 80 ? 7.4 : 8.5;
        doc.setFontSize(groupFontSize);
        if (group.spanRows && group.label.includes("\n")) {
          const lines = group.label.split("\n");
          const lineHeight = groupFontSize + 1.2;
          const totalTextHeight = lineHeight * (lines.length - 1);
          const startY = y + totalHeaderHeight / 2 - totalTextHeight / 2 + 3;
          lines.forEach((line, index) => {
            doc.text(line, x + groupWidth / 2, startY + index * lineHeight, {
              align: "center",
            });
          });
        } else {
          const textY = group.spanRows ? y + totalHeaderHeight / 2 + 3 : y + 11;
          doc.text(group.label, x + groupWidth / 2, textY, { align: "center" });
        }
        x += groupWidth;
      });

      let subX = marginX;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      headerGroups.forEach((group) => {
        const groupWidth = group.keys.reduce((sum, key) => sum + columnByKey[key].width, 0);
        if (group.spanRows) {
          subX += groupWidth;
          return;
        }

        group.keys.forEach((key) => {
          const col = columnByKey[key];
          doc.setFillColor(...(group.fill || palette.header));
          doc.rect(subX, y + headerTopHeight, col.width, headerBottomHeight, "F");
          doc.setTextColor(...palette.textMuted);
          const labelLines = String(col.label ?? "").split("\n");
          if (labelLines.length > 1) {
            const lineHeight = 7.4;
            const totalTextHeight = lineHeight * (labelLines.length - 1);
            const startY =
              y + headerTopHeight + headerBottomHeight / 2 - totalTextHeight / 2 + 2.5;
            labelLines.forEach((line, index) => {
              const safeLine = fitText(line, Math.max(0, col.width - 4));
              doc.text(safeLine, subX + col.width / 2, startY + index * lineHeight, {
                align: "center",
              });
            });
          } else {
            const safeLabel = fitText(labelLines[0], Math.max(0, col.width - 4));
            doc.text(safeLabel, subX + col.width / 2, y + headerTopHeight + 14, {
              align: "center",
            });
          }
          subX += col.width;
        });
      });

      doc.setDrawColor(...palette.border);
      doc.setLineWidth(0.5);
      columnPositions.forEach((col) => {
        doc.line(col.x, y, col.x, y + totalHeaderHeight);
      });
      doc.line(marginX + tableWidth, y, marginX + tableWidth, y + totalHeaderHeight);

      doc.setDrawColor(...palette.border);
      doc.line(marginX, y + totalHeaderHeight, marginX + tableWidth, y + totalHeaderHeight);
      doc.setFont("helvetica", "normal");
      y += totalHeaderHeight;
    };

    const formatValue = (value) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "number") return String(value);
      return String(value);
    };

    const renderRow = (row, rowIndex) => {
      const displayFecha = row?._displayFecha ?? row?.fecha;
      const displayHora = row?._displayHora ?? row?.hora;
      const rowValues = [
        displayFecha || "",
        displayHora || "",
        formatValue(row.cruda?.ph),
        formatValue(row.cruda?.conductividad),
        formatValue(row.cruda?.turbidez),
        formatValue(row.decantada?.ph),
        formatValue(row.decantada?.conductividad),
        formatValue(row.decantada?.turbidez),
        formatValue(row.tratada?.ph),
        formatValue(row.tratada?.conductividad),
        formatValue(row.tratada?.turbidez),
        formatValue(row.tratada?.cloro),
        row.punto_muestreo || "",
        row.encargado || "",
        row.observaciones ?? "",
      ];

      if (rowIndex % 2 === 1) {
        doc.setFillColor(...palette.rowAlt);
        doc.rect(marginX, y, tableWidth, rowHeight, "F");
      }

      doc.setFontSize(8);
      doc.setTextColor(...palette.textDark);
      rowValues.forEach((value, index) => {
        const col = columnPositions[index];
        drawCellText(value ?? "", col, y + 12);
      });
      doc.setDrawColor(...palette.border);
      doc.setLineWidth(0.5);
      columnPositions.forEach((col) => {
        doc.line(col.x, y, col.x, y + rowHeight);
      });
      doc.line(marginX + tableWidth, y, marginX + tableWidth, y + rowHeight);
      doc.setDrawColor(...palette.border);
      doc.line(marginX, y + rowHeight, marginX + tableWidth, y + rowHeight);
      y += rowHeight;
    };

    renderHeader();

    rows.forEach((row, index) => {
      if (y + rowHeight > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
        doc.setFillColor(...palette.primarySoft);
        doc.rect(marginX, y, tableWidth, headerHeight, "F");
        doc.setFillColor(...palette.primary);
        doc.rect(marginX, y, tableWidth, 3, "F");
        const pageTextStartX = logoUrl ? marginX + 12 + logoSize + 8 : marginX + 12;
        if (logoUrl) {
          try {
            doc.addImage(logoUrl, "PNG", marginX + 12, y + 12, logoSize, logoSize);
          } catch {
            // ignore logo render errors
          }
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...palette.textDark);
        doc.text("Reporte semanal de registros", pageTextStartX, y + 26);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...palette.textMuted);
        doc.text(`Sociedad: ${sociedadLabel}`, pageTextStartX, y + 44);
        y += headerHeight + 14;
        renderHeader();
      }
      renderRow(row, index);
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...palette.textMuted);
      doc.text(`Control de Agua Potable | Sociedad: ${sociedadLabel}`, marginX, pageHeight - 16);
      doc.text(`Pagina ${page} de ${totalPages}`, marginX + tableWidth, pageHeight - 16, {
        align: "right",
      });
    }

    return doc;
  };

  const buildWeeklyExcelWorkbook = (rows = [], range = getWeekRange(new Date()), sociedadLabel = "") => {
    const toExcelValue = (value) => {
      if (value === null || value === undefined || value === "") return "";
      if (typeof value === "number" && Number.isFinite(value)) return value;
      const text = String(value).trim();
      if (!text) return "";
      const normalized = text.replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : text;
    };

    const header = [
      "Fecha",
      "Hora",
      "Cruda pH",
      "Cruda Conductividad (uS/cm2)",
      "Cruda Turbidez (NTU)",
      "Decantada pH",
      "Decantada Conductividad (uS/cm2)",
      "Decantada Turbidez (NTU)",
      "Tratada pH",
      "Tratada Conductividad (uS/cm2)",
      "Tratada Turbidez (NTU)",
      "Tratada Cloro (ppm)",
      "Punto muestreado",
      "Encargado",
      "Observaciones",
    ];

    const dataRows = rows.map((row) => [
      (row?._displayFecha ?? row?.fecha) || "",
      (row?._displayHora ?? row?.hora) || "",
      toExcelValue(row.cruda?.ph),
      toExcelValue(row.cruda?.conductividad),
      toExcelValue(row.cruda?.turbidez),
      toExcelValue(row.decantada?.ph),
      toExcelValue(row.decantada?.conductividad),
      toExcelValue(row.decantada?.turbidez),
      toExcelValue(row.tratada?.ph),
      toExcelValue(row.tratada?.conductividad),
      toExcelValue(row.tratada?.turbidez),
      toExcelValue(row.tratada?.cloro),
      row.punto_muestreo || "",
      row.encargado || "",
      row.observaciones ?? "",
    ]);

    const generatedAt = new Date();
    const metadataRows = [
      ["Reporte semanal de registros"],
      ["Sociedad", sociedadLabel || "No especificada"],
      ["Semana", `${formatDateDMY(range.start)} al ${formatDateDMY(range.end)}`],
      ["Generado", `${formatDateDMY(generatedAt)} ${formatTimeHM(generatedAt)}`],
      ["Registros", rows.length],
      [],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([...metadataRows, header, ...dataRows]);
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }];
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 8 },
      { wch: 10 },
      { wch: 22 },
      { wch: 18 },
      { wch: 12 },
      { wch: 26 },
      { wch: 18 },
      { wch: 12 },
      { wch: 26 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 40 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Semana");
    return workbook;
  };

  const handleDownloadWeeklyPdf = async () => {
    if (pdfBusy) return;
    if (excelBusy) {
      showPdfNotice("info", "Espera a que termine la descarga del Excel.");
      return;
    }
    setPdfBusy(true);
    try {
      const range = selectedReportWeek;
      const { online, rows: sourceRows } = await loadWeeklyExportRows();

      if (!online) {
        showPdfNotice("warning", "Conectate a internet para descargar el PDF con todos los registros.");
        return;
      }

      const { weekRows } = getWeekRowsFromSource(sourceRows, range);

      if (!weekRows.length) {
        showPdfNotice("info", "No hay registros para la semana seleccionada.");
        return;
      }

      const doc = buildWeeklyPdf(weekRows, range, logoDataUrl, sociedadName);
      const filename = `reporte_semanal_${formatDateYMD(range.start)}_al_${formatDateYMD(
        range.end
      )}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const dataUri = doc.output("datauristring");
        const base64 = dataUri.split(",")[1] || "";
        const folder = "PTAP_CATV/reportes";

        if (Capacitor.getPlatform() === "android") {
          try {
            const permission = await Filesystem.requestPermissions();
            const values = Object.values(permission || {});
            const granted =
              values.length === 0 ||
              values.some((value) => value === "granted" || value === "limited");
            if (!granted) {
              showPdfNotice(
                "warning",
                "Permiso de almacenamiento denegado. Actívalo para guardar el PDF en Archivos."
              );
              return;
            }
          } catch {
            showPdfNotice(
              "warning",
              "No se pudo solicitar permiso de almacenamiento. Revisa los permisos de la app."
            );
            return;
          }
        }

        try {
          await Filesystem.writeFile({
            path: `${folder}/${filename}`,
            data: base64,
            directory: Directory.Documents,
            recursive: true,
          });
          showPdfNotice("success", `PDF guardado en Documentos/${folder}/${filename}`);
        } catch {
          try {
            await Filesystem.writeFile({
              path: `${folder}/${filename}`,
              data: base64,
              directory: Directory.Data,
              recursive: true,
            });
            showPdfNotice(
              "warning",
              "No se pudo guardar en Archivos. El PDF quedó dentro de la app."
            );
          } catch {
            showPdfNotice("error", "No se pudo guardar el PDF en el teléfono.");
          }
        }
      } else {
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        showPdfNotice("success", "PDF descargado.");
      }
    } catch {
      showPdfNotice("error", "No se pudo generar el PDF semanal.");
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownloadWeeklyExcel = async () => {
    if (excelBusy) return;
    if (pdfBusy) {
      showExcelNotice("info", "Espera a que termine la descarga del PDF.");
      return;
    }
    setExcelBusy(true);
    try {
      const range = selectedReportWeek;
      const { online, rows: sourceRows } = await loadWeeklyExportRows();

      if (!online) {
        showExcelNotice("warning", "Conectate a internet para descargar el Excel con todos los registros.");
        return;
      }

      const { weekRows } = getWeekRowsFromSource(sourceRows, range);

      if (!weekRows.length) {
        showExcelNotice("info", "No hay registros para la semana seleccionada.");
        return;
      }

      const workbook = buildWeeklyExcelWorkbook(weekRows, range, sociedadName);
      const filename = `reporte_semanal_${formatDateYMD(range.start)}_al_${formatDateYMD(
        range.end
      )}.xlsx`;

      if (Capacitor.isNativePlatform()) {
        if (Capacitor.getPlatform() === "android") {
          try {
            const permission = await Filesystem.requestPermissions();
            const values = Object.values(permission || {});
            const granted =
              values.length === 0 ||
              values.some((value) => value === "granted" || value === "limited");
            if (!granted) {
              showExcelNotice(
                "warning",
                "Permiso de almacenamiento denegado. Actívalo para guardar el Excel en Archivos."
              );
              return;
            }
          } catch {
            showExcelNotice(
              "warning",
              "No se pudo solicitar permiso de almacenamiento. Revisa los permisos de la app."
            );
            return;
          }
        }

        const base64 = XLSX.write(workbook, { bookType: "xlsx", type: "base64" });
        const folder = "PTAP_CATV/reportes";

        try {
          await Filesystem.writeFile({
            path: `${folder}/${filename}`,
            data: base64,
            directory: Directory.Documents,
            recursive: true,
          });
          showExcelNotice("success", `Excel guardado en Documentos/${folder}/${filename}`);
        } catch {
          try {
            await Filesystem.writeFile({
              path: `${folder}/${filename}`,
              data: base64,
              directory: Directory.Data,
              recursive: true,
            });
            showExcelNotice(
              "warning",
              "No se pudo guardar en Archivos. El Excel quedó dentro de la app."
            );
          } catch {
            showExcelNotice("error", "No se pudo guardar el Excel en el teléfono.");
          }
        }
      } else {
        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        showExcelNotice("success", "Excel descargado.");
      }
    } catch {
      showExcelNotice("error", "No se pudo generar el Excel semanal.");
    } finally {
      setExcelBusy(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingRecord || !editValues) return;
    setEditSubmitting(true);
    setEditError("");
    try {
      const payloadEditable = buildUpdatePayload(false);
      const payloadFull = buildUpdatePayload(true);
      const numericValues = [
        payloadEditable.cruda.ph,
        payloadEditable.cruda.conductividad,
        payloadEditable.cruda.turbidez,
        payloadEditable.decantada.ph,
        payloadEditable.decantada.conductividad,
        payloadEditable.decantada.turbidez,
        payloadEditable.tratada.ph,
        payloadEditable.tratada.conductividad,
        payloadEditable.tratada.turbidez,
        payloadEditable.tratada.cloro,
      ];

      if (numericValues.some((value) => Number.isNaN(value))) {
        setEditError("Completa todos los campos numéricos antes de guardar.");
        return;
      }

      const synced = await updateRegistro(editingRecord, payloadEditable, payloadFull, { user });
      if (synced === false) {
        setOfflineNoticeOpen(true);
      }

      await refreshRegistros();
      closeEdit();
    } catch (err) {
      setEditError(extractApiErrorMessage(err, "No se pudo actualizar el registro."));
    } finally {
      setEditSubmitting(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let cleanupSync = () => {};
    let cleanupNetwork = () => {};

    const boot = async () => {
      try {
        const cleanup = await initOffline({
          user,
          ownerFilter: isAdmin ? null : undefined,
        });
        cleanupSync = typeof cleanup === "function" ? cleanup : () => {};
      } catch {
        cleanupSync = () => {};
      }

      try {
        const online = await getOnlineStatus();
        if (isMounted) {
          setIsOnline(online);
        }
      } catch {
        // ignore
      }

      cleanupNetwork = onNetworkStatusChange((status) => {
        if (!isMounted) return;
        setIsOnline(status);
        if (status) {
          refreshRegistros().catch(() => {});
        }
      });

      refreshRegistros().catch((err) => console.log(err));
    };

    boot();

    return () => {
      isMounted = false;
      cleanupSync?.();
      cleanupNetwork?.();
    };
  }, [user?.username, user?.role, user?.rol, isAdmin]);

  useEffect(() => {
    let active = true;

    const loadSociedadesCatalog = async () => {
      if (!isAdmin) {
        setSociedadesCatalog([]);
        return;
      }

      try {
        const response = await api.get("/api/control-aguas/sociedades");
        if (!active) return;
        const items = Array.isArray(response?.data) ? response.data : [];
        setSociedadesCatalog(items);
      } catch {
        if (active) {
          setSociedadesCatalog([]);
        }
      }
    };

    loadSociedadesCatalog();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (pendingCount > 0) {
      setOfflineNoticeOpen(true);
      return;
    }
    setOfflineNoticeOpen(false);
  }, [pendingCount]);

  useEffect(() => {
    const prev = pendingCountRef.current;
    if (isOnline && prev > 0 && pendingCount < prev) {
      const sent = prev - pendingCount;
      const message =
        pendingCount === 0
          ? sent === 1
            ? "Registro enviado correctamente."
            : `Se enviaron ${sent} registros correctamente.`
          : `Se enviaron ${sent} registro${sent === 1 ? "" : "s"}. Quedan ${pendingCount} pendiente${
              pendingCount === 1 ? "" : "s"
            }.`;
      setSyncNotice({ open: true, message, severity: "success" });
    }
    pendingCountRef.current = pendingCount;
  }, [isOnline, pendingCount]);

  useEffect(() => {
    let active = true;
    const loadLogo = async () => {
      if (!logoSrc) {
        setLogoDataUrl("");
        return;
      }
      if (String(logoSrc).startsWith("data:")) {
        setLogoDataUrl(logoSrc);
        return;
      }
      try {
        const response = await fetch(logoSrc);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!active) return;
          if (typeof reader.result === "string") {
            setLogoDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        if (active) {
          setLogoDataUrl("");
        }
      }
    };

    loadLogo();
    return () => {
      active = false;
    };
  }, [logoSrc]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const submitKey = buildSubmitKey();
    const lastSaved = lastSavedSubmitRef.current;
    const isRepeatedRecentSubmit =
      lastSaved.key === submitKey &&
      Date.now() - lastSaved.at < DUPLICATE_SUBMIT_WINDOW_MS;

    if (
      submitting ||
      submitGuardRef.current ||
      activeSubmitKeyRef.current === submitKey ||
      isRepeatedRecentSubmit
    ) {
      return;
    }
    submitGuardRef.current = true;
    activeSubmitKeyRef.current = submitKey;
    setError("");
    setErrorDetail("");
    setSubmitting(true);
    try {
      const timestamp = new Date();
      const fechaRegistro = formatDateYMD(timestamp);
      const horaRegistro = formatTimeHMS(timestamp);
      setNow(timestamp);
      const payload = {
        fecha: fechaRegistro,
        hora: horaRegistro,
        punto_muestreo: puntoMuestreo,
        encargado: user?.username || "",
        observaciones,
        cruda: {
          ph: parseNumber(cruda.ph),
          conductividad: parseNumber(cruda.conductividad),
          turbidez: parseNumber(cruda.turbidez),
        },
        decantada: {
          ph: parseNumber(decantada.ph),
          conductividad: parseNumber(decantada.conductividad),
          turbidez: parseNumber(decantada.turbidez),
        },
        tratada: {
          ph: parseNumber(tratada.ph),
          conductividad: parseNumber(tratada.conductividad),
          turbidez: parseNumber(tratada.turbidez),
          cloro: parseNumber(tratada.cloro),
        },
      };

      const numericValues = [
        payload.cruda.ph,
        payload.cruda.conductividad,
        payload.cruda.turbidez,
        payload.decantada.ph,
        payload.decantada.conductividad,
        payload.decantada.turbidez,
        payload.tratada.ph,
        payload.tratada.conductividad,
        payload.tratada.turbidez,
        payload.tratada.cloro,
      ];

      if (numericValues.some((value) => Number.isNaN(value))) {
        setError("Completa todos los campos numéricos con valores válidos.");
        return;
      }

      const created = await createRegistro(payload, { user });
      lastSavedSubmitRef.current = { key: submitKey, at: Date.now() };
      const utcGuess = detectServerHoraUtc(horaRegistro, created?.hora);
      if (utcGuess !== null) {
        updateServerHoraUTC(utcGuess);
      }
      if (created?._syncStatus === "pending") {
        setOfflineNoticeOpen(true);
      }

      setPuntoMuestreo("");
      setCruda({ ph: "", conductividad: "", turbidez: "" });
      setDecantada({ ph: "", conductividad: "", turbidez: "" });
      setTratada({ ph: "", conductividad: "", turbidez: "", cloro: "" });
      setObservaciones("");

      await refreshRegistros();
    } catch (err) {
      console.error("createRegistro failed", err);
      setError(extractApiErrorMessage(err, "No se pudo guardar el registro. Revisa los datos."));
      setErrorDetail(buildErrorDetail(err));
    } finally {
      setSubmitting(false);
      submitGuardRef.current = false;
      activeSubmitKeyRef.current = "";
    }
  };

  return (
    <Box className={`tc-root ${isLoading ? "is-loading" : ""}`}>
      {!isOnline && (
        <Paper elevation={0} className="tc-offline-card">
          <Box className="tc-offline-row">
            <Box>
              <Typography variant="subtitle1" className="tc-offline-title">
                Sin conexion
              </Typography>
              <Typography variant="body2" className="tc-offline-text">
                Los registros se guardan localmente y se enviaran automaticamente al volver el internet.
              </Typography>
            </Box>
            {pendingCount > 0 && (
              <Chip
                label={`${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}`}
                size="small"
                className="tc-offline-chip"
              />
            )}
          </Box>
        </Paper>
      )}
      <Paper elevation={0} className="tc-form-card">
        <Stack spacing={0.5} alignItems="center" className="tc-form-header">
          <Box className="tc-form-heading">
            <Typography variant="h6" className="tc-form-title">
              Nuevo registro
            </Typography>
            <Typography variant="body2" className="tc-form-subtitle">
              Completa los datos del muestreo
            </Typography>
          </Box>
          <Chip
            label={`Fecha ${fechaActual}`}
            size="small"
            className="tc-form-datechip"
          />
        </Stack>
        <Divider className="tc-section-divider" />

        <form onSubmit={handleSubmit}>
          <Box className="tc-form-grid">
            <TextField
              label="Fecha"
              value={fechaActual}
              fullWidth
              disabled
              size="small"
              className="tc-compact-field"
            />
            <TextField
              label="Hora"
              value={horaActual}
              fullWidth
              disabled
              size="small"
              className="tc-compact-field"
            />
            <Box className="tc-form-spacer" />
            <Box className="tc-form-spacer" />
            <TextField
              label="Punto de muestreo"
              value={puntoMuestreo}
              onChange={(e) => setPuntoMuestreo(e.target.value)}
              fullWidth
              className="tc-field-span"
              required
              size="small"
            />
            <TextField
              label="Encargado"
              value={user?.username || ""}
              fullWidth
              disabled
              size="small"
            />
          </Box>

          <Box className="tc-section-grid">
            <Paper
              variant="outlined"
              className="tc-section-card tc-section-card--cruda"
            >
              <Typography
                variant="subtitle1"
                className="tc-section-title"
              >
                Agua Cruda
              </Typography>
              <Box className="tc-metrics-grid tc-metrics-grid--3">
                <TextField
                  label="pH"
                  type="number"
                  value={cruda.ph}
                  onChange={(e) => setCruda({ ...cruda, ph: e.target.value })}
                  fullWidth
                  required
                  size="small"
                />
                <TextField
                  label="Conductividad (uS/cm2)"
                  type="number"
                  value={cruda.conductividad}
                  onChange={(e) => setCruda({ ...cruda, conductividad: e.target.value })}
                  fullWidth
                  required
                  size="small"
                />
                <TextField
                  label="Turbidez (NTU)"
                  type="number"
                  value={cruda.turbidez}
                  onChange={(e) => setCruda({ ...cruda, turbidez: e.target.value })}
                  fullWidth
                  required
                  size="small"
                />
              </Box>
            </Paper>

            <Paper
              variant="outlined"
              className="tc-section-card tc-section-card--decantada"
            >
              <Typography
                variant="subtitle1"
                className="tc-section-title"
              >
                Agua Decantada
              </Typography>
              <Box className="tc-metrics-grid tc-metrics-grid--3">
                <TextField
                  label="pH"
                  type="number"
                  value={decantada.ph}
                  onChange={(e) => setDecantada({ ...decantada, ph: e.target.value })}
                  fullWidth
                  required
                  size="small"
                />
                <TextField
                  label="Conductividad (uS/cm2)"
                  type="number"
                  value={decantada.conductividad}
                  onChange={(e) =>
                    setDecantada({
                      ...decantada,
                      conductividad: e.target.value,
                    })
                  }
                  fullWidth
                  required
                  size="small"
                />
                <TextField
                  label="Turbidez (NTU)"
                  type="number"
                  value={decantada.turbidez}
                  onChange={(e) => setDecantada({ ...decantada, turbidez: e.target.value })}
                  fullWidth
                  required
                  size="small"
                />
              </Box>
            </Paper>

            <Paper
              variant="outlined"
              className="tc-section-card tc-section-card--tratada"
            >
              <Typography
                variant="subtitle1"
                className="tc-section-title"
              >
                Agua Tratada
              </Typography>
              <Box className="tc-metrics-grid tc-metrics-grid--4">
                <TextField
                  label="pH"
                  type="number"
                  value={tratada.ph}
                  onChange={(e) => setTratada({ ...tratada, ph: e.target.value })}
                  fullWidth
                  required
                  size="small"
                  inputProps={{
                    style: {
                      color: getTratadaIndicatorColor(tratada.ph, { min: 6.5, max: 8.5 }),
                      WebkitTextFillColor: getTratadaIndicatorColor(tratada.ph, { min: 6.5, max: 8.5 }),
                    },
                  }}
                />
                <TextField
                  label="Conductividad (uS/cm2)"
                  type="number"
                  value={tratada.conductividad}
                  onChange={(e) =>
                    setTratada({
                      ...tratada,
                      conductividad: e.target.value,
                    })
                  }
                  fullWidth
                  required
                  size="small"
                  inputProps={{
                    style: {
                      color: getTratadaIndicatorColor(tratada.conductividad, { lt: 400 }),
                      WebkitTextFillColor: getTratadaIndicatorColor(tratada.conductividad, { lt: 400 }),
                    },
                  }}
                />
                <TextField
                  label="Turbidez (NTU)"
                  type="number"
                  value={tratada.turbidez}
                  onChange={(e) => setTratada({ ...tratada, turbidez: e.target.value })}
                  fullWidth
                  required
                  size="small"
                  inputProps={{
                    style: {
                      color: getTratadaIndicatorColor(tratada.turbidez, { min: 0, max: 5 }),
                      WebkitTextFillColor: getTratadaIndicatorColor(tratada.turbidez, { min: 0, max: 5 }),
                    },
                  }}
                />
                <TextField
                  label="Cloro (ppm)"
                  type="number"
                  value={tratada.cloro}
                  onChange={(e) => setTratada({ ...tratada, cloro: e.target.value })}
                  fullWidth
                  required
                  size="small"
                  inputProps={{
                    style: {
                      color: getTratadaIndicatorColor(tratada.cloro, { min: 0.5, max: 1.5 }),
                      WebkitTextFillColor: getTratadaIndicatorColor(tratada.cloro, { min: 0.5, max: 1.5 }),
                    },
                  }}
                />
              </Box>
            </Paper>
          </Box>

          <Paper
            variant="outlined"
            className="tc-section-card tc-section-card--neutral tc-observations-card"
          >
            <Typography variant="subtitle1" className="tc-section-title">
              Observaciones
            </Typography>
            <TextField
              placeholder="Escribe observaciones relevantes del muestreo"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              size="small"
            />
          </Paper>

          {error && (
            <Box className="tc-error-block">
              <Typography color="error" variant="body2">
                {error}
              </Typography>
              {errorDetail && (
                <Typography color="text.secondary" variant="caption">
                  {errorDetail}
                </Typography>
              )}
            </Box>
          )}

          <Box className="tc-form-actions">
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              size="large"
              className={`tc-primary-action tc-form-submit ${submitting ? "is-busy" : ""}`}
            >
              {submitting ? "Guardando..." : "Guardar registro"}
            </Button>
          </Box>
        </form>
      </Paper>

      <Paper elevation={0} className="tc-list-card">
        <Box className="tc-hero-wrapper">
          <Box className="tc-hero-bar">
            <Box>
              <Typography variant="h6" className="tc-hero-title">
                Registros
              </Typography>
              <Typography variant="body2" className="tc-hero-subtitle">
                Resumen semanal de muestreos
              </Typography>
            </Box>
            <Chip
              label={`Semana ${weekLabel}`}
              size="small"
              className="tc-hero-chip"
            />
          </Box>
        </Box>

        <Box className="tc-report-filter">
          <TextField
            label="Semana del reporte"
            type="date"
            value={reportWeekDate}
            onChange={handleReportWeekDateChange}
            size="small"
            className="tc-report-week-field"
            inputProps={{ max: fechaActual }}
            InputLabelProps={{ shrink: true }}
          />
          <Chip
            label={`Descarga ${weekLabel}`}
            size="small"
            className="tc-report-week-chip"
          />
          <Button
            type="button"
            variant="outlined"
            onClick={handleUseCurrentReportWeek}
            size="medium"
            className="tc-tertiary-action tc-report-current-action"
          >
            Semana actual
          </Button>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
          className="tc-actions"
        >
          <Button
            variant="contained"
            onClick={handleDownloadWeeklyPdf}
            disabled={pdfBusy}
            size="large"
            className={`tc-primary-action ${pdfBusy ? "is-busy" : ""}`}
          >
            {pdfBusy ? "Generando PDF..." : "Descargar PDF semanal"}
          </Button>
          <Button
            variant="contained"
            onClick={handleDownloadWeeklyExcel}
            disabled={excelBusy}
            size="large"
            className={`tc-primary-action ${excelBusy ? "is-busy" : ""}`}
          >
            {excelBusy ? "Generando Excel..." : "Descargar Excel semanal"}
          </Button>
          <Button
            variant="contained"
            onClick={openSelectedEdit}
            disabled={!selectedRecord}
            size="large"
            className="tc-primary-action"
          >
            Editar registro seleccionado
          </Button>
        </Stack>

        <Box className="tc-mobile-list">
          <Stack spacing={2}>
            {controlesDisplay.map((control) => (
              <Paper
                key={`card-${control.id}`}
                variant="outlined"
                onClick={() => setSelectedRecordId(control.id)}
                className={`tc-card ${selectedRecordId === control.id ? "is-selected" : ""}`}
              >
                <Stack spacing={1.25}>
                  <Box className="tc-card-header">
                    <Typography variant="subtitle2" className="tc-card-title">
                      {(control._displayFecha ?? control.fecha) || ""} ·{" "}
                      {(control._displayHora ?? control.hora) || ""}
                    </Typography>
                    <Box className="tc-card-chip-row">
                      <Chip
                        label={control.punto_muestreo}
                        size="small"
                        variant="outlined"
                        className="tc-card-chip"
                      />
                      <Chip
                        label={`Encargado: ${control.encargado}`}
                        size="small"
                        variant="outlined"
                        className="tc-card-chip"
                      />
                    </Box>
                  </Box>
                  <Divider className="tc-card-divider" />
                  <Box className="tc-card-sections">
                    <Box className="tc-mobile-section tc-mobile-section--cruda">
                      <Typography
                        variant="subtitle2"
                        className="tc-mobile-section-title tc-mobile-section-title--cruda"
                      >
                        Agua Cruda
                      </Typography>
                      <Stack spacing={0} divider={<Divider className="tc-mobile-divider" />}>
                        {[
                          ["pH", control.cruda?.ph],
                          ["Conductividad", control.cruda?.conductividad],
                          ["Turbidez", control.cruda?.turbidez],
                        ].map(([label, value], idx) => (
                          <Box
                            key={`${label}-${idx}`}
                            className="tc-mobile-metric-row"
                          >
                            <Typography variant="body2" className="tc-mobile-metric-label">
                              {label}
                            </Typography>
                            <Typography variant="body2" className="tc-mobile-metric-value">
                              {value}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                    <Box className="tc-mobile-section tc-mobile-section--decantada">
                      <Typography
                        variant="subtitle2"
                        className="tc-mobile-section-title tc-mobile-section-title--decantada"
                      >
                        Agua Decantada
                      </Typography>
                      <Stack spacing={0} divider={<Divider className="tc-mobile-divider" />}>
                        {[
                          ["pH", control.decantada?.ph],
                          ["Conductividad", control.decantada?.conductividad],
                          ["Turbidez", control.decantada?.turbidez],
                        ].map(([label, value], idx) => (
                          <Box
                            key={`${label}-${idx}`}
                            className="tc-mobile-metric-row"
                          >
                            <Typography variant="body2" className="tc-mobile-metric-label">
                              {label}
                            </Typography>
                            <Typography variant="body2" className="tc-mobile-metric-value">
                              {value}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                    <Box className="tc-mobile-section tc-mobile-section--tratada">
                      <Typography
                        variant="subtitle2"
                        className="tc-mobile-section-title tc-mobile-section-title--tratada"
                      >
                        Agua Tratada
                      </Typography>
                      <Stack spacing={0} divider={<Divider className="tc-mobile-divider" />}>
                        {[
                          ["pH", control.tratada?.ph, { min: 7, max: 8 }],
                          ["Conductividad", control.tratada?.conductividad, { lt: 400 }],
                          ["Turbidez", control.tratada?.turbidez, { min: 0, max: 5 }],
                          ["Cloro", control.tratada?.cloro, { min: 0.5, max: 1.5 }],
                        ].map(([label, value, range], idx) => (
                          <Box
                            key={`${label}-${idx}`}
                            className="tc-mobile-metric-row"
                          >
                            <Typography variant="body2" className="tc-mobile-metric-label">
                              {label}
                            </Typography>
                            <Typography
                              variant="body2"
                              className="tc-mobile-metric-value"
                              style={{ color: getTratadaIndicatorColor(value, range) }}
                            >
                              {value}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                    <Box className="tc-mobile-observations">
                      <Typography variant="subtitle2" className="tc-mobile-observations-title">
                        Observaciones
                      </Typography>
                      <Typography variant="body2" className="tc-mobile-observations-text">
                        {control.observaciones?.trim() || "Sin observaciones"}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>

        <Box className="tc-table-wrapper">
          <TableContainer
            component={Paper}
            variant="outlined"
            className="tc-table-container"
          >
            <Table
              size="small"
              className="tc-table"
            >
              <TableHead className="tc-table-head">
                <TableRow>
                  <TableCell
                    rowSpan={2}
                    align="center"
                    className="font-bold border tc-th--neutral"
                  >
                    Fecha
                  </TableCell>
                  <TableCell
                    rowSpan={2}
                    align="center"
                    className="font-bold border tc-th--neutral"
                  >
                    Hora
                  </TableCell>
                  <TableCell
                    colSpan={3}
                    align="center"
                    className="font-bold border tc-th--cruda"
                  >
                    Agua Cruda
                  </TableCell>
                  <TableCell
                    colSpan={3}
                    align="center"
                    className="font-bold border tc-th--decantada"
                  >
                    Agua Decantada
                  </TableCell>
                  <TableCell
                    colSpan={4}
                    align="center"
                    className="font-bold border tc-th--tratada"
                  >
                    Agua Tratada
                  </TableCell>
                  <TableCell
                    rowSpan={2}
                    align="center"
                    className="font-bold border tc-th--neutral"
                  >
                    Punto muestreado
                  </TableCell>
                  <TableCell
                    rowSpan={2}
                    align="center"
                    className="font-bold border tc-th--neutral"
                  >
                    Encargado de la Planta
                  </TableCell>
                  <TableCell
                    rowSpan={2}
                    align="center"
                    className="font-bold border tc-th--neutral"
                  >
                    Observaciones
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell
                    align="center"
                    className="border tc-th--cruda"
                  >
                    pH
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border tc-th--cruda"
                  >
                    Conductividad (uS/cm2)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border tc-th--cruda"
                  >
                    Turbidez (NTU)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border tc-th--decantada"
                  >
                    pH
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border tc-th--decantada"
                  >
                    Conductividad (uS/cm2)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border tc-th--decantada"
                  >
                    Turbidez (NTU)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border tc-th--tratada"
                  >
                    pH
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border tc-th--tratada"
                  >
                    Conductividad (uS/cm2)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border tc-th--tratada"
                  >
                    Turbidez (NTU)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border tc-th--tratada"
                  >
                    Cloro (ppm)
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody className="tc-table-body">
                {controlesDisplay.map((control) => (
                  <TableRow
                    key={`registro-${control.id}`}
                    hover
                    onClick={() => setSelectedRecordId(control.id)}
                    selected={selectedRecordId === control.id}
                    className="tc-row"
                  >
                    <TableCell className="border">
                      {(control._displayFecha ?? control.fecha) || ""}
                    </TableCell>
                    <TableCell className="border">
                      {(control._displayHora ?? control.hora) || ""}
                    </TableCell>
                    <TableCell className="border">{control.cruda?.ph}</TableCell>
                    <TableCell className="border">
                      {control.cruda?.conductividad}
                    </TableCell>
                    <TableCell className="border">{control.cruda?.turbidez}</TableCell>
                    <TableCell className="border">{control.decantada?.ph}</TableCell>
                    <TableCell className="border">
                      {control.decantada?.conductividad}
                    </TableCell>
                    <TableCell className="border">
                      {control.decantada?.turbidez}
                    </TableCell>
                <TableCell className="border">
                  <Box
                    component="span"
                    style={{ color: getTratadaIndicatorColor(control.tratada?.ph, { min: 7, max: 8 }) }}
                  >
                    {control.tratada?.ph}
                  </Box>
                </TableCell>
                <TableCell className="border">
                  <Box
                    component="span"
                    style={{ color: getTratadaIndicatorColor(control.tratada?.conductividad, { lt: 400 }) }}
                  >
                    {control.tratada?.conductividad}
                  </Box>
                </TableCell>
                <TableCell className="border">
                  <Box
                    component="span"
                    style={{ color: getTratadaIndicatorColor(control.tratada?.turbidez, { min: 0, max: 5 }) }}
                  >
                    {control.tratada?.turbidez}
                  </Box>
                </TableCell>
                <TableCell className="border">
                  <Box
                    component="span"
                    style={{ color: getTratadaIndicatorColor(control.tratada?.cloro, { min: 0.5, max: 1.5 }) }}
                  >
                    {control.tratada?.cloro}
                  </Box>
                </TableCell>
                <TableCell className="border">{control.punto_muestreo}</TableCell>
                <TableCell className="border">{control.encargado}</TableCell>
                <TableCell
                  className="border tc-cell-observations"
                >
                  {control.observaciones || ""}
                </TableCell>
              </TableRow>
            ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>

      <Dialog
        open={Boolean(editingRecord)}
        onClose={closeEdit}
        fullWidth
        maxWidth="md"
        PaperProps={{ className: "tc-edit-dialog" }}
      >
        <DialogTitle className="tc-edit-title">Editar registro</DialogTitle>
        <DialogContent dividers className="tc-edit-content">
          {editingRecord && editValues && (
            <Box className="tc-edit-grid">
              <Box className="tc-edit-form">
                <TextField
                  label="Fecha"
                  value={editingDisplay.fecha || editingRecord.fecha || ""}
                  fullWidth
                  disabled
                  size="small"
                />
                <TextField
                  label="Hora"
                  value={editingDisplay.hora || editingRecord.hora || ""}
                  fullWidth
                  disabled
                  size="small"
                />
                <TextField
                  label="Punto de muestreo"
                  value={editValues.punto_muestreo}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, punto_muestreo: e.target.value }))
                  }
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Encargado"
                  value={editingRecord.encargado}
                  fullWidth
                  disabled
                  size="small"
                />
                <TextField
                  label="Observaciones"
                  value={editValues.observaciones}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, observaciones: e.target.value }))
                  }
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  className="tc-edit-span"
                />
              </Box>

              <Paper
                variant="outlined"
                className="tc-section-card tc-section-card--cruda"
              >
                <Typography variant="subtitle1" className="tc-section-title">
                  Agua Cruda
                </Typography>
                <Box className="tc-metrics-grid tc-metrics-grid--3">
                  <TextField
                    label="pH"
                    type="number"
                    value={editValues.cruda.ph}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        cruda: { ...prev.cruda, ph: e.target.value },
                      }))
                    }
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Conductividad (uS/cm2)"
                    type="number"
                    value={editValues.cruda.conductividad}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        cruda: { ...prev.cruda, conductividad: e.target.value },
                      }))
                    }
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Turbidez (NTU)"
                    type="number"
                    value={editValues.cruda.turbidez}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        cruda: { ...prev.cruda, turbidez: e.target.value },
                      }))
                    }
                    fullWidth
                    size="small"
                  />
                </Box>
              </Paper>

              <Paper
                variant="outlined"
                className="tc-section-card tc-section-card--decantada"
              >
                <Typography variant="subtitle1" className="tc-section-title">
                  Agua Decantada
                </Typography>
                <Box className="tc-metrics-grid tc-metrics-grid--3">
                  <TextField
                    label="pH"
                    type="number"
                    value={editValues.decantada.ph}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        decantada: { ...prev.decantada, ph: e.target.value },
                      }))
                    }
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Conductividad (uS/cm2)"
                    type="number"
                    value={editValues.decantada.conductividad}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        decantada: { ...prev.decantada, conductividad: e.target.value },
                      }))
                    }
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Turbidez (NTU)"
                    type="number"
                    value={editValues.decantada.turbidez}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        decantada: { ...prev.decantada, turbidez: e.target.value },
                      }))
                    }
                    fullWidth
                    size="small"
                  />
                </Box>
              </Paper>

              <Paper
                variant="outlined"
                className="tc-section-card tc-section-card--tratada"
              >
                <Typography variant="subtitle1" className="tc-section-title">
                  Agua Tratada
                </Typography>
                <Box className="tc-metrics-grid tc-metrics-grid--4">
                  <TextField
                    label="pH"
                    type="number"
                    value={editValues.tratada.ph}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        tratada: { ...prev.tratada, ph: e.target.value },
                      }))
                    }
                    fullWidth
                    size="small"
                    inputProps={{
                      style: {
                        color: getTratadaIndicatorColor(editValues.tratada.ph, { min: 7, max: 8 }),
                        WebkitTextFillColor: getTratadaIndicatorColor(editValues.tratada.ph, { min: 7, max: 8 }),
                      },
                    }}
                  />
                  <TextField
                    label="Conductividad (uS/cm2)"
                    type="number"
                    value={editValues.tratada.conductividad}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        tratada: { ...prev.tratada, conductividad: e.target.value },
                      }))
                    }
                    fullWidth
                    size="small"
                    inputProps={{
                      style: {
                        color: getTratadaIndicatorColor(editValues.tratada.conductividad, { lt: 400 }),
                        WebkitTextFillColor: getTratadaIndicatorColor(editValues.tratada.conductividad, { lt: 400 }),
                      },
                    }}
                  />
                  <TextField
                    label="Turbidez (NTU)"
                    type="number"
                    value={editValues.tratada.turbidez}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        tratada: { ...prev.tratada, turbidez: e.target.value },
                      }))
                    }
                    fullWidth
                    size="small"
                    inputProps={{
                      style: {
                        color: getTratadaIndicatorColor(editValues.tratada.turbidez, { min: 0, max: 5 }),
                        WebkitTextFillColor: getTratadaIndicatorColor(editValues.tratada.turbidez, { min: 0, max: 5 }),
                      },
                    }}
                  />
                  <TextField
                    label="Cloro (ppm)"
                    type="number"
                    value={editValues.tratada.cloro}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        tratada: { ...prev.tratada, cloro: e.target.value },
                      }))
                    }
                    fullWidth
                    size="small"
                    inputProps={{
                      style: {
                        color: getTratadaIndicatorColor(editValues.tratada.cloro, { min: 0.5, max: 1.5 }),
                        WebkitTextFillColor: getTratadaIndicatorColor(editValues.tratada.cloro, { min: 0.5, max: 1.5 }),
                      },
                    }}
                  />
                </Box>
              </Paper>

              {editError && (
                <Typography color="error" variant="body2">
                  {editError}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions className="tc-edit-actions">
          <Button onClick={closeEdit} variant="outlined" className="tc-tertiary-action">
            Cancelar
          </Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            disabled={editSubmitting}
            className={`tc-primary-action ${editSubmitting ? "is-busy" : ""}`}
          >
            {editSubmitting ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={offlineNoticeOpen}
        onClose={() => setOfflineNoticeOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={pendingNoticeSeverity}
          variant="filled"
          onClose={() => setOfflineNoticeOpen(false)}
          className="tc-snackbar-alert"
        >
          {pendingNoticeMessage}
        </Alert>
      </Snackbar>
      <Snackbar
        open={syncNotice.open}
        autoHideDuration={7000}
        onClose={() => setSyncNotice((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={syncNotice.severity}
          variant="filled"
          onClose={() => setSyncNotice((prev) => ({ ...prev, open: false }))}
          className="tc-snackbar-alert"
        >
          {syncNotice.message}
        </Alert>
      </Snackbar>
      <Snackbar
        open={pdfNotice.open}
        autoHideDuration={7000}
        onClose={() => setPdfNotice((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={pdfNotice.severity}
          variant="filled"
          onClose={() => setPdfNotice((prev) => ({ ...prev, open: false }))}
          className="tc-snackbar-alert"
        >
          {pdfNotice.message}
        </Alert>
      </Snackbar>
      <Snackbar
        open={excelNotice.open}
        autoHideDuration={7000}
        onClose={() => setExcelNotice((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={excelNotice.severity}
          variant="filled"
          onClose={() => setExcelNotice((prev) => ({ ...prev, open: false }))}
          className="tc-snackbar-alert"
        >
          {excelNotice.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
