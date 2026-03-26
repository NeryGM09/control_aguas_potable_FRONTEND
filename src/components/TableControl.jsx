import React, { useEffect, useMemo, useRef, useState } from "react";
import { getApiBaseURL } from "../api/api";
import {
  createRegistro,
  getOnlineStatus,
  getRegistros,
  initOffline,
  onNetworkStatusChange,
  syncNow,
  updateRegistro,
} from "../offline/registroService";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { jsPDF } from "jspdf";
import { getSociedadLogoSrc } from "../utils/sociedadLogo";
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

const parseNumber = (value) => {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  if (!text) return Number.NaN;
  const normalized = text.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const formatDateYMD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

const truncateText = (value, max) => {
  const text = String(value ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
};

export default function TableControl() {
  const { user } = useAuth();
  const theme = useTheme();
  const [controles, setControles] = useState([]);
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
  const [syncNotice, setSyncNotice] = useState({ open: false, message: "", severity: "success" });
  const [logoDataUrl, setLogoDataUrl] = useState("");

  const now = useMemo(() => new Date(), []);
  const fechaActual = useMemo(() => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [now]);
  const horaActual = useMemo(() => {
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, [now]);
  const currentWeek = getWeekRange(new Date());
  const weekLabel = `${formatDateDMY(currentWeek.start)} al ${formatDateDMY(currentWeek.end)}`;

  const categoryColors = {
    cruda: { bg: "#DFF3E6", border: "#34A56F", text: "#0B5134" },
    decantada: { bg: "#FFF0C2", border: "#E0A100", text: "#7A4E00" },
    tratada: { bg: "#DDEBFF", border: "#3B82F6", text: "#0B3B6E" },
  };

  const getTratadaIndicatorColor = (value, { min, max, lt } = {}) => {
    if (value === null || value === undefined || value === "") return "inherit";
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return "inherit";
    const outOfRange =
      typeof lt === "number" ? numeric >= lt : numeric < min || numeric > max;
    return outOfRange ? theme.palette.error.main : "inherit";
  };

  const selectedRecord = useMemo(
    () => controles.find((control) => control.id === selectedRecordId) || null,
    [controles, selectedRecordId]
  );
  const logoSrc = useMemo(() => getSociedadLogoSrc(user), [user]);

  const pendingCount = useMemo(
    () => controles.filter((control) => control._syncStatus === "pending").length,
    [controles]
  );
  const pendingCountRef = useRef(pendingCount);
  const submitGuardRef = useRef(false);
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
    const data = await getRegistros({ user });
    setControles(data);
  };

  const showPdfNotice = (severity, message) => {
    setPdfNotice({ open: true, severity, message });
  };

  const buildWeeklyPdf = (rows, range, logoUrl) => {
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
      { key: "cruda_cond", label: "Cond (uS/cm2)", width: 44, align: "center" },
      { key: "cruda_turb", label: "Turb (NTU)", width: 40, align: "center" },
      { key: "dec_ph", label: "pH", width: 26, align: "center" },
      { key: "dec_cond", label: "Cond (uS/cm2)", width: 44, align: "center" },
      { key: "dec_turb", label: "Turb (NTU)", width: 40, align: "center" },
      { key: "trat_ph", label: "pH", width: 26, align: "center" },
      { key: "trat_cond", label: "Cond (uS/cm2)", width: 44, align: "center" },
      { key: "trat_turb", label: "Turb (NTU)", width: 40, align: "center" },
      { key: "trat_cloro", label: "Cloro (ppm)", width: 34, align: "center" },
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
    const headerBottomHeight = 18;
    const totalHeaderHeight = headerTopHeight + headerBottomHeight;
    const rowHeight = 18;

    const columnPositions = [];
    let cursorX = marginX;
    columns.forEach((col) => {
      columnPositions.push({ ...col, x: cursorX });
      cursorX += col.width;
    });

    const getColumn = (key) => columnPositions.find((col) => col.key === key);

    const drawCellText = (text, col, baselineY, options = {}) => {
      const padding = options.padding ?? 4;
      const align = col.align || "left";
      if (align === "center") {
        doc.text(String(text ?? ""), col.x + col.width / 2, baselineY, { align: "center" });
        return;
      }
      if (align === "right") {
        doc.text(String(text ?? ""), col.x + col.width - padding, baselineY, {
          align: "right",
        });
        return;
      }
      doc.text(String(text ?? ""), col.x + padding, baselineY);
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
      } catch (err) {
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
    doc.text("Control de Agua Potable", textStartX, y + 44);

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
        const paddingY = 4;
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
          doc.text(col.label, subX + col.width / 2, y + headerTopHeight + 12, {
            align: "center",
          });
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
      const rowValues = [
        row.fecha || "",
        row.hora || "",
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
        truncateText(row.punto_muestreo, 18),
        truncateText(row.encargado, 14),
        truncateText(row.observaciones ?? "", 32),
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
          } catch (err) {
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
        doc.text(
          `Semana: ${formatDateDMY(range.start)} al ${formatDateDMY(range.end)}`,
          pageTextStartX,
          y + 44
        );
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
      doc.text("Control de Agua Potable", marginX, pageHeight - 16);
      doc.text(`Pagina ${page} de ${totalPages}`, marginX + tableWidth, pageHeight - 16, {
        align: "right",
      });
    }

    return doc;
  };

  const handleDownloadWeeklyPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const online = await getOnlineStatus();
      if (!online) {
        showPdfNotice("warning", "Conectate a internet para descargar el PDF semanal.");
        return;
      }

      await syncNow({ user });
      const data = await getRegistros({ user });
      const range = getWeekRange(new Date());
      const weekRows = (data || []).filter((row) => {
        const date = parseLocalDate(row.fecha);
        if (!date) return false;
        return date >= range.start && date <= range.end;
      });

      if (!weekRows.length) {
        showPdfNotice("info", "No hay registros para la semana actual.");
        return;
      }

      const doc = buildWeeklyPdf(weekRows, range, logoDataUrl);
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
          } catch (err) {
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
        } catch (err) {
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
          } catch (innerErr) {
            showPdfNotice("error", "No se pudo guardar el PDF en el teléfono.");
          }
        }
      } else {
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        showPdfNotice("success", "PDF descargado.");
      }
    } catch (err) {
      showPdfNotice("error", "No se pudo generar el PDF semanal.");
    } finally {
      setPdfBusy(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingRecord || !editValues) return;
    setEditSubmitting(true);
    setEditError("");
    try {
      const id = editingRecord.id;
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
        const cleanup = await initOffline({ user });
        cleanupSync = typeof cleanup === "function" ? cleanup : () => {};
      } catch (err) {
        cleanupSync = () => {};
      }

      try {
        const online = await getOnlineStatus();
        if (isMounted) {
          setIsOnline(online);
        }
      } catch (err) {
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
  }, [user?.username, user?.role]);

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
      } catch (err) {
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
    if (submitting || submitGuardRef.current) {
      return;
    }
    submitGuardRef.current = true;
    setError("");
    setErrorDetail("");
    setSubmitting(true);
    try {
      const payload = {
        fecha: fechaActual,
        hora: horaActual,
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
    }
  };

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 3, md: 4 },
        alignItems: "stretch",
      }}
    >
      {!isOnline && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            border: "1px solid rgba(248, 113, 113, 0.35)",
            background: "linear-gradient(120deg, #fff7ed 0%, #fff1f2 100%)",
            boxShadow: "0 10px 24px rgba(248, 113, 113, 0.15)",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#9a3412" }}>
                Sin conexion
              </Typography>
              <Typography variant="body2" sx={{ color: "#9a3412" }}>
                Los registros se guardan localmente y se enviaran automaticamente al volver el internet.
              </Typography>
            </Box>
            {pendingCount > 0 && (
              <Chip
                label={`${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}`}
                size="small"
                sx={{ backgroundColor: "#fed7aa", color: "#9a3412", fontWeight: 600 }}
              />
            )}
          </Stack>
        </Paper>
      )}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2, md: 3 },
          borderRadius: 3,
          border: "1px solid rgba(148, 163, 184, 0.3)",
          boxShadow: "0 10px 24px rgba(30, 64, 175, 0.08)",
          width: "100%",
          background: "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)",
        }}
      >
        <Stack spacing={0.5} alignItems="center">
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "0.2px", color: "#0f172a" }}>
              Nuevo registro
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Completa los datos del muestreo
            </Typography>
          </Box>
          <Chip
            label={`Fecha ${fechaActual}`}
            size="small"
            sx={{ display: { xs: "none", sm: "inline-flex" } }}
          />
        </Stack>
        <Divider sx={{ my: 2 }} />

        <form onSubmit={handleSubmit}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr" },
              mb: 2,
            }}
          >
            <TextField
              label="Fecha"
              value={fechaActual}
              fullWidth
              disabled
              size="small"
              sx={{
                "& .MuiInputBase-input": { fontSize: { xs: 13.5, sm: 15 } },
                "& .MuiInputLabel-root": { fontSize: { xs: 12, sm: 13 } },
              }}
            />
            <TextField
              label="Hora"
              value={horaActual}
              fullWidth
              disabled
              size="small"
              sx={{
                "& .MuiInputBase-input": { fontSize: { xs: 13.5, sm: 15 } },
                "& .MuiInputLabel-root": { fontSize: { xs: 12, sm: 13 } },
              }}
            />
            <Box sx={{ display: { xs: "none", sm: "block" } }} />
            <Box sx={{ display: { xs: "none", sm: "block" } }} />
            <TextField
              label="Punto de muestreo"
              value={puntoMuestreo}
              onChange={(e) => setPuntoMuestreo(e.target.value)}
              fullWidth
              sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
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

          <Box sx={{ display: "grid", gap: 2 }}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                borderColor: "rgba(148, 163, 184, 0.35)",
                backgroundColor: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
                borderTop: `3px solid ${categoryColors.cruda.border}`,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}
              >
                Agua Cruda
              </Typography>
              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
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
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                borderColor: "rgba(148, 163, 184, 0.35)",
                backgroundColor: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
                borderTop: `3px solid ${categoryColors.decantada.border}`,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}
              >
                Agua Decantada
              </Typography>
              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
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
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                borderColor: "rgba(148, 163, 184, 0.35)",
                backgroundColor: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
                borderTop: `3px solid ${categoryColors.tratada.border}`,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}
              >
                Agua Tratada
              </Typography>
              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" } }}>
                <TextField
                  label="pH"
                  type="number"
                  value={tratada.ph}
                  onChange={(e) => setTratada({ ...tratada, ph: e.target.value })}
                  fullWidth
                  required
                  size="small"
                  sx={{
                    "& .MuiInputBase-input": {
                      color: getTratadaIndicatorColor(tratada.ph, { min: 7, max: 8 }),
                    },
                  }}
                  inputProps={{
                    style: {
                      color: getTratadaIndicatorColor(tratada.ph, { min: 7, max: 8 }),
                      WebkitTextFillColor: getTratadaIndicatorColor(tratada.ph, { min: 7, max: 8 }),
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
                  sx={{
                    "& .MuiInputBase-input": {
                      color: getTratadaIndicatorColor(tratada.conductividad, { lt: 400 }),
                    },
                  }}
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
                  sx={{
                    "& .MuiInputBase-input": {
                      color: getTratadaIndicatorColor(tratada.turbidez, { min: 0, max: 5 }),
                    },
                  }}
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
                  sx={{
                    "& .MuiInputBase-input": {
                      color: getTratadaIndicatorColor(tratada.cloro, { min: 0.5, max: 1.5 }),
                    },
                  }}
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
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderRadius: 2,
              borderColor: "rgba(148, 163, 184, 0.35)",
              backgroundColor: "rgba(255, 255, 255, 0.7)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
              borderTop: "3px solid rgba(148, 163, 184, 0.55)",
              mt: 2,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
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
            <Box sx={{ mt: 2 }}>
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

          <Box sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-end" }, mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              {submitting ? "Guardando..." : "Guardar registro"}
            </Button>
          </Box>
        </form>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          border: "1px solid rgba(148, 163, 184, 0.3)",
          boxShadow: "0 10px 24px rgba(30, 64, 175, 0.08)",
          width: "100%",
          background: "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)",
        }}
      >
        <Box
          sx={{
            position: { xs: "sticky", md: "static" },
            top: { xs: 0, md: "auto" },
            zIndex: 2,
            backgroundColor: { xs: "#ffffff", md: "transparent" },
            py: { xs: 1, md: 0 },
            mb: { xs: 1, md: 2 },
            borderBottom: { xs: "1px solid rgba(148, 163, 184, 0.3)", md: "none" },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Registros
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Semana actual: {weekLabel}
              </Typography>
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <Button
                variant="contained"
                onClick={handleDownloadWeeklyPdf}
                disabled={pdfBusy}
              >
                {pdfBusy ? "Generando PDF..." : "Descargar PDF semanal"}
              </Button>
              <Button variant="outlined" onClick={openSelectedEdit} disabled={!selectedRecord}>
                Editar registro seleccionado
              </Button>
            </Stack>
          </Box>
        </Box>

        <Box sx={{ display: { xs: "block", md: "none" } }}>
          <Stack spacing={2}>
            {controles.map((control) => (
              <Paper
                key={`card-${control.id}`}
                variant="outlined"
                onClick={() => setSelectedRecordId(control.id)}
                sx={{
                  p: { xs: 1.75, sm: 2 },
                  cursor: "pointer",
                  borderRadius: 2.5,
                  border:
                    selectedRecordId === control.id
                      ? "1px solid rgba(37, 99, 235, 0.7)"
                      : "1px solid rgba(148, 163, 184, 0.4)",
                  backgroundColor: "rgba(255, 255, 255, 0.72)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  boxShadow:
                    selectedRecordId === control.id
                      ? "inset 4px 0 0 #2563eb, 0 10px 24px rgba(37, 99, 235, 0.16)"
                      : "0 8px 18px rgba(15, 23, 42, 0.08)",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <Stack spacing={1.25}>
                  <Box sx={{ display: "grid", gap: 0.5, textAlign: "left" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: "0.2px", color: "#0f172a" }}>
                      {control.fecha} · {control.hora}
                    </Typography>
                    <Box sx={{ display: "flex", justifyContent: "flex-start", gap: 1, flexWrap: "wrap" }}>
                      <Chip
                        label={control.punto_muestreo}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip
                        label={`Encargado: ${control.encargado}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                  </Box>
                  <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.3)" }} />
                  <Box sx={{ display: "grid", gap: 1 }}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.75,
                        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                        border: "1px solid rgba(148, 163, 184, 0.35)",
                        borderTop: `3px solid ${categoryColors.cruda.border}`,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700, color: categoryColors.cruda.text, mb: 0.5 }}
                      >
                        Agua Cruda
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          border: "1px solid rgba(148, 163, 184, 0.25)",
                          borderRadius: 1,
                          overflow: "hidden",
                          backgroundColor: "#ffffff",
                        }}
                      >
                        {[
                          ["pH", control.cruda?.ph],
                          ["Conductividad", control.cruda?.conductividad],
                          ["Turbidez", control.cruda?.turbidez],
                        ].map(([label, value], idx, arr) => (
                          <Box
                            key={`${label}-${idx}`}
                            sx={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 0.5,
                              px: 1,
                              py: 0.6,
                              borderBottom:
                                idx === arr.length - 1
                                  ? "none"
                                  : "1px solid rgba(148, 163, 184, 0.2)",
                              fontSize: 13.25,
                            }}
                          >
                            <Typography variant="body2" sx={{ color: "#475569" }}>
                              {label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a" }}>
                              {value}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.75,
                        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                        border: "1px solid rgba(148, 163, 184, 0.35)",
                        borderTop: `3px solid ${categoryColors.decantada.border}`,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700, color: categoryColors.decantada.text, mb: 0.5 }}
                      >
                        Agua Decantada
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          border: "1px solid rgba(148, 163, 184, 0.25)",
                          borderRadius: 1,
                          overflow: "hidden",
                          backgroundColor: "#ffffff",
                        }}
                      >
                        {[
                          ["pH", control.decantada?.ph],
                          ["Conductividad", control.decantada?.conductividad],
                          ["Turbidez", control.decantada?.turbidez],
                        ].map(([label, value], idx, arr) => (
                          <Box
                            key={`${label}-${idx}`}
                            sx={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 0.5,
                              px: 1,
                              py: 0.6,
                              borderBottom:
                                idx === arr.length - 1
                                  ? "none"
                                  : "1px solid rgba(148, 163, 184, 0.2)",
                              fontSize: 13.25,
                            }}
                          >
                            <Typography variant="body2" sx={{ color: "#475569" }}>
                              {label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a" }}>
                              {value}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.75,
                        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                        border: "1px solid rgba(148, 163, 184, 0.35)",
                        borderTop: `3px solid ${categoryColors.tratada.border}`,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700, color: categoryColors.tratada.text, mb: 0.5 }}
                      >
                        Agua Tratada
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          border: "1px solid rgba(148, 163, 184, 0.25)",
                          borderRadius: 1,
                          overflow: "hidden",
                          backgroundColor: "#ffffff",
                        }}
                      >
                        {[
                          ["pH", control.tratada?.ph, { min: 7, max: 8 }],
                          ["Conductividad", control.tratada?.conductividad, { lt: 400 }],
                          ["Turbidez", control.tratada?.turbidez, { min: 0, max: 5 }],
                          ["Cloro", control.tratada?.cloro, { min: 0.5, max: 1.5 }],
                        ].map(([label, value, range], idx, arr) => (
                          <Box
                            key={`${label}-${idx}`}
                            sx={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 0.5,
                              px: 1,
                              py: 0.6,
                              borderBottom:
                                idx === arr.length - 1
                                  ? "none"
                                  : "1px solid rgba(148, 163, 184, 0.2)",
                              fontSize: 13.25,
                            }}
                          >
                            <Typography variant="body2" sx={{ color: "#475569" }}>
                              {label}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: getTratadaIndicatorColor(value, range),
                              }}
                            >
                              {value}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.75,
                        backgroundColor: "rgba(255, 255, 255, 0.7)",
                        border: "1px solid rgba(148, 163, 184, 0.3)",
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: "#0f172a" }}>
                        Observaciones
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#0f172a", whiteSpace: "pre-wrap" }}>
                        {control.observaciones?.trim() || "Sin observaciones"}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>

        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              overflowX: "auto",
              width: "100%",
              borderRadius: 2.5,
              border: "1px solid rgba(148, 163, 184, 0.45)",
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              boxShadow: "0 14px 30px rgba(15, 23, 42, 0.08)",
            }}
          >
            <Table
              size="small"
              sx={{
                minWidth: 1120,
                borderCollapse: "separate",
                borderSpacing: 0,
                "& th, & td": {
                  borderColor: "rgba(148, 163, 184, 0.4)",
                  px: 1.5,
                  py: 1,
                },
                "& th": {
                  fontSize: 12.5,
                  letterSpacing: "0.3px",
                },
                "& td": {
                  fontSize: 13.5,
                },
              }}
            >
              <TableHead
                sx={{
                  "& th": {
                    fontWeight: 700,
                    color: "#0f172a",
                    borderBottom: "1px solid rgba(148, 163, 184, 0.55)",
                  },
                }}
              >
                <TableRow>
                  <TableCell
                    rowSpan={2}
                    align="center"
                    className="font-bold border"
                    sx={{ backgroundColor: "#f8fafc" }}
                  >
                    Fecha
                  </TableCell>
                  <TableCell
                    rowSpan={2}
                    align="center"
                    className="font-bold border"
                    sx={{ backgroundColor: "#f8fafc" }}
                  >
                    Hora
                  </TableCell>
                  <TableCell
                    colSpan={3}
                    align="center"
                    className="font-bold border"
                    sx={{
                      backgroundColor: categoryColors.cruda.bg,
                      color: categoryColors.cruda.text,
                    }}
                  >
                    Agua Cruda
                  </TableCell>
                  <TableCell
                    colSpan={3}
                    align="center"
                    className="font-bold border"
                    sx={{
                      backgroundColor: categoryColors.decantada.bg,
                      color: categoryColors.decantada.text,
                    }}
                  >
                    Agua Decantada
                  </TableCell>
                  <TableCell
                    colSpan={4}
                    align="center"
                    className="font-bold border"
                    sx={{
                      backgroundColor: categoryColors.tratada.bg,
                      color: categoryColors.tratada.text,
                    }}
                  >
                    Agua Tratada
                  </TableCell>
                  <TableCell
                    rowSpan={2}
                    align="center"
                    className="font-bold border"
                    sx={{ backgroundColor: "#f8fafc" }}
                  >
                    Punto muestreado
                  </TableCell>
                  <TableCell
                    rowSpan={2}
                    align="center"
                    className="font-bold border"
                    sx={{ backgroundColor: "#f8fafc" }}
                  >
                    Encargado de la Planta
                  </TableCell>
                  <TableCell
                    rowSpan={2}
                    align="center"
                    className="font-bold border"
                    sx={{ backgroundColor: "#f8fafc" }}
                  >
                    Observaciones
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell
                    align="center"
                    className="border"
                    sx={{ backgroundColor: categoryColors.cruda.bg }}
                  >
                    pH
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border"
                    sx={{ backgroundColor: categoryColors.cruda.bg }}
                  >
                    Conductividad (uS/cm2)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border"
                    sx={{ backgroundColor: categoryColors.cruda.bg }}
                  >
                    Turbidez (NTU)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border"
                    sx={{ backgroundColor: categoryColors.decantada.bg }}
                  >
                    pH
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border"
                    sx={{ backgroundColor: categoryColors.decantada.bg }}
                  >
                    Conductividad (uS/cm2)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border"
                    sx={{ backgroundColor: categoryColors.decantada.bg }}
                  >
                    Turbidez (NTU)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border"
                    sx={{ backgroundColor: categoryColors.tratada.bg }}
                  >
                    pH
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border"
                    sx={{ backgroundColor: categoryColors.tratada.bg }}
                  >
                    Conductividad (uS/cm2)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border"
                    sx={{ backgroundColor: categoryColors.tratada.bg }}
                  >
                    Turbidez (NTU)
                  </TableCell>
                  <TableCell
                    align="center"
                    className="border"
                    sx={{ backgroundColor: categoryColors.tratada.bg }}
                  >
                    Cloro (ppm)
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody
                sx={{
                  "& tr": { transition: "background-color 0.2s ease" },
                  "& tr:nth-of-type(odd)": { backgroundColor: "#ffffff" },
                  "& tr:nth-of-type(even)": { backgroundColor: "#f4f7fb" },
                  "& tr:hover": { backgroundColor: "#eef2ff" },
                  "& tr.Mui-selected": { backgroundColor: "#e0ebff" },
                  "& tr.Mui-selected:hover": { backgroundColor: "#d6e4ff" },
                  "& tr.Mui-selected td:first-of-type": {
                    boxShadow: "inset 3px 0 0 #2563eb",
                  },
                  "& td": { color: "#0f172a" },
                }}
              >
                {controles.map((control) => (
                  <TableRow
                    key={`registro-${control.id}`}
                    hover
                    onClick={() => setSelectedRecordId(control.id)}
                    selected={selectedRecordId === control.id}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell className="border">{control.fecha}</TableCell>
                    <TableCell className="border">{control.hora}</TableCell>
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
                    sx={{ color: getTratadaIndicatorColor(control.tratada?.ph, { min: 7, max: 8 }) }}
                  >
                    {control.tratada?.ph}
                  </Box>
                </TableCell>
                <TableCell className="border">
                  <Box
                    component="span"
                    sx={{
                      color: getTratadaIndicatorColor(control.tratada?.conductividad, { lt: 400 }),
                    }}
                  >
                    {control.tratada?.conductividad}
                  </Box>
                </TableCell>
                <TableCell className="border">
                  <Box
                    component="span"
                    sx={{
                      color: getTratadaIndicatorColor(control.tratada?.turbidez, { min: 0, max: 5 }),
                    }}
                  >
                    {control.tratada?.turbidez}
                  </Box>
                </TableCell>
                <TableCell className="border">
                  <Box
                    component="span"
                    sx={{
                      color: getTratadaIndicatorColor(control.tratada?.cloro, { min: 0.5, max: 1.5 }),
                    }}
                  >
                    {control.tratada?.cloro}
                  </Box>
                </TableCell>
                <TableCell className="border">{control.punto_muestreo}</TableCell>
                <TableCell className="border">{control.encargado}</TableCell>
                <TableCell
                  className="border"
                  sx={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
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

      <Dialog open={Boolean(editingRecord)} onClose={closeEdit} fullWidth maxWidth="md">
        <DialogTitle>Editar registro</DialogTitle>
        <DialogContent dividers>
          {editingRecord && editValues && (
            <Box sx={{ display: "grid", gap: 2 }}>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                }}
              >
                <TextField label="Fecha" value={editingRecord.fecha} fullWidth disabled size="small" />
                <TextField label="Hora" value={editingRecord.hora} fullWidth disabled size="small" />
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
                  sx={{ gridColumn: { xs: "1 / -1", sm: "1 / -1" } }}
                />
              </Box>

              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  borderColor: "rgba(148, 163, 184, 0.35)",
                  backgroundColor: "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
                  borderTop: `3px solid ${categoryColors.cruda.border}`,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Agua Cruda
                </Typography>
                <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
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
                sx={{
                  p: 2,
                  borderRadius: 2,
                  borderColor: "rgba(148, 163, 184, 0.35)",
                  backgroundColor: "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
                  borderTop: `3px solid ${categoryColors.decantada.border}`,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Agua Decantada
                </Typography>
                <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
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
                sx={{
                  p: 2,
                  borderRadius: 2,
                  borderColor: "rgba(148, 163, 184, 0.35)",
                  backgroundColor: "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
                  borderTop: `3px solid ${categoryColors.tratada.border}`,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Agua Tratada
                </Typography>
                <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" } }}>
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
                    sx={{
                      "& .MuiInputBase-input": {
                        color: getTratadaIndicatorColor(editValues.tratada.ph, { min: 7, max: 8 }),
                      },
                    }}
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
                    sx={{
                      "& .MuiInputBase-input": {
                        color: getTratadaIndicatorColor(editValues.tratada.conductividad, { lt: 400 }),
                      },
                    }}
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
                    sx={{
                      "& .MuiInputBase-input": {
                        color: getTratadaIndicatorColor(editValues.tratada.turbidez, { min: 0, max: 5 }),
                      },
                    }}
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
                    sx={{
                      "& .MuiInputBase-input": {
                        color: getTratadaIndicatorColor(editValues.tratada.cloro, { min: 0.5, max: 1.5 }),
                      },
                    }}
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
        <DialogActions>
          <Button onClick={closeEdit}>Cancelar</Button>
          <Button onClick={handleEditSave} variant="contained" disabled={editSubmitting}>
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
          sx={{ width: "100%" }}
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
          sx={{ width: "100%" }}
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
          sx={{ width: "100%" }}
        >
          {pdfNotice.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}







