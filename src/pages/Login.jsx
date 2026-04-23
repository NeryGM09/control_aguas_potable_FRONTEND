import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  LinearProgress,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { useAuth } from "../auth/AuthContext";
import { getApiBaseURL } from "../api/api";
import AnimatedLogo from "../components/AnimatedLogo";
import fondoagua from "../assets/fondoagua.png";
import appPackage from "../../package.json";
import "../styles/pages/Login.css";

function getDetailMessage(err) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first?.msg === "string" && first.msg.trim()) {
      return first.msg;
    }
  }
  return "";
}

export default function Login() {
  const { login, completePasswordReset } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({
    username: false,
    password: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [success, setSuccess] = useState("");
  const [successDetail, setSuccessDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetFlow, setResetFlow] = useState(null);
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });
  const appVersion = appPackage?.version || "0.0.0";
  const isResetMode = Boolean(resetFlow?.token);

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

  const resetAlerts = () => {
    setError("");
    setErrorDetail("");
    setSuccess("");
    setSuccessDetail("");
  };

  const handleResetCancel = () => {
    setResetFlow(null);
    setNewPassword("");
    setConfirmPassword("");
    setTouched((prev) => ({
      ...prev,
      newPassword: false,
      confirmPassword: false,
    }));
    resetAlerts();
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    resetAlerts();

    if (isResetMode) {
      if (!newPassword || !confirmPassword) {
        setTouched((prev) => ({ ...prev, newPassword: true, confirmPassword: true }));
        setError("Completa la nueva contraseña y su confirmación.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("La confirmación no coincide.");
        return;
      }
      if (newPassword.length < 10) {
        setError("La nueva contraseña debe tener al menos 10 caracteres.");
        return;
      }

      setSubmitting(true);
      try {
        await completePasswordReset(resetFlow.token, newPassword, confirmPassword, false, {
          beforeSetUser: async () => {
            setSuccess("Contraseña actualizada.");
            setSuccessDetail("Acceso listo.");
            await new Promise((resolve) => setTimeout(resolve, 700));
          },
        });
      } catch (err) {
        const status = err?.response?.status;
        const baseURL = getApiBaseURL();
        const extra = baseURL ? `URL: ${baseURL}` : "";
        const detail = getDetailMessage(err);

        if (status === 400) {
          setError(detail || "No se pudo actualizar la contraseña.");
        } else if (status === 401 || status === 403) {
          setError("El enlace de cambio ya no es válido.");
          setErrorDetail(detail || extra);
        } else if (err?.code === "ECONNABORTED") {
          setError("Tiempo de espera agotado.");
        } else if (!err?.response) {
          setError("Sin conexión al servidor.");
          setErrorDetail(extra);
        } else {
          setError(`Error del servidor (${status})`);
          setErrorDetail(detail || extra);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!username || !password) {
      setTouched((prev) => ({ ...prev, username: true, password: true }));
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
            setSuccess("Bienvenido.");
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

      if (code === "PASSWORD_RESET_REQUIRED") {
        setResetFlow({
          token: err.resetToken,
          username: err?.user?.username || username.trim(),
          email: err?.email || err?.user?.email || "",
        });
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTouched((prev) => ({
          ...prev,
          password: false,
          newPassword: false,
          confirmPassword: false,
        }));
        setSuccess("Debes actualizar tu contraseña.");
        setSuccessDetail("Define una nueva contraseña para continuar.");
      } else if (code === "OFFLINE_NO_USER") {
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
      } else if (status === 409) {
        setError("Hay varias coincidencias para ese usuario.");
        setErrorDetail(getDetailMessage(err) || "Revisa el identificador de la cuenta.");
      } else {
        setError(`Error del servidor (${status})`);
        setErrorDetail(getDetailMessage(err) || extra);
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
            {isResetMode ? "Actualiza tu contraseña" : "Bienvenido"}
          </Typography>
          <Typography variant="body2" className="login-subheading">
            {isResetMode
              ? "Tu cuenta requiere una nueva contraseña para continuar."
              : "Ingresa tus credenciales para avanzar."}
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
              value={isResetMode ? resetFlow?.username || username : username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, username: true }))}
              fullWidth
              required
              disabled={isResetMode}
              InputLabelProps={{ required: false, shrink: true }}
              variant="outlined"
              className="login-textfield"
              error={!isResetMode && touched.username && !username}
              helperText={
                isResetMode
                  ? resetFlow?.email || " "
                  : touched.username && !username
                    ? "Ingresa tu usuario"
                    : " "
              }
              inputProps={{ autoComplete: "username" }}
            />

            {!isResetMode && (
              <TextField
                label="Contraseña"
                type={showPassword ? "text" : "password"}
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
                inputProps={{ autoComplete: "current-password" }}
              />
            )}

            {isResetMode && (
              <>
                <TextField
                  label="Nueva contraseña"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, newPassword: true }))}
                  fullWidth
                  required
                  InputLabelProps={{ required: false, shrink: true }}
                  variant="outlined"
                  className="login-textfield"
                  error={touched.newPassword && !newPassword}
                  helperText={
                    touched.newPassword && !newPassword
                      ? "Ingresa la nueva contraseña"
                      : "Mínimo 10 caracteres"
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          aria-label={
                            showNewPassword ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"
                          }
                        >
                          {showNewPassword ? (
                            <VisibilityOffRoundedIcon />
                          ) : (
                            <VisibilityRoundedIcon />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ autoComplete: "new-password" }}
                />
                <TextField
                  label="Confirmar contraseña"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                  fullWidth
                  required
                  InputLabelProps={{ required: false, shrink: true }}
                  variant="outlined"
                  className="login-textfield"
                  error={touched.confirmPassword && !confirmPassword}
                  helperText={
                    touched.confirmPassword && !confirmPassword
                      ? "Confirma la contraseña"
                      : " "
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={
                            showConfirmPassword
                              ? "Ocultar confirmación de contraseña"
                              : "Mostrar confirmación de contraseña"
                          }
                        >
                          {showConfirmPassword ? (
                            <VisibilityOffRoundedIcon />
                          ) : (
                            <VisibilityRoundedIcon />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ autoComplete: "new-password" }}
                />
              </>
            )}

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

            {submitting && <LinearProgress className="login-progress" />}

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
                  {isResetMode ? "Guardando..." : "Entrando..."}
                </Box>
              ) : isResetMode ? (
                "Guardar contraseña"
              ) : (
                "Entrar"
              )}
            </Button>

            {isResetMode && (
              <Button
                type="button"
                variant="text"
                fullWidth
                onClick={handleResetCancel}
                disabled={submitting}
              >
                Volver al login
              </Button>
            )}
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
