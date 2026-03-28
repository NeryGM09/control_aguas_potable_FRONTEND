import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { api } from "../api/api";
import "../styles/components/ChangePasswordForm.css";

export default function ChangePasswordForm({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canClose = typeof onClose === "function";

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
    <Paper elevation={0} className="change-password-card">
      <Box className="change-password-orb" />
      <Box className="change-password-header">
        <Box className="change-password-title-group">
          <Box className="change-password-icon-box">
            <LockRoundedIcon className="change-password-icon" />
          </Box>
          <Box>
            <Typography variant="h6" className="change-password-title">
              Cambiar contraseña
            </Typography>
            <Typography variant="body2" className="change-password-subtitle">
              Solo administradores
            </Typography>
          </Box>
        </Box>
        {canClose && (
          <IconButton
            type="button"
            onClick={onClose}
            className="change-password-close"
          >
            <CloseRoundedIcon />
          </IconButton>
        )}
      </Box>
      <Divider className="change-password-divider" />

      <Box component="form" onSubmit={onSubmit} className="change-password-form">
        <TextField
          label="Contraseña actual"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          fullWidth
          required
          size="small"
          className="change-password-field"
        />
        <TextField
          label="Nueva contraseña"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          fullWidth
          required
          size="small"
          className="change-password-field"
        />
        {error && (
          <Alert severity="error" variant="filled" className="change-password-alert">
            <Typography variant="body2" className="change-password-alert-title">
              {error}
            </Typography>
          </Alert>
        )}
        {success && (
          <Alert severity="success" variant="filled" className="change-password-alert">
            <Typography variant="body2" className="change-password-alert-title">
              {success}
            </Typography>
          </Alert>
        )}
        <Box className="change-password-actions">
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            className="change-password-submit"
          >
            {submitting ? "Guardando..." : "Actualizar contraseña"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
