import React, { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";

export default function ProfileMenu({
  user,
  isAdmin,
  onOpenPassword,
  onOpenCreateUser,
  onLogout,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handlePasswordClick = () => {
    onOpenPassword();
    handleMenuClose();
  };

  const handleCreateUserClick = () => {
    onOpenCreateUser();
    handleMenuClose();
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexDirection: { xs: "column", sm: "row" },
        gap: 1.2,
        width: { xs: "100%", sm: "auto" },
        justifyContent: { xs: "center", sm: "flex-end" },
      }}
    >
      <Button
        onClick={handleMenuOpen}
        variant="outlined"
        sx={{
          textTransform: "none",
          borderRadius: 999,
          borderColor: "rgba(148, 163, 184, 0.5)",
          bgcolor: "rgba(255,255,255,0.85)",
          px: 1,
          py: 0.5,
          gap: 1,
          boxShadow: "0 8px 16px rgba(15, 23, 42, 0.08)",
          "&:hover": {
            borderColor: "rgba(59, 130, 246, 0.6)",
            bgcolor: "rgba(255,255,255,0.95)",
          },
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            fontSize: 13,
            fontWeight: 700,
            bgcolor: "rgba(59, 130, 246, 0.12)",
            color: "#1d4ed8",
          }}
        >
          {String(user?.username || "U").charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ textAlign: "left", lineHeight: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a" }}>
            {user.username}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {isAdmin ? "Administrador" : "Usuario"}
          </Typography>
        </Box>
        <ExpandMoreIcon sx={{ color: "text.secondary", fontSize: 18 }} />
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            mt: 1,
            minWidth: 220,
            boxShadow: "0 16px 34px rgba(15, 23, 42, 0.16)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            overflow: "hidden",
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(34,197,94,0.12) 100%)",
          }}
        >
          <Avatar
            sx={{
              width: 38,
              height: 38,
              fontSize: 14,
              fontWeight: 700,
              bgcolor: "rgba(59, 130, 246, 0.14)",
              color: "#1d4ed8",
            }}
          >
            {String(user?.username || "U").charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a" }}>
              {user.username}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {isAdmin ? "Administrador" : "Usuario"}
            </Typography>
          </Box>
        </Box>
        <Divider />
        {isAdmin && (
          <MenuItem onClick={handlePasswordClick}>
            <ListItemIcon sx={{ minWidth: 32, color: "#2563eb" }}>
              <LockRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Cambiar contraseña" />
          </MenuItem>
        )}
        {isAdmin && (
          <MenuItem onClick={handleCreateUserClick}>
            <ListItemIcon sx={{ minWidth: 32, color: "#16a34a" }}>
              <PersonAddAltRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Agregar usuario" />
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={onLogout} sx={{ color: "#b91c1c" }}>
          <ListItemIcon sx={{ minWidth: 32, color: "#b91c1c" }}>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Cerrar sesión" />
        </MenuItem>
      </Menu>

    </Box>
  );
}
