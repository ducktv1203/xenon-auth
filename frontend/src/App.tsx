import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  LinearProgress,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

const STEP_SECONDS = 60;
const DEFAULT_BACKEND_URL = "http://localhost:8000";
const DEFAULT_SECRET = "JBSWY3DPEHPK3PXP";

const HOW_IT_WORKS = [
  {
    title: "Set the backend and secret",
    body: "Enter your API endpoint and base32 secret in the testing console. The page checks the backend status live.",
  },
  {
    title: "Preview the three-word token",
    body: "Each 60-second window resolves to a deterministic 3-word array derived from the TOTP digest.",
  },
  {
    title: "Keep personal decks encrypted",
    body: "Custom word decks stay client-side encrypted so the backend never receives plaintext user words.",
  },
];

const PRODUCT_POINTS = [
  "Three-word authentication without numeric codes.",
  "Local deck encryption for personal vocabulary.",
  "Backend health, token preview, and timing in one place.",
];

function useRefreshWindow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const elapsedSeconds = (now / 1000) % STEP_SECONDS;
  const secondsLeft = Math.ceil(STEP_SECONDS - elapsedSeconds);
  const progress = elapsedSeconds / STEP_SECONDS;
  const windowIndex = Math.floor(now / (STEP_SECONDS * 1000));

  return { secondsLeft, progress, windowIndex };
}

function useBackendHealth(backendUrl: string) {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [lastChecked, setLastChecked] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      try {
        const response = await fetch(`${backendUrl.replace(/\/$/, "")}/health`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        if (mounted) {
          setStatus("online");
          setLastChecked(new Date().toLocaleTimeString());
        }
      } catch {
        if (mounted) {
          setStatus("offline");
          setLastChecked(new Date().toLocaleTimeString());
        }
      }
    };

    setStatus("checking");
    void checkHealth();
    const id = window.setInterval(checkHealth, STEP_SECONDS * 1000);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [backendUrl]);

  return { status, lastChecked };
}

