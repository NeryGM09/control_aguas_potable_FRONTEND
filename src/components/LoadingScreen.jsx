import React from "react";
import { Box, LinearProgress, Typography } from "@mui/material";
import AnimatedLogo from "./AnimatedLogo";
import "../styles/components/LoadingScreen.css";

export default function LoadingScreen({ message = "Preparando panel..." }) {
  return (
    <Box role="status" aria-live="polite" className="loading-screen">
      <Box className="loading-screen-card">
        <AnimatedLogo width={{ xs: 220, sm: 280 }} showText />
        <Typography variant="body2" className="loading-screen-message">
          {message}
        </Typography>
        <LinearProgress className="loading-screen-progress" />
      </Box>
    </Box>
  );
}
