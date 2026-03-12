import React, { useEffect, useMemo, useState } from "react";
import { createRegistro, getRegistros, initOffline, updateRegistro } from "../offline/registroService";
import {
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
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

export default function TableControl() {
  const { user } = useAuth();
  const theme = useTheme();
  const [controles, setControles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
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
        ph: Number(editValues?.cruda?.ph),
        conductividad: Number(editValues?.cruda?.conductividad),
        turbidez: Number(editValues?.cruda?.turbidez),
      },
      decantada: {
        ph: Number(editValues?.decantada?.ph),
        conductividad: Number(editValues?.decantada?.conductividad),
        turbidez: Number(editValues?.decantada?.turbidez),
      },
      tratada: {
        ph: Number(editValues?.tratada?.ph),
        conductividad: Number(editValues?.tratada?.conductividad),
        turbidez: Number(editValues?.tratada?.turbidez),
        cloro: Number(editValues?.tratada?.cloro),
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

  const refreshRegistros = async () => {
    const data = await getRegistros();
    setControles(data);
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
        setEditError("Completa todos los campos numÃ©ricos antes de guardar.");
        return;
      }

      await updateRegistro(editingRecord, payloadEditable, payloadFull);

      await refreshRegistros();
      closeEdit();
    } catch (err) {
      setEditError(extractApiErrorMessage(err, "No se pudo actualizar el registro."));
    } finally {
      setEditSubmitting(false);
    }
  };

  useEffect(() => {
    initOffline().catch(() => {});
    refreshRegistros().catch((err) => console.log(err));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        fecha: fechaActual,
        hora: horaActual,
        punto_muestreo: puntoMuestreo,
        encargado: user?.username || "",
        observaciones,
        cruda: {
          ph: Number(cruda.ph),
          conductividad: Number(cruda.conductividad),
          turbidez: Number(cruda.turbidez),
        },
        decantada: {
          ph: Number(decantada.ph),
          conductividad: Number(decantada.conductividad),
          turbidez: Number(decantada.turbidez),
        },
        tratada: {
          ph: Number(tratada.ph),
          conductividad: Number(tratada.conductividad),
          turbidez: Number(tratada.turbidez),
          cloro: Number(tratada.cloro),
        },
      };

      await createRegistro(payload);

      setPuntoMuestreo("");
      setCruda({ ph: "", conductividad: "", turbidez: "" });
      setDecantada({ ph: "", conductividad: "", turbidez: "" });
      setTratada({ ph: "", conductividad: "", turbidez: "", cloro: "" });
      setObservaciones("");

      await refreshRegistros();
    } catch (err) {
      setError("No se pudo guardar el registro. Revisa los datos.");
    } finally {
      setSubmitting(false);
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
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {error}
            </Typography>
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
              gap: 1,
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, textAlign: { xs: "center", md: "left" } }}
            >
              Registros
            </Typography>
            <Button variant="outlined" onClick={openSelectedEdit} disabled={!selectedRecord}>
              Editar registro seleccionado
            </Button>
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
    </Box>
  );
}



