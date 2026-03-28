import { alpha, createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1d4ed8",
      light: "#60a5fa",
      dark: "#1e40af",
    },
    secondary: {
      main: "#0f766e",
      light: "#14b8a6",
      dark: "#115e59",
    },
    background: {
      default: "#f4f7fb",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
      secondary: "#475569",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
    h4: {
      fontFamily: "\"IBM Plex Serif\", \"IBM Plex Sans\", serif",
      fontWeight: 700,
      letterSpacing: -0.4,
    },
    h5: {
      fontFamily: "\"IBM Plex Serif\", \"IBM Plex Sans\", serif",
      fontWeight: 700,
      letterSpacing: -0.3,
    },
    h6: {
      fontFamily: "\"IBM Plex Serif\", \"IBM Plex Sans\", serif",
      fontWeight: 700,
      letterSpacing: -0.2,
    },
    subtitle1: {
      fontWeight: 600,
      letterSpacing: 0.1,
    },
    subtitle2: {
      fontWeight: 600,
      letterSpacing: 0.1,
    },
    button: {
      fontWeight: 600,
      textTransform: "none",
      letterSpacing: 0.3,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#f4f7fb",
          color: "#0f172a",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: "none",
          fontWeight: 600,
          transition: "box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease",
        },
        contained: {
          boxShadow: "0 10px 18px rgba(15, 23, 42, 0.12)",
          "&:hover": {
            boxShadow: "0 14px 24px rgba(15, 23, 42, 0.16)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: alpha("#ffffff", 0.98),
          transition: "box-shadow 0.2s ease, border-color 0.2s ease",
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha("#1d4ed8", 0.45),
          },
          "&.Mui-focused": {
            boxShadow: `0 0 0 3px ${alpha("#1d4ed8", 0.12)}`,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#1d4ed8",
          },
        },
        notchedOutline: {
          borderColor: "rgba(148, 163, 184, 0.32)",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        asterisk: {
          display: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "rgba(148, 163, 184, 0.25)",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          letterSpacing: 0.6,
          fontSize: "0.72rem",
          color: "#1e293b",
        },
        body: {
          fontSize: "0.86rem",
          color: "#0f172a",
        },
      },
    },
  },
});

export default theme;
