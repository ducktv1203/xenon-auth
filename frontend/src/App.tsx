import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Paper,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import SettingsSuggestRoundedIcon from "@mui/icons-material/SettingsSuggestRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { BrandLogo } from "./BrandLogo";

const STEP_SECONDS = 60;
const DEFAULT_BACKEND_URL = "http://localhost:8000";
const DEFAULT_SECRET = "JBSWY3DPEHPK3PXP";

type PageTab = "status" | "testing" | "guide";

function SegmentedProgress({ value, color = "#FF5F1F", label }: { value: number; color?: string; label: string }) {
  const bounded = Math.max(0, Math.min(1, value));
  const left = `${bounded * 100}%`;

  return (
    <Box sx={{ display: "grid", gap: 0.8 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box
        sx={{
          position: "relative",
          height: 14,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${Math.max(8, bounded * 100)}%`,
            background: `linear-gradient(90deg, ${color}, #ff8a4f 52%, #ffb089)` ,
            borderRadius: 999,
            transition: "width 340ms ease",
            boxShadow: "0 0 18px rgba(255,95,31,0.5)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left,
            top: "50%",
            width: 16,
            height: 16,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            border: "2px solid #141414",
            backgroundColor: color,
            boxShadow: "0 0 0 3px rgba(255, 95, 31, 0.25)",
            transition: "left 400ms ease",
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
  const [lastChecked, setLastChecked] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    let id: number | undefined;

    const run = async () => {
      try {
        const res = await fetch(`${url.replace(/\/$/, "")}/health`);
        if (!res.ok) throw new Error();
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
      id = window.setInterval(run, STEP_SECONDS * 1000);
    }

    return () => {
      mounted = false;
      if (id) window.clearInterval(id);
    };
  }, [url, enabled]);

  return { status, lastChecked };
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
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const { status, lastChecked } = useBackendHealth(backendUrl, autoHealth);

  const backendScore = status === "online" ? 1 : status === "checking" ? 0.5 : 0.12;

  const quickSecrets = useMemo(
    () => [
      { label: "Demo", value: DEFAULT_SECRET },
      { label: "Alt A", value: "KRUGS4ZANFZSAYJA" },
      { label: "Alt B", value: "MZXW6YTBOI======" },
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
      if (!Array.isArray(payload.words) || payload.words.length !== 3) throw new Error("Invalid preview payload");

      setPreviewWords(payload.words.map((w) => String(w).toUpperCase()));
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

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage:
          "radial-gradient(circle at 12% -10%, rgba(255,95,31,0.24), transparent 38%), radial-gradient(circle at 88% 18%, rgba(255,95,31,0.14), transparent 34%)",
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, display: "grid", gap: 3 }}>
        <Paper
          sx={{
            p: { xs: 2.4, md: 3.5 },
            background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(8px)",
          }}
        >
          <Box sx={{ display: "grid", gap: 2.5 }}>
            <BrandLogo />
            <Typography variant="h1" sx={{ fontSize: { xs: 34, md: 52 }, lineHeight: 0.98, maxWidth: 12 }}>
              Product-ready 2FA with three-word tokens.
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 760, lineHeight: 1.8 }}>
              Xenon Auth provides deployment guidance, live backend status, and real token testing in one
              practical product page. No showcase fluff, just the page your team can actually use.
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Chip color="primary" label="Status" />
              <Chip color="primary" variant="outlined" label="Testing" />
              <Chip color="primary" variant="outlined" label="How to use" />
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ p: 2, border: "1px solid rgba(255,255,255,0.1)" }}>
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
            <ToggleButtonGroup
              value={activeTab}
              exclusive
              onChange={(_, value) => {
                if (value) setActiveTab(value);
              }}
              color="primary"
              size="small"
            >
              <ToggleButton value="status">
                <SettingsSuggestRoundedIcon fontSize="small" sx={{ mr: 0.8 }} /> Status
              </ToggleButton>
              <ToggleButton value="testing">
                <PlayArrowRoundedIcon fontSize="small" sx={{ mr: 0.8 }} /> Testing
              </ToggleButton>
              <ToggleButton value="guide">
                <ChecklistRoundedIcon fontSize="small" sx={{ mr: 0.8 }} /> Guide
              </ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ display: "flex", gap: 2.2, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Switch checked={autoHealth} onChange={(e) => setAutoHealth(e.target.checked)} />
                <Typography variant="body2" color="text.secondary">
                  Auto status
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Switch checked={autoPreview} onChange={(e) => setAutoPreview(e.target.checked)} />
                <Typography variant="body2" color="text.secondary">
                  Auto preview
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>

        {activeTab === "status" ? (
          <Card>
            <CardContent sx={{ display: "grid", gap: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Backend status overview
                </Typography>
                <Chip
                  label={status === "online" ? "Connected" : status === "checking" ? "Checking" : "Offline"}
                  color={status === "offline" ? "error" : "primary"}
                  variant={status === "checking" ? "outlined" : "filled"}
                />
              </Box>
              <SegmentedProgress
                value={backendScore}
                color={status === "online" ? "#16A34A" : status === "offline" ? "#DC2626" : "#64748B"}
                label={`${Math.round(backendScore * 100)}% health confidence`}
              />
              <Box sx={{ display: "grid", gap: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Endpoint
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{backendUrl}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Last checked: {lastChecked || "pending"}
                </Typography>
              </Box>
              <Alert severity={status === "offline" ? "warning" : "success"}>
                Use this panel to confirm backend connectivity before onboarding or testing.
              </Alert>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "testing" ? (
          <Card>
            <CardContent sx={{ display: "grid", gap: 2.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Interactive testing console
              </Typography>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
                <TextField
                  label="Backend URL"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  helperText="Used for /health and /preview/words"
                  fullWidth
                />
                <TextField
                  label="Base32 Secret"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value.toUpperCase())}
                  helperText="Change this to test other token streams"
                  fullWidth
                />
              </Box>

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {quickSecrets.map((entry) => (
                  <Button key={entry.label} size="small" variant="outlined" onClick={() => setSecretKey(entry.value)}>
                    {entry.label}
                  </Button>
                ))}
              </Box>

              <Box sx={{ display: "flex", gap: 1.2, flexWrap: "wrap", alignItems: "center" }}>
                <Button variant="contained" startIcon={<SyncRoundedIcon />} onClick={() => void syncPreview()}>
                  {loadingPreview ? "Syncing..." : "Sync now"}
                </Button>
                <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copyToken()}>
                  {copied ? "Copied" : "Copy token"}
                </Button>
                <Typography variant="body2" color="text.secondary">
                  Updated {previewUpdatedAt || "not yet"}
                </Typography>
              </Box>

              <SegmentedProgress value={progress} label={`${secondsLeft}s until next automatic refresh window`} />

              {previewError ? <Alert severity="error">{previewError}</Alert> : null}

              <Box sx={{ display: "grid", gap: 1.2, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0,1fr))" } }}>
                {previewWords.map((word) => (
                  <Paper
                    key={word}
                    variant="outlined"
                    sx={{ py: 2.2, textAlign: "center", letterSpacing: "0.16em", fontWeight: 800, fontSize: 19, bgcolor: "#1b1b1b" }}
                  >
                    {word}
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "guide" ? (
          <Card>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                How to use Xenon Auth
              </Typography>
              {[
                "Start backend API and keep /health reachable.",
                "Use the Testing tab to set backend URL and a base32 secret.",
                "Validate token rotations and ensure mobile displays the same words each interval.",
                "Enable auto preview for continuous testing or run manual sync for debugging.",
              ].map((step, i) => (
                <Paper key={step} variant="outlined" sx={{ p: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <Chip label={`0${i + 1}`} color="primary" sx={{ fontWeight: 700 }} />
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {step}
                  </Typography>
                </Paper>
              ))}
              <Divider />
              <Typography variant="body2" color="text.secondary">
                This page is intentionally operational: status checks, token testing, and rollout notes in one place.
              </Typography>
            </CardContent>
          </Card>
        ) : null}
      </Container>
    </Box>
  );
}