function ProgressRail({
  label,
  caption,
  value,
  tone = "primary",
}: {
  label: string;
  caption: string;
  value: number;
  tone?: "primary" | "success" | "error" | "neutral";
}) {
  const fillColor =
    tone === "success" ? "#16A34A" : tone === "error" ? "#DC2626" : tone === "neutral" ? "#64748B" : "#F97316";

  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {caption}
        </Typography>
      </Box>
      <Box
        sx={{
          position: "relative",
          height: 14,
          borderRadius: 999,
          backgroundColor: "#EEF2F7",
          border: "1px solid #E2E8F0",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: `${Math.max(8, Math.min(100, value * 100))}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: fillColor,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            px: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: 0.28,
          }}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <Box key={index} sx={{ width: 1, height: 8, backgroundColor: "text.primary" }} />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default function App() {
  const { secondsLeft, progress, windowIndex } = useRefreshWindow();
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [secretKey, setSecretKey] = useState(DEFAULT_SECRET);
  const [previewWords, setPreviewWords] = useState<string[]>(["PLUTO", "JAZZ", "ECHO"]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const { status, lastChecked } = useBackendHealth(backendUrl);

  const syncPreview = async () => {
    setLoadingPreview(true);
    try {
      setPreviewError(null);
      const response = await fetch(`${backendUrl.replace(/\/$/, "")}/preview/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret_key: secretKey }),
      });

      if (!response.ok) {
        throw new Error(`Backend responded ${response.status}`);
      }

      const payload = (await response.json()) as { words?: unknown };
      if (!Array.isArray(payload.words) || payload.words.length !== 3) {
        throw new Error("Invalid preview payload");
      }

      setPreviewWords(payload.words.map((word) => String(word).toUpperCase()));
      setPreviewUpdatedAt(new Date().toLocaleTimeString());
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Failed to sync preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    void syncPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl, secretKey, windowIndex]);

  const backendScore = status === "online" ? 100 : status === "checking" ? 50 : 12;
  const statusLabel = status === "online" ? "Connected" : status === "checking" ? "Checking" : "Offline";
  const countdownLabel = `${secondsLeft}s to refresh`;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "rgba(247, 244, 238, 0.84)",
          backdropFilter: "blur(16px)",
        }}
      >
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                }}
              >
                <SecurityRoundedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1 }}>
                  Xenon Auth
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Three-word authentication platform
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
              <Chip label="Overview" variant="outlined" component="a" href="#overview" clickable />
              <Chip label="How to use" variant="outlined" component="a" href="#how-it-works" clickable />
              <Chip label="Status" variant="outlined" component="a" href="#status" clickable />
              <Chip label="Testing" variant="outlined" component="a" href="#testing" clickable />
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 6 } }}>
        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1.4fr 0.95fr" } }} id="overview">
          <Paper sx={{ p: { xs: 3, md: 5 }, background: "linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%)" }}>
            <Box sx={{ display: "grid", gap: 3 }}>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip icon={<PlayArrowRoundedIcon />} label="Product page" color="primary" />
                <Chip label="Live status" variant="outlined" />
                <Chip label="Testing console" variant="outlined" />
              </Box>

              <Box>
                <Typography component="h1" variant="h1" sx={{ fontSize: { xs: 38, md: 60 }, lineHeight: 0.95, maxWidth: 12, mb: 2 }}>
                  Three-word 2FA for products that want better sign-in.
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760, fontSize: { xs: 16, md: 18 }, lineHeight: 1.8 }}>
                  Xenon Auth turns TOTP into a deterministic 3-word array, supports encrypted personal decks, and keeps status
                  and testing in the same place for easier rollout and support.
                </Typography>
              </Box>

              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Button variant="contained" href="#testing">
                  Open testing console
                </Button>
                <Button variant="outlined" href="#how-it-works">
                  How it works
                </Button>
              </Box>

              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" } }}>
                {PRODUCT_POINTS.map((point) => (
                  <Card key={point} variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        {point}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          </Paper>

          <Paper id="status" sx={{ p: 3 }}>
            <Box sx={{ display: "grid", gap: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Backend status
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 0.5, fontSize: { xs: 24, md: 28 }, fontWeight: 700 }}>
                    {statusLabel}
                  </Typography>
                </Box>
                <Chip
                  icon={status === "online" ? <CheckCircleRoundedIcon /> : <SettingsRoundedIcon />}
                  label={statusLabel}
                  color={status === "offline" ? "error" : "primary"}
                  variant={status === "checking" ? "outlined" : "filled"}
                />
              </Box>

              <ProgressRail
                label="Backend health"
                caption={status === "online" ? "API reachable" : status === "checking" ? "Checking now" : "No response"}
                value={backendScore / 100}
                tone={status === "online" ? "success" : status === "offline" ? "error" : "neutral"}
              />

              <Divider />

              <Box sx={{ display: "grid", gap: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Endpoint
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, wordBreak: "break-word" }}>
                  {backendUrl}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last checked: {lastChecked || "pending"}
                </Typography>
              </Box>

              <Alert icon={<VisibilityRoundedIcon />} severity={status === "offline" ? "warning" : "success"}>
                This panel confirms whether the app can reach the backend before you start testing codes.
              </Alert>
            </Box>
          </Paper>
        </Box>

        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "0.9fr 1.1fr" }, mt: 3 }} id="how-it-works">
          <Paper sx={{ p: 3 }}>
            <Typography variant="overline" color="text.secondary">
              How to use
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5, mb: 2, fontSize: { xs: 24, md: 30 }, fontWeight: 700 }}>
              A simple rollout path.
            </Typography>
            <Box sx={{ display: "grid", gap: 1.25 }}>
              {HOW_IT_WORKS.map((step, index) => (
                <Paper key={step.title} variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                    <Chip label={`0${index + 1}`} color="primary" sx={{ fontWeight: 800 }} />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {step.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.7 }}>
                        {step.body}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }} id="testing">
            <Box sx={{ display: "grid", gap: 3 }}>
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Testing console
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.5, fontSize: { xs: 24, md: 30 }, fontWeight: 700 }}>
                  Preview live codes and timing.
                </Typography>
              </Box>

              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                <TextField
                  fullWidth
                  label="Backend URL"
                  value={backendUrl}
                  onChange={(event) => setBackendUrl(event.target.value)}
                  helperText="Used for /health and /preview/words"
                />
                <TextField
                  fullWidth
                  label="Base32 secret"
                  value={secretKey}
                  onChange={(event) => setSecretKey(event.target.value.toUpperCase())}
                  helperText="This stays in the browser for local testing"
                />
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => void syncPreview()}>
                  {loadingPreview ? "Syncing..." : "Sync preview"}
                </Button>
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <ProgressRail label="Refresh cycle" caption={countdownLabel} value={progress} tone="primary" />
                </Box>
              </Box>

              {previewError ? (
                <Alert icon={<ErrorOutlineRoundedIcon />} severity="error">
                  {previewError}
                </Alert>
              ) : null}

              <Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Current three-word token
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Updated {previewUpdatedAt || "not yet"}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                  {previewWords.map((word) => (
                    <Box
                      key={word}
                      sx={{
                        flex: "1 1 120px",
                        py: 2,
                        px: 2,
                        textAlign: "center",
                        fontWeight: 800,
                        letterSpacing: "0.18em",
                        fontSize: 18,
                        borderRadius: 4,
                        bgcolor: "#fffdfa",
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      {word}
                    </Box>
                  ))}
                </Box>
              </Box>

              <Alert icon={<CheckCircleRoundedIcon />} severity={status === "offline" ? "warning" : "success"}>
                The page is designed for live testing, status checks, and rollout support.
              </Alert>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
