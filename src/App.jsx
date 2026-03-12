import React, { useState } from "react";
import { Box, Container, Paper, Typography } from "@mui/material";
import TableControl from "./components/TableControl";
import UserCreateForm from "./components/UserCreateForm";
import ChangePasswordForm from "./components/ChangePasswordForm";
import ProfileMenu from "./components/ProfileMenu";
import Login from "./pages/Login";
import { useAuth } from "./auth/AuthContext";
import logo from "./assets/logo.png";

function App() {
  const { user, loading, logout } = useAuth();
  const [activePanel, setActivePanel] = useState(null);

  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const handleOpenPassword = () => {
    setActivePanel("password");
  };

  const handleOpenCreateUser = () => {
    setActivePanel("create-user");
  };

  if (loading) {
    return <div className="p-4">Cargando...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f4f7fb 0%, #eef2f7 100%)",
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
            borderRadius: 3,
            border: "1px solid rgba(148, 163, 184, 0.3)",
            boxShadow: "0 12px 30px rgba(30, 64, 175, 0.08)",
            width: "100%",
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
              }}
            >
              <Box
                component="img"
                src={logo}
                alt="Logo"
                sx={{ height: { xs: 48, sm: 56 }, width: "auto", objectFit: "contain" }}
              />
              <Box>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  <Typography
                    variant="overline"
                    sx={{ letterSpacing: 3, color: "text.secondary" }}
                  >
                    Control de Agua Potable
                  </Typography>
                </Box>
              </Box>
            </Box>

            <ProfileMenu
              user={user}
              isAdmin={isAdmin}
              onOpenPassword={handleOpenPassword}
              onOpenCreateUser={handleOpenCreateUser}
              onLogout={logout}
            />
          </Box>
        </Paper>

        {activePanel === "password" && <ChangePasswordForm />}
        {activePanel === "create-user" && isAdmin && <UserCreateForm />}
        <TableControl />
      </Container>
    </Box>
  );
}

export default App;
