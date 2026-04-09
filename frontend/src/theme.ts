import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#ff6b35",
      dark: "#e55a24",
      light: "#ff8555",
      contrastText: "#0a0a0a",
    },
    secondary: {
      main: "#f0f0f0",
      dark: "#d4d4d4",
      contrastText: "#0a0a0a",
    },
    background: {
      default: "#0a0a0a",
      paper: "#121212",
    },
    text: {
      primary: "#f5f5f5",
      secondary: "#a0a0a0",
    },
    divider: "#2a2a2a",
    error: {
      main: "#ff5252",
    },
    warning: {
      main: "#ffb74d",
    },
    success: {
      main: "#81c784",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "sans-serif",
    ].join(","),
    h1: {
      fontWeight: 800,
      letterSpacing: "-0.02em",
      lineHeight: 1.1,
    },
    h2: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h3: {
      fontWeight: 700,
    },
    body1: {
      lineHeight: 1.6,
    },
    body2: {
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 600,
      letterSpacing: "0.01em",
      textTransform: "none",
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          paddingInline: 16,
          textTransform: "none",
          fontWeight: 600,
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            transform: "translateY(-1px)",
          },
        },
        contained: {
          boxShadow: "0 8px 24px rgba(255, 107, 53, 0.3)",
          "&:hover": {
            boxShadow: "0 12px 32px rgba(255, 107, 53, 0.4)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
          border: "1px solid rgba(255, 107, 53, 0.1)",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#f5f5f5",
          borderRadius: 8,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          paddingLeft: 0,
          paddingRight: 0,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: "1px solid rgba(255, 107, 53, 0.15)",
          background:
            "linear-gradient(135deg, rgba(255, 107, 53, 0.05) 0%, rgba(255, 107, 53, 0.02) 100%)",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: "1px solid rgba(255, 107, 53, 0.18)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          height: 32,
          fontSize: "0.875rem",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          color: "#d4d4d4",
        },
        colorPrimary: {
          "&.Mui-checked": {
            color: "#ff6b35",
            "& + .MuiSwitch-track": {
              backgroundColor: "rgba(255, 107, 53, 0.5)",
            },
          },
        },
        track: {
          backgroundColor: "rgba(255,255,255,0.12)",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 700,
          minHeight: 48,
          color: "#a0a0a0",
          borderRadius: 10,
          marginRight: 6,
          "&.Mui-selected": {
            color: "#ff6b35",
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 52,
        },
        indicator: {
          height: 3,
          borderRadius: 999,
          background: "linear-gradient(90deg, #ff6b35 0%, #ff8555 100%)",
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: "1px solid rgba(255, 107, 53, 0.3)",
          color: "#a0a0a0",
          "&.Mui-selected": {
            backgroundColor: "rgba(255, 107, 53, 0.2)",
            color: "#ff6b35",
            borderColor: "rgba(255, 107, 53, 0.5)",
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          backgroundColor: "rgba(255, 107, 53, 0.08)",
          overflow: "hidden",
        },
        bar: {
          borderRadius: 999,
          backgroundImage: "linear-gradient(90deg, #ff6b35 0%, #ff8555 100%)",
        },
      },
    },
  },
});
