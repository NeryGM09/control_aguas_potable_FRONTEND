import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { api } from "../api/api";

export default function ChangePasswordForm({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
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

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!currentPassword || !newPassword) {
      setError("Completa ambas contraseñas.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess("Contraseña actualizada.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError("No autorizado.");
      } else if (status === 400) {
        setError("La contraseña actual no es correcta.");
      } else {
        setError("No se pudo actualizar la contraseña.");
      }
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
          "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(239,246,255,0.9) 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: -80,
          left: -110,
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
                "linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(14,165,233,0.2) 100%)",
              boxShadow: "0 10px 20px rgba(15, 23, 42, 0.12)",
            }}
          >
            <LockRoundedIcon sx={{ color: "#1d4ed8" }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0f172a" }}>
              Cambiar contraseña
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Solo administradores
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
          label="Contraseña actual"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          fullWidth
          required
          size="small"
          sx={inputSx}
        />
        <TextField
          label="Nueva contraseña"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          fullWidth
          required
          size="small"
          sx={inputSx}
        />
        {error && (
          <Alert severity="error" variant="filled" sx={{ gridColumn: "1 / -1", borderRadius: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {error}
            </Typography>
          </Alert>
        )}
        {success && (
          <Alert severity="success" variant="filled" sx={{ gridColumn: "1 / -1", borderRadius: 2 }}>
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
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              boxShadow: "0 14px 26px rgba(37, 99, 235, 0.28)",
              "&:hover": {
                boxShadow: "0 18px 32px rgba(37, 99, 235, 0.32)",
              },
            }}
          >
            {submitting ? "Guardando..." : "Actualizar contraseña"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
