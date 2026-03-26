import React from "react";
import { Box } from "@mui/material";
import headSvg from "../assets/head.svg";

export default function AnimatedLogo({ width = { xs: 220, sm: 280 }, showText = true }) {
  return (
    <Box
      sx={{
        width,
        maxWidth: "100%",
        mx: "auto",
        "@keyframes logoFloat": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "@keyframes caneSway": {
          "0%, 100%": { transform: "rotate(-1.2deg)" },
          "50%": { transform: "rotate(1.4deg)" },
        },
        "@keyframes lakePulse": {
          "0%, 100%": { transform: "scale(0.99)", opacity: 0.92 },
          "50%": { transform: "scale(1.02)", opacity: 1 },
        },
        "@keyframes ripplePulse": {
          "0%": { opacity: 0.5, transform: "scale(0.98)" },
          "55%": { opacity: 0.9, transform: "scale(1.02)" },
          "100%": { opacity: 0.6, transform: "scale(1.04)" },
        },
        "@keyframes shimmerMove": {
          "0%": { transform: "translateX(-6px)" },
          "100%": { transform: "translateX(6px)" },
        },
        "& svg": {
          display: "block",
          width: "100%",
          height: "auto",
        },
        "& .logo-float": {
          animation: "logoFloat 6s ease-in-out infinite",
          transformOrigin: "center",
          transformBox: "fill-box",
        },
        "& .logo-cane": {
          animation: "caneSway 7s ease-in-out infinite",
          transformOrigin: "center",
          transformBox: "fill-box",
        },
        "& .logo-lake": {
          animation: "lakePulse 5.4s ease-in-out infinite",
          transformOrigin: "center",
          transformBox: "fill-box",
        },
        "& .logo-ripple": {
          animation: "ripplePulse 3.2s ease-in-out infinite",
          transformOrigin: "center",
          transformBox: "fill-box",
        },
        "& .ripple-2": { animationDelay: "0.35s" },
        "& .ripple-3": { animationDelay: "0.7s" },
        "& .logo-shimmer": {
          animation: "shimmerMove 4.8s ease-in-out infinite alternate",
        },
        "& .logo-text": {
          fontFamily: "'Manrope', 'Trebuchet MS', 'Segoe UI', sans-serif",
          fontWeight: 700,
          letterSpacing: 1.4,
        },
        "@media (prefers-reduced-motion: reduce)": {
          "& .logo-float, & .logo-cane, & .logo-lake, & .logo-ripple, & .logo-shimmer": {
            animation: "none",
          },
        },
      }}
    >
      <svg viewBox="0 0 520 360" role="img" aria-label="Control de Aguas Potable">
        <defs>
          <linearGradient id="gLake" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="gLakeEdge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
          </linearGradient>
          <radialGradient id="gLakeGlow" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gLakeHighlight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
          </linearGradient>
          <filter id="softShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#1d4ed8" floodOpacity="0.18" />
          </filter>
        </defs>

        <g className="logo-lake-group">
          <ellipse className="logo-lake" cx="260" cy="270" rx="170" ry="38" fill="url(#gLake)" />
          <ellipse cx="260" cy="268" rx="150" ry="30" fill="url(#gLakeGlow)" opacity="0.9" />
          <ellipse
            className="logo-lake-edge"
            cx="260"
            cy="270"
            rx="170"
            ry="38"
            fill="none"
            stroke="url(#gLakeEdge)"
            strokeWidth="4"
          />
          <path
            className="logo-shimmer"
            d="M165 268 C200 260 235 260 260 266 C285 272 320 274 355 268"
            fill="none"
            stroke="url(#gLakeHighlight)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>

        <g className="logo-float" filter="url(#softShadow)">
          <g className="logo-cane">
            <image href={headSvg} x="170" y="22" width="180" height="230" preserveAspectRatio="xMidYMid meet" />
          </g>
        </g>

        <g className="logo-ripples">
          <ellipse
            className="logo-ripple ripple-1"
            cx="260"
            cy="286"
            rx="118"
            ry="14"
            fill="none"
            stroke="url(#gLakeEdge)"
            strokeWidth="4"
          />
          <ellipse
            className="logo-ripple ripple-2"
            cx="260"
            cy="286"
            rx="92"
            ry="11"
            fill="none"
            stroke="rgba(37, 99, 235, 0.6)"
            strokeWidth="3"
          />
          <ellipse
            className="logo-ripple ripple-3"
            cx="260"
            cy="286"
            rx="66"
            ry="8"
            fill="none"
            stroke="rgba(14, 116, 144, 0.55)"
            strokeWidth="3"
          />
        </g>

        {showText && (
          <text x="260" y="338" textAnchor="middle" className="logo-text" fontSize="28">
            <tspan fill="#16a34a">CONTROL </tspan>
            <tspan fill="#f59e0b">DE AGUAS </tspan>
            <tspan fill="#2563eb">POTABLE</tspan>
          </text>
        )}
      </svg>
    </Box>
  );
}
