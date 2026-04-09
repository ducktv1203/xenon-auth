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
  Grid,
  LinearProgress,
  Paper,
  Stack,
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
const HALF_LIFE_SECONDS = 30;
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

export default function App() {
  const { secondsLeft, progress, windowIndex } = useRefreshWindow();
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [secretKey, setSecretKey] = useState(DEFAULT_SECRET);
  const [previewWords, setPreviewWords] = useState<string[]>(["PLUTO", "JAZZ", "ECHO"]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<string>("");
  const { status, lastChecked } = useBackendHealth(backendUrl);

  const syncPreview = async () => {
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
    }
  };

  useEffect(() => {
    void syncPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl, secretKey, windowIndex]);

  const backendScore = status === "online" ? 100 : status === "checking" ? 50 : 12;
  const backendLabel = status === "online" ? "Connected" : status === "checking" ? "Checking" : "Offline";
  const countdownLabel = `${secondsLeft}s until refresh`;

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(180deg, #f7f4ee 0%, #f4f6f8 100%)" }}>
      <Box
        component="header"
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(16px)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Stack direction="row" alignItems="center" gap={1.5}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  backgroundColor: "primary.main",
                  color: "primary.contrastText",
                }}
              >
                <SecurityRoundedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={800} lineHeight={1}>
                  Xenon Auth
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Three-word authentication platform
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ display: { xs: "none", md: "flex" } }}>
              <Chip label="Overview" variant="outlined" component="a" href="#overview" clickable />
              <Chip label="How to use" variant="outlined" component="a" href="#how-it-works" clickable />
              <Chip label="Status" variant="outlined" component="a" href="#status" clickable />
              <Chip label="Testing" variant="outlined" component="a" href="#testing" clickable />
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 6 } }}>
        <Grid container spacing={3} id="overview">
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: { xs: 3, md: 5 }, height: "100%", background: "linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%)" }}>
              <Stack spacing={3}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip icon={<PlayArrowRoundedIcon />} label="Product page" color="primary" variant="filled" />
                  <Chip label="Live status" variant="outlined" />
                  <Chip label="Testing console" variant="outlined" />
                </Stack>

                <Box>
                  <Typography variant="h1" sx={{ fontSize: { xs: 38, md: 60 }, lineHeight: 0.95, maxWidth: 11.5, mb: 2 }}>
                    Three-word 2FA for products that want better sign-in.
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760, fontSize: { xs: 16, md: 18 }, lineHeight: 1.8 }}>
                    Xenon Auth turns TOTP into a deterministic 3-word array, supports encrypted personal decks, and
                    keeps status and testing in the same place for easier rollout and support.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <Button variant="contained" href="#testing">
                    Open testing console
                  </Button>
                  <Button variant="outlined" href="#how-it-works">
                    How it works
                  </Button>
                </Stack>

                <Grid container spacing={2}>
                  {PRODUCT_POINTS.map((point) => (
                    <Grid key={point} item xs={12} sm={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="body2" color="text.secondary">
                            {point}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={5}>
            <Stack spacing={3} sx={{ height: "100%" }}>
              <Card id="status">
                <CardContent>
                  <Stack spacing={2.5}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                      <Box>
                        <Typography variant="overline" color="text.secondary">
                          Backend status
                        </Typography>
                        <Typography variant="h4" sx={{ mt: 0.5, fontSize: { xs: 24, md: 28 } }}>
                          {backendLabel}
                        </Typography>
                      </Box>
                      <Chip
                        icon={status === "online" ? <CheckCircleRoundedIcon /> : <SettingsRoundedIcon />}
                        label={backendLabel}
                        color={status === "offline" ? "error" : "primary"}
                        variant={status === "checking" ? "outlined" : "filled"}
                      />
                    </Stack>

                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="body2" color="text.secondary">
                          API health
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {backendScore}%
                        </Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={backendScore} sx={{ height: 12 }} />
                    </Box>

                    <Divider />

                    <Stack spacing={1.2}>
                      <Typography variant="body2" color="text.secondary">
                        Endpoint
                      </Typography>
                      <Typography variant="body1" fontWeight={700} sx={{ wordBreak: "break-word" }}>
                        {backendUrl}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Last checked: {lastChecked || "pending"}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Stack spacing={2.5}>
                    <Typography variant="h6">What to test right now</Typography>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <VisibilityRoundedIcon color="primary" fontSize="small" />
                        <Typography variant="body2">Preview the current three-word code.</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <VisibilityRoundedIcon color="primary" fontSize="small" />
                        <Typography variant="body2">Check the backend from both web and phone.</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <VisibilityRoundedIcon color="primary" fontSize="small" />
                        <Typography variant="body2">Use the timer bar to confirm 60-second refresh.</Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mt: { xs: 0, md: 1 } }} id="how-it-works">
          <Grid item xs={12} md={5}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  How to use
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.5, mb: 2 }}>
                  A simple rollout path.
                </Typography>
                <Stack spacing={2}>
                  {HOW_IT_WORKS.map((step, index) => (
                    <Paper key={step.title} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction="row" spacing={2} alignItems="flex-start">
                        <Chip label={`0${index + 1}`} color="primary" sx={{ fontWeight: 800 }} />
                        <Box>
                          <Typography variant="subtitle1" fontWeight={700}>
                            {step.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.7 }}>
                            {step.body}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7} id="testing">
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      Testing console
                    </Typography>
                    <Typography variant="h4" sx={{ mt: 0.5 }}>
                      Live backend preview
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Backend URL"
                        value={backendUrl}
                        onChange={(event) => setBackendUrl(event.target.value)}
                        helperText="Used for /health and /preview/words"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Base32 secret"
                        value={secretKey}
                        onChange={(event) => setSecretKey(event.target.value.toUpperCase())}
                        helperText="This is only used for local preview and testing"
                      />
                    </Grid>
                  </Grid>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
                    <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => void syncPreview()}>
                      Sync preview
                    </Button>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Refresh window
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {countdownLabel}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={progress * 100}
                        sx={{ height: 14, backgroundColor: "rgba(15,23,42,0.08)" }}
                      />
                    </Box>
                  </Stack>

                  {previewError ? (
                    <Alert icon={<ErrorOutlineRoundedIcon />} severity="error">
                      {previewError}
                    </Alert>
                  ) : null}

                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        Current three-word token
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Updated {previewUpdatedAt || "not yet"}
                      </Typography>
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      {previewWords.map((word) => (
                        <Paper
                          key={word}
                          variant="outlined"
                          sx={{
                            flex: 1,
                            py: 2,
                            px: 2,
                            textAlign: "center",
                            fontWeight: 800,
                            letterSpacing: "0.18em",
                            fontSize: 18,
                            backgroundColor: "#fffdfa",
                          }}
                        >
                          {word}
                        </Paper>
                      ))}
                    </Stack>
                  </Box>

                  <Alert icon={<CheckCircleRoundedIcon />} severity={status === "offline" ? "warning" : "success"}>
                    The page is designed for live testing, status checks, and rollout support.
                  </Alert>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
