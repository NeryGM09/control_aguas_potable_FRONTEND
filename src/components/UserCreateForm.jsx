import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { api, getApiBaseURL } from "../api/api";
import "../styles/components/UserCreateForm.css";

export default function UserCreateForm({ onClose }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sociedades, setSociedades] = useState([]);
  const [sociedadId, setSociedadId] = useState("");
  const [sociedadesLoading, setSociedadesLoading] = useState(false);
  const [sociedadesError, setSociedadesError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [success, setSuccess] = useState("");
  const canClose = typeof onClose === "function";

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
        const res = await api.get("/api/control-aguas/sociedades");
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
      await api.post("/api/auth/register", payload);
      setSuccess(
        "Usuario creado correctamente. En su primer ingreso deberá actualizar la contraseña."
      );
      setUsername("");
      setEmail("");
      setPassword("");
    } catch (err) {
      const status = err?.response?.status;
      const issues = parseValidationIssues(err);

      if (status === 401 || status === 403) {
        setError("No autorizado. Tu sesión no tiene permisos.");
      } else if (status === 409) {
        setError("El usuario ya existe.");
      } else if (status === 422) {
        setError(
          formatValidationMessage(issues) ||
            extractApiErrorMessage(err, "Datos inválidos.")
        );
      } else if (status === 400) {
        setError(extractApiErrorMessage(err, "No se pudo crear el usuario."));
      } else {
        setError(
          extractApiErrorMessage(
            err,
            "No se pudo crear el usuario. Revisa los datos."
          )
        );
      }
      setErrorDetail(buildErrorDetail(err, issues));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper elevation={0} className="user-create-card">
      <Box className="user-create-orb" />
      <Box className="user-create-header">
        <Box className="user-create-title-group">
          <Box className="user-create-icon-box">
            <PersonAddAltRoundedIcon className="user-create-icon" />
          </Box>
          <Box>
            <Typography variant="h6" className="user-create-title">
              Crear usuario
            </Typography>
            <Typography variant="body2" className="user-create-subtitle">
              Alta de nuevos usuarios del sistema
            </Typography>
          </Box>
        </Box>
        {canClose && (
          <IconButton type="button" onClick={onClose} className="user-create-close">
            <CloseRoundedIcon />
          </IconButton>
        )}
      </Box>
      <Divider className="user-create-divider" />

      <Box component="form" onSubmit={onSubmit} className="user-create-form">
        <TextField
          label="Nuevo usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          required
          size="small"
          className="user-create-field"
        />
        <TextField
          label="Correo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          required
          size="small"
          className="user-create-field"
          inputProps={{ autoComplete: "email" }}
        />
        <FormControl fullWidth required size="small" className="user-create-field">
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
          label="Contraseña"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          required
          size="small"
          className="user-create-field"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          inputProps={{ autoComplete: "new-password" }}
        />
        {error && (
          <Alert severity="error" variant="filled" className="user-create-alert">
            <Typography variant="body2" className="user-create-alert-title">
              {error}
            </Typography>
            {errorDetail && (
              <Typography variant="caption" className="user-create-alert-detail">
                {errorDetail}
              </Typography>
            )}
          </Alert>
        )}
        {success && (
          <Alert severity="success" variant="filled" className="user-create-alert">
            <Typography variant="body2" className="user-create-alert-title">
              {success}
            </Typography>
          </Alert>
        )}
        <Box className="user-create-actions">
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            className="user-create-submit"
          >
            {submitting ? "Creando..." : "Crear usuario"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
