import React, { useState } from "react";
import {
  Box,
  Button,
  Collapse,
  IconButton,
  InputAdornment,
  Alert,
  CircularProgress,
  LinearProgress,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { getApiBaseURL } from "../api/api";
import AnimatedLogo from "../components/AnimatedLogo";
import cana2 from "../assets/cana2.jpg";
import appPackage from "../../package.json";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false });
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [success, setSuccess] = useState("");
  const [successDetail, setSuccessDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const appVersion = appPackage?.version || "0.0.0";
  const headingFont = "'Playfair Display', 'Trebuchet MS', serif";
  const bodyFont = "'Manrope', 'Trebuchet MS', 'Segoe UI', sans-serif";

  const inputSx = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "rgba(255,255,255,0.96)",
      borderRadius: 2.2,
      boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
      transition: "box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease",
      "& fieldset": {
        borderColor: "rgba(148, 163, 184, 0.4)",
      },
      "&:hover fieldset": {
        borderColor: "rgba(37, 99, 235, 0.6)",
      },
      "&.Mui-focused": {
        boxShadow: "0 14px 28px rgba(37, 99, 235, 0.18)",
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
    "& .MuiInputBase-input": {
      py: { xs: 1, sm: 1.35 },
      fontSize: { xs: "0.92rem", sm: "1rem" },
    },
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setErrorDetail("");
    setSuccess("");
    setSuccessDetail("");
    if (!username || !password) {
      setTouched({ username: true, password: true });
      setError("Completa usuario y contraseña.");
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password, false, {
        beforeSetUser: async ({ mode }) => {
          if (mode === "offline") {
            setSuccess("Ingreso offline activado.");
            setSuccessDetail("Entraste sin conexion y se sincronizara cuando haya internet.");
          } else {
            setSuccess("Credenciales correctas. Bienvenido!");
            setSuccessDetail("Acceso concedido.");
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
        setError("Este usuario no esta disponible sin conexion.");
        setErrorDetail("Conectate a internet y vuelve a iniciar sesion para habilitar el modo offline.");
      } else if (code === "OFFLINE_INVALID") {
        setError("Credenciales invalidas para modo offline.");
        setErrorDetail("Conectate a internet e intenta nuevamente.");
      } else if (code === "CRYPTO_UNAVAILABLE") {
        setError("No se puede validar el modo offline en este dispositivo.");
        setErrorDetail("Conectate a internet para iniciar sesion.");
      } else if (code === "ECONNABORTED") {
        setError("Tiempo de espera agotado. Revisa la conexion.");
      } else if (!err?.response) {
        setError("Sin conexion con el servidor.");
        setErrorDetail(extra);
      } else if (status === 401) {
        setError("Usuario o contraseña incorrecta.");
        setErrorDetail("Verifica tus datos e intenta nuevamente.");
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
        minHeight: { xs: "100dvh", md: "100vh" },
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        background: "linear-gradient(160deg, #edf5ff 0%, #effcf4 48%, #fff6e8 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily: bodyFont,
        color: "#0f172a",
        "@keyframes canaFloat": {
          "0%": { transform: "scale(1.03) translateY(0px)" },
          "50%": { transform: "scale(1.06) translateY(-8px)" },
          "100%": { transform: "scale(1.03) translateY(0px)" },
        },
        "@keyframes bgShift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "@keyframes glowPulse": {
          "0%": { opacity: 0.55 },
          "50%": { opacity: 0.85 },
          "100%": { opacity: 0.55 },
        },
        "@keyframes sheen": {
          "0%": { transform: "translateX(-25%)" },
          "100%": { transform: "translateX(25%)" },
        },
      }}
    >
      <Box
        sx={{
          flex: 1.2,
          minHeight: { xs: 0, md: "100vh" },
          display: { xs: "none", md: "block" },
          position: "relative",
          backgroundColor: "#f8fafc",
          borderRight: "1px solid rgba(226, 232, 240, 0.9)",
          overflow: "hidden",
        }}
      >
        <Box
          component="img"
          src={cana2}
          alt="Control de Aguas"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 35%",
            transform: "scale(1.03)",
            filter: "saturate(0.95) contrast(1.06) brightness(0.95)",
            animation: "canaFloat 20s ease-in-out infinite",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(13, 148, 136, 0.32) 0%, rgba(59, 130, 246, 0.25) 55%, rgba(15, 23, 42, 0.2) 100%)",
            animation: "glowPulse 12s ease-in-out infinite",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.35), transparent 58%), radial-gradient(circle at 85% 10%, rgba(191,219,254,0.28), transparent 55%)",
            mixBlendMode: "screen",
            opacity: 0.85,
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 28,
            height: "100%",
            background:
              "linear-gradient(90deg, rgba(248,250,252,0) 0%, rgba(248,250,252,0.65) 60%, rgba(248,250,252,0.95) 100%)",
            pointerEvents: "none",
          }}
        />
      </Box>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: { xs: "center", md: "center" },
          justifyContent: "center",
          px: { xs: 2, sm: 4, md: 6 },
          pt: { xs: 4, md: 0 },
          pb: { xs: 8, sm: 8, md: 0 },
          position: "relative",
          overflow: "hidden",
          background: {
            xs: "linear-gradient(135deg, rgba(229,241,255,0.95) 0%, rgba(216,247,235,0.92) 55%, rgba(255,246,228,0.95) 100%)",
            md: "linear-gradient(135deg, rgba(228,241,255,0.94) 0%, rgba(214,248,233,0.92) 55%, rgba(255,246,228,0.94) 100%)",
          },
          backgroundSize: "200% 200%",
          animation: "bgShift 20s ease-in-out infinite",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.9), transparent 55%), radial-gradient(circle at 85% 0%, rgba(191,219,254,0.4), transparent 50%), radial-gradient(circle at 80% 85%, rgba(187,247,208,0.4), transparent 55%)",
            opacity: 0.9,
            pointerEvents: "none",
            animation: "glowPulse 14s ease-in-out infinite",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            inset: "-20% -10%",
            background:
              "repeating-linear-gradient(115deg, rgba(15,118,110,0.08) 0px, rgba(15,118,110,0.08) 1px, transparent 1px, transparent 12px)",
            opacity: { xs: 0.18, sm: 0.3, md: 0.4 },
            pointerEvents: "none",
            animation: "sheen 18s ease-in-out infinite alternate",
          },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: { xs: 18, sm: 24, md: 28 },
            left: 0,
            right: 0,
            display: "grid",
            placeItems: "center",
            gap: 0.6,
            color: "rgba(15, 23, 42, 0.72)",
            zIndex: 1,
            px: 2,
          }}
        >
          <Box
            sx={{
              width: { xs: 140, sm: 180 },
              height: 6,
              borderRadius: 999,
              background:
                "linear-gradient(90deg, rgba(16,185,129,0.4) 0%, rgba(59,130,246,0.45) 45%, rgba(250,204,21,0.35) 100%)",
              boxShadow: "0 10px 22px rgba(37, 99, 235, 0.16)",
            }}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.45)",
                boxShadow: "0 6px 14px rgba(16, 185, 129, 0.25)",
              }}
            />
            <Box
              sx={{
                width: 28,
                height: 4,
                borderRadius: 999,
                background: "rgba(59, 130, 246, 0.45)",
              }}
            />
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "rgba(250, 204, 21, 0.4)",
                boxShadow: "0 6px 14px rgba(250, 204, 21, 0.22)",
              }}
            />
          </Box>
        </Box>
        <Box
          sx={{
            width: "100%",
            maxWidth: { xs: 380, sm: 460 },
            position: "relative",
            zIndex: 1,
            px: { xs: 0, sm: 1 },
            py: { xs: 1, sm: 2 },
            mt: { xs: 6, sm: 6, md: 4 },
            mx: "auto",
          }}
        >
          <Box
            sx={{
              position: "relative",
              borderRadius: { xs: 3, sm: 4 },
              p: { xs: 2.2, sm: 4 },
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.76)) padding-box, linear-gradient(135deg, rgba(37,99,235,0.45), rgba(16,185,129,0.4), rgba(251,191,36,0.35)) border-box",
              border: "1px solid transparent",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
              backdropFilter: "blur(18px)",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 20% 15%, rgba(255,255,255,0.85), transparent 55%), radial-gradient(circle at 90% 85%, rgba(147,197,253,0.25), transparent 50%)",
                opacity: 0.8,
                pointerEvents: "none",
              }}
            />
            <Box sx={{ position: "relative", zIndex: 1 }}>
              <Box
                sx={{
                  textAlign: "center",
                  mb: 3,
                  display: "grid",
                  gap: { xs: 1.1, sm: 1.4 },
                  justifyItems: "center",
                }}
              >
                <AnimatedLogo />
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    mt: 0.5,
                    mb: 0.5,
                    color: "#0f172a",
                    fontFamily: headingFont,
                    fontSize: { xs: "1.5rem", sm: "2rem" },
                    lineHeight: 1.2,
                    letterSpacing: -0.2,
                  }}
                >
                  Bienvenido
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "rgba(15, 23, 42, 0.7)",
                    maxWidth: { xs: 240, sm: 320 },
                    fontSize: { xs: "0.88rem", sm: "0.95rem" },
                  }}
                >
                  Ingresa tus credenciales para continuar
                </Typography>
              </Box>

              <Box
                component="form"
                onSubmit={onSubmit}
                autoComplete="off"
                sx={{
                  display: "grid",
                  gap: { xs: 1.6, sm: 2.2 },
                  textAlign: "left",
                  px: { xs: 0, sm: 0 },
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Box sx={{ color: "#0f766e", display: "grid", placeItems: "center" }}>
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                            <path
                              d="M4 20c1.6-3.4 4.6-5 8-5s6.4 1.6 8 5"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            />
                          </svg>
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                  variant="outlined"
                  sx={inputSx}
                  error={touched.username && !username}
                  helperText={touched.username && !username ? "Ingresa tu usuario" : " "}
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
                    startAdornment: (
                      <InputAdornment position="start">
                        <Box sx={{ color: "#0f766e", display: "grid", placeItems: "center" }}>
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect
                              x="5"
                              y="10"
                              width="14"
                              height="10"
                              rx="2"
                              stroke="currentColor"
                              strokeWidth="1.6"
                            />
                            <path
                              d="M8 10V7a4 4 0 018 0v3"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            />
                          </svg>
                        </Box>
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword((prev) => !prev)}
                          size="small"
                          type="button"
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          sx={{
                            color: "rgba(15, 23, 42, 0.7)",
                            backgroundColor: "rgba(226, 232, 240, 0.55)",
                            borderRadius: 1.2,
                            width: 36,
                            height: 36,
                            "&:hover": {
                              backgroundColor: "rgba(191, 219, 254, 0.6)",
                            },
                          }}
                        >
                          {showPassword ? (
                            <svg
                              width="20"
                              height="20"
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
                              width="20"
                              height="20"
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
                              <path
                                d="M4 4l16 16"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  variant="outlined"
                  sx={inputSx}
                  error={touched.password && !password}
                  helperText={touched.password && !password ? "Ingresa tu contraseña" : " "}
                  inputProps={{ autoComplete: "new-password" }}
                />
                <Box sx={{ display: "grid", gap: 1 }}>
                  <Collapse in={Boolean(error)}>
                    <Alert
                      severity="error"
                      variant="filled"
                      sx={{ borderRadius: 2, boxShadow: "0 8px 18px rgba(239, 68, 68, 0.25)" }}
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
                  </Collapse>
                  <Collapse in={Boolean(success)}>
                    <Alert
                      severity="success"
                      variant="filled"
                      sx={{ borderRadius: 2, boxShadow: "0 8px 18px rgba(16, 185, 129, 0.25)" }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {success}
                      </Typography>
                      {successDetail && (
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>
                          {successDetail}
                        </Typography>
                      )}
                    </Alert>
                  </Collapse>
                </Box>
                {submitting && (
                  <LinearProgress
                    sx={{
                      borderRadius: 999,
                      height: 6,
                      backgroundColor: "rgba(37, 99, 235, 0.16)",
                      "& .MuiLinearProgress-bar": {
                        background: "linear-gradient(90deg, #2563eb 0%, #10b981 100%)",
                      },
                    }}
                  />
                )}
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={submitting}
                  sx={{
                    py: { xs: 1.25, sm: 1.45 },
                    fontWeight: 700,
                    letterSpacing: { xs: 0.6, sm: 1 },
                    borderRadius: 2,
                    textTransform: "none",
                    background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
                    boxShadow: "0 16px 28px rgba(37, 99, 235, 0.3)",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-1px)",
                      boxShadow: "0 20px 32px rgba(37, 99, 235, 0.35)",
                    },
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
          </Box>
        </Box>
      </Box>
      <Box
        component="footer"
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          py: { xs: 2.5, sm: 3 },
          px: { xs: 2, sm: 4, md: 6 },
          textAlign: "center",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.75) 45%, rgba(255,255,255,0.92) 100%)",
          borderTop: "1px solid rgba(226, 232, 240, 0.6)",
        }}
      >
        <Box
          sx={{
            maxWidth: 680,
            mx: "auto",
            display: "grid",
            gap: 0.6,
            color: "rgba(15, 23, 42, 0.68)",
            fontSize: { xs: "0.78rem", sm: "0.85rem" },
          }}
        >
          <Box
            sx={{
              height: 6,
              borderRadius: 999,
              background:
                "linear-gradient(90deg, rgba(16,185,129,0.35) 0%, rgba(59,130,246,0.35) 45%, rgba(250,204,21,0.3) 100%)",
              boxShadow: "0 8px 18px rgba(37, 99, 235, 0.12)",
            }}
          />
          <Typography variant="caption" sx={{ letterSpacing: 0.6 }}>
            Version {appVersion}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
