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
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import "../styles/components/ProfileMenu.css";

export default function ProfileMenu({
  user,
  isAdmin,
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

  const handleCreateUserClick = () => {
    onOpenCreateUser();
    handleMenuClose();
  };

  return (
    <Box className="profile-menu">
      <Button
        onClick={handleMenuOpen}
        variant="outlined"
        className="profile-menu-button"
      >
        <Avatar className="profile-menu-avatar">
          {String(user?.username || "U").charAt(0).toUpperCase()}
        </Avatar>
        <Box className="profile-menu-text">
          <Typography variant="body2" className="profile-menu-username">
            {user.username}
          </Typography>
          <Typography variant="caption" className="profile-menu-role">
            {isAdmin ? "Administrador" : "Usuario"}
          </Typography>
        </Box>
        <ExpandMoreIcon className="profile-menu-expand" />
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          className: "profile-menu-paper",
        }}
      >
        <Box className="profile-menu-header">
          <Avatar className="profile-menu-header-avatar">
            {String(user?.username || "U").charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" className="profile-menu-header-name">
              {user.username}
            </Typography>
            <Typography variant="caption" className="profile-menu-role">
              {isAdmin ? "Administrador" : "Usuario"}
            </Typography>
          </Box>
        </Box>
        <Divider />
        {isAdmin && (
          <MenuItem onClick={handleCreateUserClick}>
            <ListItemIcon className="profile-menu-item-icon profile-menu-item-icon--create">
              <PersonAddAltRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Agregar usuario" />
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={onLogout} className="profile-menu-item--logout">
          <ListItemIcon className="profile-menu-item-icon profile-menu-item-icon--logout">
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Cerrar sesión" />
        </MenuItem>
      </Menu>
    </Box>
  );
}
