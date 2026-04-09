import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import RouterRoundedIcon from "@mui/icons-material/RouterRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { BrandLogo } from "./BrandLogo";

const STEP_SECONDS = 60;
const DEFAULT_BACKEND_URL = "http://localhost:8000";
const DEFAULT_SECRET = "JBSWY3DPEHPK3PXP";

type PageTab = "status" | "testing" | "guide";

function ProgressBar({
  value,
  color = "#ff6b35",
  label,
}: {
  value: number;
  color?: string;
  label: string;
}) {
  const bounded = Math.max(0, Math.min(1, value));

  return (
    <Box sx={{ display: "grid", gap: 1, width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ color, fontWeight: 700, flexShrink: 0 }}>
          {Math.round(bounded * 100)}%
        </Typography>
      </Box>
      <Box
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(bounded * 100)}
        sx={{
          position: "relative",
          width: "100%",
          height: 12,
          borderRadius: 999,
          overflow: "hidden",
          bgcolor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,107,53,0.2)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.65)",
        }}
      >
        <LinearProgress
          variant="determinate"
          value={bounded * 100}
          sx={{
            height: "100%",
            borderRadius: 999,
            bgcolor: "transparent",
            "& .MuiLinearProgress-bar": {
              borderRadius: 999,
              background: `linear-gradient(90deg, ${color}, #ff8555)`,
              boxShadow: `0 0 16px ${color}66`,
              transition: "transform 260ms ease-out",
            },
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: `${bounded * 100}%`,
            width: 10,
            height: 10,
            borderRadius: "50%",
            bgcolor: "#fff7ed",
            border: `2px solid ${color}`,
            boxShadow: `0 0 0 3px ${color}22`,
            transform: "translate(-50%, -50%)",
            opacity: bounded > 0 ? 1 : 0,
            transition: "left 260ms ease-out, opacity 180ms ease-out",
            pointerEvents: "none",
          }}
        />
      </Box>
    </Box>
  );
}

function useRefreshWindow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = (now / 1000) % STEP_SECONDS;

  return {
    progress: elapsed / STEP_SECONDS,
    secondsLeft: Math.ceil(STEP_SECONDS - elapsed),
    windowIndex: Math.floor(now / (STEP_SECONDS * 1000)),
  };
}

