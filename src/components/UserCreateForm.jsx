import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import { api, getApiBaseURL } from "../api/api";

export default function UserCreateForm({ onClose }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sociedades, setSociedades] = useState([]);
  const [sociedadId, setSociedadId] = useState("");
  const [sociedadesLoading, setSociedadesLoading] = useState(false);
  const [sociedadesError, setSociedadesError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [success, setSuccess] = useState("");
  const canClose = typeof onClose === "function";

  const inputSx = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "rgba(255,255,255,0.96)",
      borderRadius: 2,
      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
      transition: "box-shadow 0.2s ease, transform 0.2s ease",
      "& fieldset": {
        borderColor: "rgba(148, 163, 184, 0.5)",
      },
      "&:hover fieldset": {
        borderColor: "rgba(37, 99, 235, 0.6)",
      },
      "&.Mui-focused": {
        boxShadow: "0 10px 22px rgba(37, 99, 235, 0.16)",
        transform: "translateY(-1px)",
      },
      "&.Mui-focused fieldset": {
        borderColor: "#2563eb",
      },
    },
    "& .MuiInputLabel-root": {
      color: "#334155",
      fontWeight: 600,
    },
    "& .MuiInputLabel-root.Mui-focused": {
      color: "#1d4ed8",
    },
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

  const parseValidationIssues = (err) => {
    const detail = err?.response?.data?.detail;
    if (!Array.isArray(detail)) return [];
    return detail
      .map((item) => {
        const msg = typeof item?.msg === "string" ? item.msg.trim() : "";
        const loc = Array.isArray(item?.loc)
          ? item.loc.filter((part) => part !== "body")
          : [];
        const path = loc.filter(Boolean).join(".");
        const type = typeof item?.type === "string" ? item.type : "";
        return { msg, path, type };
      })
      .filter((item) => item.msg || item.path || item.type);
  };

  const formatValidationMessage = (issues) => {
    if (!issues.length) return "";
    return issues
      .map((issue) => {
        const parts = [];
        if (issue.msg) parts.push(issue.msg);
        if (issue.path) parts.push(issue.path);
        return parts.join(": ");
      })
      .filter(Boolean)
      .join(" | ");
  };

  const getMissingFields = (issues) =>
    issues
      .filter(
        (issue) => issue.type?.includes("missing") || /requerido|required/i.test(issue.msg)
      )
      .map((issue) => issue.path)
      .filter(Boolean);

  const buildErrorDetail = (err, issues = []) => {
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
    const uniqueFields = [...new Set(issues.map((issue) => issue.path).filter(Boolean))];
    if (uniqueFields.length > 0) {
      pieces.push(`Campos: ${uniqueFields.join(", ")}`);
    }
    return pieces.join(" | ");
  };

  useEffect(() => {
    let cancelled = false;
    const loadSociedades = async () => {
      setSociedadesLoading(true);
      setSociedadesError("");
      try {
        const res = await api.get("/api/sociedades");
        if (cancelled) return;
        const items = Array.isArray(res?.data) ? res.data : [];
        setSociedades(items);
        if (!sociedadId && items.length === 1) {
          setSociedadId(String(items[0]?.id ?? ""));
        }
      } catch (err) {
        if (cancelled) return;
        setSociedadesError("No se pudieron cargar las sociedades.");
      } finally {
        if (!cancelled) setSociedadesLoading(false);
      }
    };
    loadSociedades();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setErrorDetail("");
    setSuccess("");
    const cleanedUsername = String(username || "").trim();
    const cleanedEmail = String(email || "").trim();
    if (!cleanedUsername || !cleanedEmail || !password) {
      setError("Completa usuario, correo y contraseña.");
      return;
    }
    if (!sociedadId) {
      setError("Selecciona la sociedad.");
      return;
    }
    setSubmitting(true);
    const sociedadIdNumber = Number(sociedadId);
    const payload = {
      username: cleanedUsername,
      email: cleanedEmail,
      password,
      sociedad_id: Number.isFinite(sociedadIdNumber) ? sociedadIdNumber : undefined,
    };
    try {
      await api.post("/auth/users", payload);
      setSuccess("Usuario creado correctamente.");
      setUsername("");
      setEmail("");
      setPassword("");
    } catch (err) {
      let nextErr = err;
      let status = err?.response?.status;
      let issues = parseValidationIssues(err);
      const missingFields = getMissingFields(issues);
      const missingAuthFields =
        status === 422 &&
        missingFields.includes("username") &&
        missingFields.includes("password");

      if (missingAuthFields) {
        try {
          const form = new URLSearchParams();
          Object.entries(payload).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              form.append(key, String(value));
            }
          });
          await api.post("/auth/users", form, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          });
          setSuccess("Usuario creado correctamente.");
          setUsername("");
          setEmail("");
          setPassword("");
          return;
        } catch (retryErr) {
          nextErr = retryErr;
          status = retryErr?.response?.status;
          issues = parseValidationIssues(retryErr);
        }
      }

      if (status === 401 || status === 403) {
        setError("No autorizado. Tu sesi\u00f3n no tiene permisos.");
      } else if (status === 409) {
        setError("El usuario ya existe.");
      } else if (status === 422) {
        setError(formatValidationMessage(issues) || extractApiErrorMessage(nextErr, "Datos inválidos."));
      } else {
        setError(
          extractApiErrorMessage(
            nextErr,
            "No se pudo crear el usuario. Revisa los datos."
          )
        );
      }
      setErrorDetail(buildErrorDetail(nextErr, issues));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5, md: 3 },
        mb: { xs: 2, md: 3 },
        borderRadius: 3,
        border: "1px solid rgba(148, 163, 184, 0.35)",
        boxShadow: "0 16px 36px rgba(15, 23, 42, 0.1)",
        width: "100%",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,249,255,0.9) 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: -90,
          right: -120,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(16,185,129,0.18) 100%)",
              boxShadow: "0 10px 20px rgba(15, 23, 42, 0.12)",
            }}
          >
            <PersonAddAltRoundedIcon sx={{ color: "#1d4ed8" }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0f172a" }}>
              Crear usuario
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Alta de nuevos usuarios del sistema
            </Typography>
          </Box>
        </Box>
        {canClose && (
          <IconButton
            type="button"
            onClick={onClose}
            sx={{
              backgroundColor: "rgba(148, 163, 184, 0.18)",
              borderRadius: 2,
              "&:hover": { backgroundColor: "rgba(37, 99, 235, 0.15)" },
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
        )}
      </Stack>
      <Divider sx={{ my: 2 }} />

      <Box
        component="form"
        onSubmit={onSubmit}
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        <TextField
          label="Nuevo usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          required
          size="small"
          sx={inputSx}
        />
        <TextField
          label="Correo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          required
          size="small"
          sx={inputSx}
          inputProps={{ autoComplete: "email" }}
        />
        <FormControl fullWidth required size="small" sx={inputSx}>
          <InputLabel id="sociedad-label">Sociedad</InputLabel>
          <Select
            labelId="sociedad-label"
            label="Sociedad"
            value={sociedadId}
            onChange={(e) => setSociedadId(e.target.value)}
            disabled={sociedadesLoading}
          >
            {sociedades.length === 0 ? (
              <MenuItem value="" disabled>
                {sociedadesLoading ? "Cargando..." : "Sin sociedades"}
              </MenuItem>
            ) : (
              sociedades.map((sociedad) => (
                <MenuItem key={sociedad.id} value={String(sociedad.id)}>
                  {sociedad.nombre}
                </MenuItem>
              ))
            )}
          </Select>
          {sociedadesError && <FormHelperText error>{sociedadesError}</FormHelperText>}
        </FormControl>
        <TextField
          label="Contraceña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          required
          size="small"
          sx={inputSx}
          inputProps={{ autoComplete: "new-password" }}
        />
        {error && (
          <Alert
            severity="error"
            variant="filled"
            sx={{ gridColumn: "1 / -1", borderRadius: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {error}
            </Typography>
            {errorDetail && (
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {errorDetail}
              </Typography>
            )}
          </Alert>
        )}
        {success && (
          <Alert
            severity="success"
            variant="filled"
            sx={{ gridColumn: "1 / -1", borderRadius: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {success}
            </Typography>
          </Alert>
        )}
        <Box sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-end" } }}>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{
              width: { xs: "100%", sm: "auto" },
              px: 3,
              py: 1,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              letterSpacing: 0.4,
              background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
              boxShadow: "0 14px 26px rgba(37, 99, 235, 0.28)",
              "&:hover": {
                boxShadow: "0 18px 32px rgba(37, 99, 235, 0.32)",
              },
            }}
          >
            {submitting ? "Creando..." : "Crear usuario"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
