import React, { useState } from "react";
import { Avatar, Box, Button, IconButton, Menu, MenuItem, Typography } from "@mui/material";

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
        gap: 1.5,
        width: { xs: "100%", sm: "auto" },
      }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {user.username}
      </Typography>

      <IconButton
        onClick={handleMenuOpen}
        size="small"
        sx={{ border: "1px solid rgba(148, 163, 184, 0.4)" }}
      >
        <Avatar sx={{ width: 30, height: 30, fontSize: 13, fontWeight: 700 }}>
          {String(user?.username || "U").charAt(0).toUpperCase()}
        </Avatar>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem disabled>
          {user.username} ({isAdmin ? "Administrador" : "Usuario"})
        </MenuItem>
        <MenuItem onClick={handlePasswordClick}>{"Cambiar contrase\u00f1a"}</MenuItem>
        {isAdmin && <MenuItem onClick={handleCreateUserClick}>Agregar usuario</MenuItem>}
      </Menu>

      <Button
        variant="outlined"
        size="small"
        onClick={onLogout}
        sx={{ width: { xs: "100%", sm: "auto" } }}
      >
        Salir
      </Button>
    </Box>
  );
}
