import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Alert,
  CircularProgress,
  LinearProgress,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { getApiBaseURL } from "../api/api";
import AnimatedLogo from "../components/AnimatedLogo";
import fondoagua from "../assets/fondoagua.png";
import appPackage from "../../package.json";
import "../styles/pages/Login.css";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ username: false, password: false });
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [success, setSuccess] = useState("");
  const [successDetail, setSuccessDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });
  const appVersion = appPackage?.version || "0.0.0";

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setErrorDetail("");
    setSuccess("");
    setSuccessDetail("");
    if (!username || !password) {
      setTouched({ username: true, password: true });
      setError("Falta usuario o contraseña.");
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password, false, {
        beforeSetUser: async ({ mode }) => {
          if (mode === "offline") {
            setSuccess("Modo offline activo.");
            setSuccessDetail("Se sincroniza al volver a tener internet.");
          } else {
            setSuccess("¡Bienvenido!");
            setSuccessDetail("Acceso listo.");
          }
          await new Promise((resolve) => setTimeout(resolve, 700));
        },
      });
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.code;
      const baseURL = getApiBaseURL();
      const extra = baseURL ? `URL: ${baseURL}` : "";
      if (code === "OFFLINE_NO_USER") {
        setError("Usuario no disponible offline.");
        setErrorDetail("Conéctate y vuelve a iniciar sesión.");
      } else if (code === "OFFLINE_INVALID") {
        setError("Credenciales inválidas offline.");
        setErrorDetail("Conéctate e intenta de nuevo.");
      } else if (code === "CRYPTO_UNAVAILABLE") {
        setError("Offline no disponible en este dispositivo.");
        setErrorDetail("Conéctate para iniciar sesión.");
      } else if (code === "ECONNABORTED") {
        setError("Tiempo de espera agotado.");
      } else if (!err?.response) {
        setError("Sin conexión al servidor.");
        setErrorDetail(extra);
      } else if (status === 401) {
        setError("Usuario o contraseña incorrectos.");
        setErrorDetail("Verifica e intenta de nuevo.");
      } else {
        setError(`Error del servidor (${status})`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box className="login-root">
      <Box className="login-hero">
        <Box
          component="img"
          src={fondoagua}
          alt="Control de Aguas"
          className="login-hero-image"
        />
      </Box>

      <Box className="login-content">
        <Box className="login-stack">
          <Box className="login-logo-wrap">
            <AnimatedLogo width={{ xs: 190, sm: 230 }} />
          </Box>
          <Typography variant="h6" className="login-welcome">
            Bienvenido
          </Typography>
          <Typography variant="body2" className="login-subheading">
            Ingresa tus credenciales para avanzar.
          </Typography>
          <Chip
            label={isOnline ? "En línea" : "Sin conexión"}
            size="small"
            className={`login-status-chip ${isOnline ? "is-online" : "is-offline"}`}
          />

          <Box
            component="form"
            onSubmit={onSubmit}
            autoComplete="off"
            className="login-form"
          >
            <TextField
              label="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, username: true }))}
              fullWidth
              required
              InputLabelProps={{ required: false, shrink: true }}
              variant="outlined"
              className="login-textfield"
              error={touched.username && !username}
              helperText={touched.username && !username ? "Ingresa tu usuario" : " "}
              inputProps={{ autoComplete: "username" }}
            />
            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              fullWidth
              required
              InputLabelProps={{ required: false, shrink: true }}
              variant="outlined"
              className="login-textfield"
              error={touched.password && !password}
              helperText={touched.password && !password ? "Ingresa tu contraseña" : " "}
              inputProps={{ autoComplete: "current-password" }}
            />
            <Box className="login-alerts">
              <Collapse in={Boolean(error)}>
                <Alert
                  severity="error"
                  variant="filled"
                  className="login-alert login-alert-error"
                >
                  <Typography variant="body2" className="login-alert-title">
                    {error}
                  </Typography>
                  {errorDetail && (
                    <Typography variant="caption" className="login-alert-detail">
                      {errorDetail}
                    </Typography>
                  )}
                </Alert>
              </Collapse>
              <Collapse in={Boolean(success)}>
                <Alert
                  severity="success"
                  variant="filled"
                  className="login-alert login-alert-success"
                >
                  <Typography variant="body2" className="login-alert-title">
                    {success}
                  </Typography>
                  {successDetail && (
                    <Typography variant="caption" className="login-alert-detail">
                      {successDetail}
                    </Typography>
                  )}
                </Alert>
              </Collapse>
            </Box>
            {submitting && (
              <LinearProgress className="login-progress" />
            )}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting}
              className="login-submit"
            >
              {submitting ? (
                <Box className="login-submit-loading">
                  <CircularProgress size={18} color="inherit" />
                  Entrando...
                </Box>
              ) : (
                "Entrar"
              )}
            </Button>
          </Box>

          <Box className="login-footer">
            <Typography variant="caption" className="login-version">
              v{appVersion} 
            </Typography>
          </Box>

        </Box>
      </Box>
    </Box>
  );
}
