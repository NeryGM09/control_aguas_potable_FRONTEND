import React, { useState } from "react";
import { Box, Button, Divider, Paper, Stack, TextField, Typography } from "@mui/material";
import { api } from "../api/api";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!currentPassword || !newPassword) {
      setError("Completa ambas contrase\u00f1as.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess("Contrase\u00f1a actualizada.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError("No autorizado.");
      } else if (status === 400) {
        setError("La contrase\u00f1a actual no es correcta.");
      } else {
        setError("No se pudo actualizar la contrase\u00f1a.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2, md: 3 },
        mb: { xs: 2, md: 3 },
        borderRadius: 3,
        border: "1px solid rgba(148, 163, 184, 0.3)",
        boxShadow: "0 10px 24px rgba(30, 64, 175, 0.08)",
        width: "100%",
        background: "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)",
      }}
    >
      <Stack spacing={0.75}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Cambiar contrase\u00f1a
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Actualiza tu clave de acceso
        </Typography>
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
          label="Contrase\u00f1a actual"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          fullWidth
          required
          size="small"
        />
        <TextField
          label="Nueva contrase\u00f1a"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          fullWidth
          required
          size="small"
        />
        {error && (
          <Typography color="error" variant="body2" sx={{ gridColumn: "1 / -1" }}>
            {error}
          </Typography>
        )}
        {success && (
          <Typography color="success.main" variant="body2" sx={{ gridColumn: "1 / -1" }}>
            {success}
          </Typography>
        )}
        <Box sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-end" } }}>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {submitting ? "Guardando..." : "Actualizar contrase\u00f1a"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
