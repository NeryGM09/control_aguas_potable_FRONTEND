import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Container, Divider, Paper, Typography } from "@mui/material";
import TableControl from "./components/TableControl";
import UserCreateForm from "./components/UserCreateForm";
import ChangePasswordForm from "./components/ChangePasswordForm";
import ProfileMenu from "./components/ProfileMenu";
import LoadingScreen from "./components/LoadingScreen";
import Login from "./pages/Login";
import { useAuth } from "./auth/AuthContext";
import { getSociedadLogoSrc } from "./utils/sociedadLogo";
import "./styles/App.css";

function App() {
  const { user, loading, logout } = useAuth();
  const [activePanel, setActivePanel] = useState(null);
  const [postLoginLoading, setPostLoginLoading] = useState(false);
  const prevUserRef = useRef(null);
  const loginTimerRef = useRef(null);
  const logoSrc = useMemo(() => getSociedadLogoSrc(user), [user]);

  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const handleOpenPassword = () => {
    if (isAdmin) {
      setActivePanel("password");
    }
  };

  const handleOpenCreateUser = () => {
    setActivePanel("create-user");
  };

  useEffect(() => {
    const prevUser = prevUserRef.current;
    if (!prevUser && user) {
      setPostLoginLoading(true);
      if (loginTimerRef.current) {
        clearTimeout(loginTimerRef.current);
      }
      loginTimerRef.current = setTimeout(() => {
        setPostLoginLoading(false);
      }, 1200);
    }

    if (!user) {
      setPostLoginLoading(false);
    }

    prevUserRef.current = user;
    return () => {
      if (loginTimerRef.current) {
        clearTimeout(loginTimerRef.current);
      }
    };
  }, [user]);

  if (loading) {
    return <div className="p-4">Cargando...</div>;
  }

  if (!user) {
    return <Login />;
  }

  if (postLoginLoading) {
    return <LoadingScreen message="Iniciando sesión..." />;
  }

  return (
    <Box className="app-root">
      <Container maxWidth={false} className="app-container">
        <Paper elevation={0} className="app-header">
          <Box className="app-header-row">
            <Box className="app-brand">
              <Box
                component="img"
                src={logoSrc}
                alt="Logo"
                className="app-logo"
              />
              <Box className="app-title-group">
                <Typography
                  variant="overline"
                  className="app-overline"
                >
                  Control de Agua Potable
                </Typography>
                <Typography
                  variant="h5"
                  className="app-title"
                >
                  Panel de registros
                </Typography>
              </Box>
            </Box>

            <Divider className="app-divider" />
            <Box className="app-actions">
              <ProfileMenu
                user={user}
                isAdmin={isAdmin}
                onOpenPassword={handleOpenPassword}
                onOpenCreateUser={handleOpenCreateUser}
                onLogout={logout}
              />
            </Box>
          </Box>
        </Paper>

        {activePanel === "password" && isAdmin && (
          <ChangePasswordForm onClose={() => setActivePanel(null)} />
        )}
        {activePanel === "create-user" && isAdmin && (
          <UserCreateForm onClose={() => setActivePanel(null)} />
        )}
        <TableControl />
      </Container>
    </Box>
  );
}
export default App;
