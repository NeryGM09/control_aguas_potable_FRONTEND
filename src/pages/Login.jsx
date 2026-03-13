import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  InputAdornment,
  Paper,
  CircularProgress,
  LinearProgress,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { getApiBaseURL } from "../api/api";
import logo from "../assets/logo.png";

export default function Login() {
  const { login } = useAuth();
  const theme = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false });
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const heroGradient = useMemo(
    () =>
      `radial-gradient(circle at 20% 10%, rgba(99, 179, 237, 0.22), transparent 60%),
       radial-gradient(circle at 80% 20%, rgba(56, 189, 248, 0.18), transparent 55%),
       linear-gradient(180deg, #f5f9ff 0%, #e9f1fb 100%)`,
    [theme]
  );

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setErrorDetail("");
    if (!username || !password) {
      setTouched({ username: true, password: true });
      setError("Completa usuario y contraseña.");
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password, false);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.code;
      const baseURL = getApiBaseURL();
      const extra = baseURL ? `URL: ${baseURL}` : "";
      if (code === "OFFLINE_NO_USER") {
        setError("Este usuario no esta disponible sin conexion.");
        setErrorDetail("Conectate a internet y vuelve a iniciar sesion para habilitar el modo offline.");
      } else if (code === "OFFLINE_INVALID") {
        setError("Credenciales invalidas para modo offline.");
        setErrorDetail("Conectate a internet e intenta nuevamente.");
      } else if (code === "CRYPTO_UNAVAILABLE") {
        setError("No se puede validar el modo offline en este dispositivo.");
        setErrorDetail("Conectate a internet para iniciar sesion.");
      } else if (code === "ECONNABORTED") {
        setError("Tiempo de espera agotado. Revisa la conexión.");
      } else if (!err?.response) {
        setError("Sin conexión con el servidor.");
        setErrorDetail(extra);
      } else if (status === 401) {
        setError("Credenciales inválidas");
      } else {
        setError(`Error del servidor (${status})`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 4 },
        py: { xs: 4, sm: 6 },
        background: heroGradient,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: { xs: 360, sm: 480 },
          p: { xs: 3.5, sm: 5 },
          borderRadius: { xs: 3, sm: 4 },
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
          background:
            "linear-gradient(140deg, rgba(255,255,255,0.98) 0%, rgba(248,252,255,0.96) 100%)",
          boxShadow:
            "0 20px 50px rgba(30, 64, 175, 0.15), 0 2px 8px rgba(15, 23, 42, 0.08)",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          animation: "loginFade 520ms ease",
          "@keyframes loginFade": {
            from: { opacity: 0, transform: "translateY(10px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top right, rgba(59,130,246,0.16), transparent 55%)",
            pointerEvents: "none",
          }}
        />
        <Box sx={{ position: "relative" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mb: 2,
            }}
          >
            <Box
              component="img"
              src={logo}
              alt="Logo"
              sx={{
                height: { xs: 64, sm: 76 },
                width: "auto",
                objectFit: "contain",
              }}
            />
          </Box>
          <Typography
            variant="overline"
            sx={{
              letterSpacing: 4,
              color: "text.secondary",
              display: "block",
              mb: 0.5,
            }}
          >
            Control de Agua Potable
          </Typography>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, mt: 0.5, mb: 1, color: "#1f2937" }}
          >
            Bienvenido
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            Ingresa tus credenciales para continuar
          </Typography>

          <Box
            component="form"
            onSubmit={onSubmit}
            autoComplete="off"
            sx={{
              display: "grid",
              gap: 2.2,
              textAlign: "left",
            }}
          >
            <TextField
              label="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, username: true }))}
              fullWidth
              required
              InputLabelProps={{ required: false }}
              variant="outlined"
              error={touched.username && !username}
              helperText={
                touched.username && !username ? "Ingresa tu usuario" : " "
              }
              inputProps={{ autoComplete: "off" }}
            />
            <TextField
              label="Contraseña"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              fullWidth
              required
              InputLabelProps={{ required: false }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      onClick={() => setShowPassword((prev) => !prev)}
                      size="small"
                      sx={{
                        textTransform: "none",
                        minWidth: 0,
                        padding: 0.5,
                        minHeight: "auto",
                      }}
                    >
                      {showPassword ? (
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                      ) : (
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                      )}
                    </Button>
                  </InputAdornment>
                ),
              }}
              variant="outlined"
              error={touched.password && !password}
              helperText={
                touched.password && !password ? "Ingresa tu contraseña" : " "
              }
              inputProps={{ autoComplete: "new-password" }}
            />
            {error && (
              <Box>
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
            {submitting && <LinearProgress sx={{ borderRadius: 1 }} />}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting}
              sx={{
                py: 1.35,
                fontWeight: 700,
                letterSpacing: 1,
                borderRadius: 1.5,
                boxShadow: "0 8px 20px rgba(37, 99, 235, 0.25)",
              }}
            >
              {submitting ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={18} color="inherit" />
                  Entrando...
                </Box>
              ) : (
                "Entrar"
              )}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}