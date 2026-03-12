import React, { useState } from "react";
import {
  Box,
  Button,
  Collapse,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  api,
  clearApiBaseURLOverride,
  getApiBaseURL,
  getApiBaseURLOverride,
  setApiBaseURL,
} from "../api/api";

const TEST_TIMEOUT_MS = 5000;

export default function ServerConfig() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(getApiBaseURL() || "");
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [hasOverride, setHasOverride] = useState(Boolean(getApiBaseURLOverride()));
  const currentBaseURL = getApiBaseURL() || "";
  const healthURL = currentBaseURL ? `${currentBaseURL.replace(/\/+$/, "")}/health` : "";

  const handleSave = () => {
    const next = setApiBaseURL(value);
    setValue(next || "");
    setHasOverride(Boolean(getApiBaseURLOverride()));
    setStatus({ type: "success", message: "Servidor guardado." });
  };

  const handleReset = () => {
    const next = clearApiBaseURLOverride();
    setValue(next || "");
    setHasOverride(false);
    setStatus({ type: "info", message: "Servidor restablecido." });
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      await api.get("/health", { timeout: TEST_TIMEOUT_MS });
      setStatus({ type: "success", message: "Servidor OK." });
    } catch (err) {
      const statusCode = err?.response?.status;
      const message = err?.message ? ` (${err.message})` : "";
      if (err?.code === "ECONNABORTED") {
        setStatus({ type: "error", message: `Tiempo de espera agotado.${message}` });
      } else if (statusCode) {
        setStatus({ type: "error", message: `Error del servidor (${statusCode}).${message}` });
      } else {
        setStatus({ type: "error", message: `Sin conexion con el servidor.${message}` });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Button
        size="small"
        variant="text"
        onClick={() => setOpen((prev) => !prev)}
        sx={{ textTransform: "none", fontWeight: 600 }}
      >
        {open ? "Ocultar configuracion del servidor" : "Configurar servidor"}
      </Button>
      <Collapse in={open}>
        <Box
          sx={{
            mt: 1.5,
            p: 2,
            borderRadius: 2,
            border: "1px solid rgba(148, 163, 184, 0.35)",
            background: "rgba(248, 250, 252, 0.8)",
          }}
        >
          <Stack spacing={1.5}>
            <TextField
              label="Servidor (URL)"
              size="small"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="http://192.168.1.10:8000"
              fullWidth
              InputLabelProps={{ required: false }}
              helperText="Ejemplo: http://192.168.1.10:8000"
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSave}>
                Guardar
              </Button>
              <Button variant="outlined" onClick={handleTest} disabled={testing}>
                {testing ? <CircularProgress size={18} /> : "Probar"}
              </Button>
              {hasOverride && (
                <Button variant="text" onClick={handleReset}>
                  Restablecer
                </Button>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              URL actual: {currentBaseURL || "sin definir"}
            </Typography>
            {healthURL && (
              <Typography variant="caption" color="text.secondary">
                Health: {healthURL}
              </Typography>
            )}
            {status && (
              <Typography
                variant="body2"
                color={
                  status.type === "error"
                    ? "error"
                    : status.type === "success"
                    ? "success.main"
                    : "text.secondary"
                }
              >
                {status.message}
              </Typography>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}
