import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Container, Paper, Typography } from "@mui/material";
import TableControl from "./components/TableControl";
import UserCreateForm from "./components/UserCreateForm";
import ChangePasswordForm from "./components/ChangePasswordForm";
import ProfileMenu from "./components/ProfileMenu";
import LoadingScreen from "./components/LoadingScreen";
import Login from "./pages/Login";
import { useAuth } from "./auth/AuthContext";
import { getSociedadLogoSrc } from "./utils/sociedadLogo";

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
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 15% 15%, rgba(59,130,246,0.12) 0%, transparent 35%), radial-gradient(circle at 85% 5%, rgba(34,197,94,0.12) 0%, transparent 40%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
        py: { xs: 2, md: 4 },
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          width: "100%",
          px: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            mb: { xs: 2, md: 3 },
            borderRadius: 4,
            border: "1px solid rgba(148, 163, 184, 0.25)",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
            width: "100%",
            position: "relative",
            overflow: "hidden",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(236,245,255,0.95) 100%)",
            "&::before": {
              content: '""',
              position: "absolute",
              top: -60,
              right: -80,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 70%)",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: -80,
              left: -100,
              width: 220,
              height: 220,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(34,197,94,0.16) 0%, rgba(34,197,94,0) 70%)",
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: { xs: 1.5, md: 3 },
              alignItems: { xs: "center", md: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: "center",
                textAlign: { xs: "center", sm: "left" },
                gap: { xs: 1, sm: 2.5 },
                position: "relative",
                zIndex: 1,
              }}
            >
              <Box
                component="img"
                src={logoSrc}
                alt="Logo"
                sx={{ height: { xs: 50, sm: 62 }, width: "auto", objectFit: "contain" }}
              />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                <Typography
                  variant="overline"
                  sx={{
                    letterSpacing: 3,
                    color: "text.secondary",
                    fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
                  }}
                >
                  Control de Agua Potable
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: "#0f172a",
                    fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
                  }}
                >
                  Panel de registros
                </Typography>
              </Box>
            </Box>

            <Box sx={{ position: "relative", zIndex: 1 }}>
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
