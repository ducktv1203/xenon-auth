import { createTheme, alpha } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#f97316",
      dark: "#ea580c",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#0f172a",
    },
    background: {
      default: "#f6f4ef",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
      secondary: "#475569",
    },
    divider: "#e2e8f0",
  },
  shape: {
    borderRadius: 18,
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
          boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          backgroundColor: alpha("#0f172a", 0.08),
        },
        bar: {
          borderRadius: 999,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          border: "1px solid #e2e8f0",
          boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
        },
      },
    },
  },
});