function useBackendHealth(url: string, enabled: boolean) {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [lastChecked, setLastChecked] = useState("");

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    const run = async () => {
      try {
        const response = await fetch(`${url.replace(/\/$/, "")}/health`);
        if (!response.ok) {
          throw new Error("health check failed");
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
    void run();
    if (enabled) {
      timer = window.setInterval(run, STEP_SECONDS * 1000);
    }

    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, [url, enabled]);

  return { status, lastChecked };
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              borderRadius: 2,
              bgcolor: "rgba(255,107,53,0.12)",
              color: "primary.main",
              border: "1px solid rgba(255,107,53,0.2)",
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const { progress, secondsLeft, windowIndex } = useRefreshWindow();
  const [activeTab, setActiveTab] = useState<PageTab>("status");
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [secretKey, setSecretKey] = useState(DEFAULT_SECRET);
  const [autoHealth, setAutoHealth] = useState(true);
  const [autoPreview, setAutoPreview] = useState(true);
  const [previewWords, setPreviewWords] = useState<string[]>(["PLUTO", "JAZZ", "ECHO"]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const { status, lastChecked } = useBackendHealth(backendUrl, autoHealth);
  const backendScore = status === "online" ? 1 : status === "checking" ? 0.5 : 0.12;

  const quickSecrets = useMemo(
    () => [
      { label: "Demo", value: DEFAULT_SECRET },
      { label: "Ops A", value: "KRUGS4ZANFZSAYJA" },
      { label: "Ops B", value: "MZXW6YTBOI======" },
    ],
    [],
  );

  const syncPreview = async () => {
    setLoadingPreview(true);
    try {
      setPreviewError(null);
      const response = await fetch(`${backendUrl.replace(/\/$/, "")}/preview/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret_key: secretKey }),
      });
      if (!response.ok) throw new Error(`Backend responded ${response.status}`);

      const payload = (await response.json()) as { words?: unknown };
      if (!Array.isArray(payload.words) || payload.words.length !== 3) {
        throw new Error("Invalid preview payload");
      }

      setPreviewWords(payload.words.map((word) => String(word).toUpperCase()));
      setPreviewUpdatedAt(new Date().toLocaleTimeString());
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (autoPreview) {
      void syncPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl, secretKey, windowIndex, autoPreview]);

  const copyToken = async () => {
    const token = previewWords.join(" - ");
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const statusLabel = status === "online" ? "Connected" : status === "checking" ? "Checking" : "Offline";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage:
          "radial-gradient(circle at top left, rgba(255,107,53,0.12), transparent 30%), radial-gradient(circle at 85% 15%, rgba(255,107,53,0.08), transparent 24%), linear-gradient(180deg, #0a0a0a 0%, #101010 100%)",
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "rgba(10,10,10,0.76)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,107,53,0.12)",
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: { xs: 72, sm: 80 } }}>
          <BrandLogo compact />
          <Box sx={{ flex: 1 }} />
          <Chip
            icon={<ShieldRoundedIcon />}
            label={statusLabel}
            color={status === "offline" ? "error" : "primary"}
            variant={status === "checking" ? "outlined" : "filled"}
            sx={{ fontWeight: 700 }}
          />
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 3, sm: 4, md: 5 },
          display: "grid",
          gap: 3,
          pb: { xs: 4, md: 6 },
        }}
      >
        <Paper
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            background:
              "linear-gradient(135deg, rgba(255,107,53,0.09), rgba(255,107,53,0.03))",
            border: "1px solid rgba(255,107,53,0.14)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 20% 20%, rgba(255,107,53,0.12), transparent 28%), radial-gradient(circle at 90% 0%, rgba(255,255,255,0.05), transparent 18%)",
              pointerEvents: "none",
            }}
          />
          <Box sx={{ display: "grid", gap: 3, position: "relative", zIndex: 1 }}>
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <Chip
                label="Xenon Auth Dashboard"
                color="primary"
                sx={{ alignSelf: "flex-start", fontWeight: 800 }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: "2.05rem", sm: "2.7rem", md: "3.6rem" },
                  lineHeight: 1.08,
                  fontWeight: 900,
                  maxWidth: 980,
                }}
              >
                Passwordless authentication with time-synchronized word tokens.
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 920, fontSize: { xs: 15, sm: 16 } }}>
                Monitor backend availability, validate token generation, and guide rollout from a single MUI dashboard built for mobile and desktop.
              </Typography>
            </Box>

            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              <Button variant="contained" startIcon={<SyncRoundedIcon />} onClick={() => void syncPreview()}>
                {loadingPreview ? "Syncing tokens" : "Sync tokens now"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<ContentCopyRoundedIcon />}
                onClick={() => void copyToken()}
              >
                {copied ? "Copied" : "Copy current token"}
              </Button>
            </Box>
          </Box>
        </Paper>

        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } }}>
          <Box>
            <StatCard title="Backend" value={statusLabel} subtitle={lastChecked || "Waiting for first check"} icon={<RouterRoundedIcon />} />
          </Box>
          <Box>
            <StatCard title="Refresh" value={`${secondsLeft}s`} subtitle="Until the next token window" icon={<TimerRoundedIcon />} />
          </Box>
          <Box>
            <StatCard title="Preview" value={previewWords.join(" ")} subtitle={previewUpdatedAt ? `Updated ${previewUpdatedAt}` : "Not synced yet"} icon={<TerminalRoundedIcon />} />
          </Box>
          <Box>
            <StatCard title="Mode" value={autoPreview ? "Auto" : "Manual"} subtitle={autoHealth ? "Health polling enabled" : "Health polling disabled"} icon={<RefreshRoundedIcon />} />
          </Box>
        </Box>

        <Paper sx={{ p: 1 }}>
          <Tabs
            value={activeTab}
            onChange={(_, next) => setActiveTab(next)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ px: 0.5 }}
          >
            <Tab value="status" icon={<ShieldRoundedIcon />} iconPosition="start" label="Status" />
            <Tab value="testing" icon={<PlayArrowRoundedIcon />} iconPosition="start" label="Testing" />
            <Tab value="guide" icon={<ChecklistRoundedIcon />} iconPosition="start" label="Guide" />
          </Tabs>
        </Paper>

        {activeTab === "status" ? (
          <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.35fr) minmax(0, 0.95fr)" } }}>
            <Box>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ display: "grid", gap: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        Backend health overview
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Live connectivity and readiness indicators.
                      </Typography>
                    </Box>
                    <Chip
                      label={statusLabel}
                      color={status === "offline" ? "error" : "primary"}
                      variant={status === "checking" ? "outlined" : "filled"}
                    />
                  </Box>

                  <ProgressBar
                    value={backendScore}
                    label={`${Math.round(backendScore * 100)}% health confidence`}
                    color={status === "online" ? "#ff8555" : status === "offline" ? "#ff5252" : "#8a8a8a"}
                  />

                  <Divider />

                  <Box sx={{ display: "grid", gap: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Endpoint
                    </Typography>
                    <Typography sx={{ fontFamily: "monospace", color: "primary.main", fontWeight: 700, wordBreak: "break-word" }}>
                      {backendUrl}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Last checked: {lastChecked || "pending"}
                    </Typography>
                  </Box>

                  <Alert severity={status === "offline" ? "warning" : "success"} sx={{ borderRadius: 2 }}>
                    {status === "offline"
                      ? "Backend is unreachable. Verify the host, port, and CORS settings."
                      : "Backend is reachable and ready for testing."}
                  </Alert>
                </CardContent>
              </Card>
            </Box>

            <Box>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ display: "grid", gap: 2.5 }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Runtime controls
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Toggle health polling and token auto-sync.
                    </Typography>
                  </Box>

                  <Box sx={{ display: "grid", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>Auto status</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Poll /health every {STEP_SECONDS} seconds.
                        </Typography>
                      </Box>
                      <Switch checked={autoHealth} onChange={(event) => setAutoHealth(event.target.checked)} />
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>Auto preview</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Refresh words on each time window.
                        </Typography>
                      </Box>
                      <Switch checked={autoPreview} onChange={(event) => setAutoPreview(event.target.checked)} />
                    </Box>
                  </Box>

                  <Divider />

                  <Box sx={{ display: "grid", gap: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Refresh window
                    </Typography>
                    <ProgressBar value={progress} label={`${secondsLeft}s until the next window`} color="#ff6b35" />
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        ) : null}

        {activeTab === "testing" ? (
          <Card>
            <CardContent sx={{ display: "grid", gap: 3 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Interactive testing console
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Point the app at your backend and verify word rotation in real time.
                </Typography>
              </Box>

              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
                <Box>
                  <TextField
                    label="Backend URL"
                    value={backendUrl}
                    onChange={(event) => setBackendUrl(event.target.value)}
                    helperText="Used for /health and /preview/words"
                    fullWidth
                  />
                </Box>
                <Box>
                  <TextField
                    label="Base32 secret"
                    value={secretKey}
                    onChange={(event) => setSecretKey(event.target.value.toUpperCase())}
                    helperText="Leave uppercase for predictable token generation"
                    fullWidth
                  />
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {quickSecrets.map((entry) => (
                  <Button key={entry.label} variant="outlined" size="small" onClick={() => setSecretKey(entry.value)}>
                    {entry.label}
                  </Button>
                ))}
              </Box>

              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                <Button variant="contained" startIcon={<SyncRoundedIcon />} onClick={() => void syncPreview()} disabled={loadingPreview}>
                  {loadingPreview ? "Syncing..." : "Sync preview"}
                </Button>
                <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copyToken()}>
                  {copied ? "Copied" : "Copy token"}
                </Button>
                {previewUpdatedAt ? (
                  <Typography variant="body2" color="text.secondary">
                    Updated {previewUpdatedAt}
                  </Typography>
                ) : null}
              </Box>

              <ProgressBar value={progress} label={`${secondsLeft}s until the next automatic refresh`} color="#ff6b35" />

              {previewError ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {previewError}
                </Alert>
              ) : null}

              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" } }}>
                {previewWords.map((word) => (
                  <Box key={word}>
                    <Paper
                      sx={{
                        p: 2.5,
                        textAlign: "center",
                        border: "1px solid rgba(255,107,53,0.2)",
                        background: "linear-gradient(180deg, rgba(255,107,53,0.08), rgba(255,107,53,0.03))",
                      }}
                    >
                      <Typography sx={{ fontFamily: "monospace", letterSpacing: "0.14em", fontWeight: 800, color: "primary.light" }}>
                        {word}
                      </Typography>
                    </Paper>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "guide" ? (
          <Card>
            <CardContent sx={{ display: "grid", gap: 2.5 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  How to use Xenon Auth
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The flow below is the short operational checklist for shipping and testing.
                </Typography>
              </Box>

              <Box sx={{ display: "grid", gap: 1.5 }}>
                {[
                  {
                    title: "Start the backend",
                    desc: "Keep the API running and confirm /health responds from the selected URL.",
                  },
                  {
                    title: "Configure the secret",
                    desc: "Use the Testing tab to set a Base32 secret and verify the preview words.",
                  },
                  {
                    title: "Validate the rotation",
                    desc: "Watch the refresh bar to ensure the token window changes at the expected interval.",
                  },
                  {
                    title: "Ship with confidence",
                    desc: "Use auto preview during integration, then switch to manual sync for debugging.",
                  },
                ].map((step, index) => (
                  <Paper
                    key={step.title}
                    variant="outlined"
                    sx={{
                      p: 2,
                      display: "flex",
                      gap: 2,
                      alignItems: "flex-start",
                      background: "linear-gradient(180deg, rgba(255,107,53,0.06), rgba(255,107,53,0.02))",
                    }}
                  >
                    <Chip
                      label={String(index + 1).padStart(2, "0")}
                      sx={{
                        fontWeight: 800,
                        bgcolor: "primary.main",
                        color: "#0a0a0a",
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ display: "grid", gap: 0.5 }}>
                      <Typography sx={{ fontWeight: 700 }}>{step.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {step.desc}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        ) : null}
      </Container>
    </Box>
  );
}
