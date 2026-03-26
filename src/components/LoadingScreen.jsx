import React from "react";
import { Box, LinearProgress, Typography } from "@mui/material";
import AnimatedLogo from "./AnimatedLogo";

export default function LoadingScreen({ message = "Preparando panel..." }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: { xs: "100dvh", md: "100vh" },
        display: "grid",
        placeItems: "center",
        px: 3,
        background:
          "radial-gradient(circle at 20% 10%, rgba(59,130,246,0.16), transparent 45%), radial-gradient(circle at 85% 20%, rgba(34,197,94,0.16), transparent 50%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
      }}
    >
      <Box
        sx={{
          textAlign: "center",
          display: "grid",
          gap: 1.6,
          justifyItems: "center",
        }}
      >
        <AnimatedLogo width={{ xs: 220, sm: 280 }} showText />
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          {message}
        </Typography>
        <LinearProgress
          sx={{
            width: { xs: 160, sm: 220 },
            height: 6,
            borderRadius: 999,
            backgroundColor: "rgba(37, 99, 235, 0.16)",
            "& .MuiLinearProgress-bar": {
              background: "linear-gradient(90deg, #2563eb 0%, #10b981 100%)",
            },
          }}
        />
      </Box>
    </Box>
  );
}
