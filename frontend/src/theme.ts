import { createTheme, alpha } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#ff5f1f",
      dark: "#e24c0f",
      contrastText: "#0d0d0d",
    },
    secondary: {
      main: "#94a3b8",
    },
    background: {
      default: "#0d0d0d",
      paper: "#161616",
    },
    text: {
      primary: "#f8fafc",
      secondary: "#a1a1aa",
    },
    divider: "#2f2f2f",
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: ["Segoe UI", "system-ui", "sans-serif"].join(","),
    h1: {
      fontWeight: 700,
      letterSpacing: "-0.04em",
    },
    h2: {
      fontWeight: 650,
      letterSpacing: "-0.03em",
    },
    h3: {
      fontWeight: 650,
    },
    button: {
      fontWeight: 700,
      letterSpacing: "0.01em",
      textTransform: "none",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: "0 14px 34px rgba(0, 0, 0, 0.35)",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          backgroundColor: alpha("#ffffff", 0.08),
        },
        bar: {
          borderRadius: 999,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          border: "1px solid #2f2f2f",
          boxShadow: "0 14px 34px rgba(0, 0, 0, 0.35)",
        },
      },
    },
  },
});
