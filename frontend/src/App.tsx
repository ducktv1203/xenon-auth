import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import QrCodeRoundedIcon from "@mui/icons-material/QrCodeRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import { QRCodeSVG } from "qrcode.react";
import { BrandLogo } from "./BrandLogo";

const DEFAULT_BACKEND_URL = "http://localhost:8000";
type PortalTab = "codes" | "requests";
type ChallengeStatus = "pending" | "approved" | "denied" | "expired";

type ActiveChallenge = {
  id: string;
  user: string;
  application: string;
  location: string;
  device_label: string;
  message: string;
  verification_code: string;
  status: ChallengeStatus;
  created_at: number;
  expires_at: number;
};

type DemoPortal = {
  id: string;
  issuer: string;
  account: string;
  secret: string;
  setupUri: string;
  createdAt: string;
  connected: boolean;
};

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ENGLISH_ADJECTIVES = [
  "bright",
  "swift",
  "noble",
  "solid",
  "crystal",
  "bold",
  "prime",
  "lucky",
  "secure",
  "vivid",
];
const ENGLISH_NOUNS = [
  "falcon",
  "river",
  "forest",
  "bridge",
  "harbor",
  "lighthouse",
  "summit",
  "station",
  "circle",
  "signal",
];
const ENGLISH_TEAMS = [
  "Northstar",
  "Blue Harbor",
  "Summit Gate",
  "Riverfield",
  "Silver Grove",
  "Atlas Point",
  "Beacon Works",
  "Clearpath",
  "Oakline",
  "Stonebridge",
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function generateBase32Secret(length = 16) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += BASE32_ALPHABET[Math.floor(Math.random() * BASE32_ALPHABET.length)];
  }
  return out;
}

function generateRandomPortalDraft() {
  const adjective = pickRandom(ENGLISH_ADJECTIVES);
  const noun = pickRandom(ENGLISH_NOUNS);
  const suffix = Math.floor(Math.random() * 900 + 100);
  const team = pickRandom(ENGLISH_TEAMS);

  return {
    accountName: `${adjective}.${noun}${suffix}@demo.auth`,
    issuerName: `${team} Access`,
    secretKey: generateBase32Secret(),
  };
}

export default function App() {
  const [tab, setTab] = useState<PortalTab>("codes");
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");

  const [portalDraft, setPortalDraft] = useState(() => generateRandomPortalDraft());
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [demoPortals, setDemoPortals] = useState<DemoPortal[]>([]);
  const [expandedPortalIds, setExpandedPortalIds] = useState<string[]>([]);
  const [portalCodeParts, setPortalCodeParts] = useState<Record<string, [string, string, string]>>({});
  const [portalVerifyResults, setPortalVerifyResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [verifyingPortalId, setVerifyingPortalId] = useState<string | null>(null);

  const [newChallenge, setNewChallenge] = useState({
    user: "user@xenon",
    application: "Xenon Console",
    location: "New York, US",
    device_label: "Chrome on Windows",
    message: "Approve sign-in for Xenon Console",
    ttl_seconds: 120,
  });
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [cancelingChallengeId, setCancelingChallengeId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);

  const baseUrl = useMemo(() => backendUrl.replace(/\/$/, ""), [backendUrl]);

  const refreshHealth = async () => {
    try {
      const response = await fetch(`${baseUrl}/health`);
      setHealth(response.ok ? "online" : "offline");
    } catch {
      setHealth("offline");
    }
  };

  const sanitizeWord = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const setPortalCodePart = (portalId: string, index: 0 | 1 | 2, value: string) => {
    const cleaned = sanitizeWord(value);
    setPortalCodeParts((current) => {
      const existing = current[portalId] || ["", "", ""];
      const next: [string, string, string] = [...existing] as [string, string, string];
      next[index] = cleaned;
      return { ...current, [portalId]: next };
    });
  };

  const verifyPortalCode = async (portal: DemoPortal) => {
    setVerifyingPortalId(portal.id);
    try {
      const response = await fetch(`${baseUrl}/preview/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret_key: portal.secret }),
      });
      if (!response.ok) throw new Error(`Backend ${response.status}`);

      const payload = (await response.json()) as { words?: unknown };
      if (!Array.isArray(payload.words) || payload.words.length !== 3) {
        throw new Error("Invalid preview response");
      }

      const expected = payload.words.map((word) => String(word).toUpperCase());
      const actual = (portalCodeParts[portal.id] || ["", "", ""])
        .map((part) => sanitizeWord(part))
        .filter(Boolean);

      if (actual.length !== 3) {
        setPortalVerifyResults((current) => ({
          ...current,
          [portal.id]: { ok: false, message: "Enter exactly 3 code words." },
        }));
        return;
      }

      const matched = actual.every((word, index) => word === expected[index]);
      setPortalVerifyResults((current) => ({
        ...current,
        [portal.id]: {
          ok: matched,
          message: matched ? "Code is valid for this portal." : "Code does not match this portal.",
        },
      }));
    } catch (error) {
      setPortalVerifyResults((current) => ({
        ...current,
        [portal.id]: {
          ok: false,
          message: error instanceof Error ? error.message : "Code verification failed",
        },
      }));
    } finally {
      setVerifyingPortalId((current) => (current === portal.id ? null : current));
    }
  };

  const createDemoPortal = async () => {
    setPortalLoading(true);
    try {
      setPortalError(null);
      const normalizedSecret = (portalDraft.secretKey || "").trim().toUpperCase() || generateBase32Secret();

      const response = await fetch(`${baseUrl}/enrollment/setup-uri`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret_key: normalizedSecret,
          account_name: portalDraft.accountName,
          issuer: portalDraft.issuerName,
        }),
      });
      if (!response.ok) throw new Error(`Backend ${response.status}`);

      const payload = (await response.json()) as { otpauth_uri?: unknown };
      if (typeof payload.otpauth_uri !== "string") {
        throw new Error("Invalid enrollment response");
      }
      const setupUri = payload.otpauth_uri;
      const portalId = `${portalDraft.issuerName}:${portalDraft.accountName}:${Date.now()}`;

      setDemoPortals((current) => [
        {
          id: portalId,
          issuer: portalDraft.issuerName,
          account: portalDraft.accountName,
          secret: normalizedSecret,
          setupUri,
          createdAt: new Date().toLocaleTimeString(),
          connected: false,
        },
        ...current,
      ]);

      // New portals start as not connected, so keep QR/details expanded for quick mobile import.
      setExpandedPortalIds((current) => (current.includes(portalId) ? current : [portalId, ...current]));

      setPortalDraft(generateRandomPortalDraft());
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Could not create demo portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const deleteDemoPortal = (portalId: string) => {
    setDemoPortals((current) => current.filter((portal) => portal.id !== portalId));
    setExpandedPortalIds((current) => current.filter((id) => id !== portalId));
    setPortalCodeParts((current) => {
      const next = { ...current };
      delete next[portalId];
      return next;
    });
    setPortalVerifyResults((current) => {
      const next = { ...current };
      delete next[portalId];
      return next;
    });
  };

  const togglePortalExpanded = (portalId: string) => {
    setExpandedPortalIds((current) =>
      current.includes(portalId) ? current.filter((id) => id !== portalId) : [...current, portalId],
    );
  };

  const refreshPortalConnections = async () => {
    if (demoPortals.length === 0) return;

    const statuses = await Promise.all(
      demoPortals.map(async (portal) => {
        try {
          const params = new URLSearchParams({
            secret_key: portal.secret,
            account_name: portal.account,
            issuer: portal.issuer,
          });
          const response = await fetch(`${baseUrl}/enrollment/connection-status?${params.toString()}`);
          if (!response.ok) return { id: portal.id, connected: false };
          const payload = (await response.json()) as { connected?: unknown };
          return { id: portal.id, connected: payload.connected === true };
        } catch {
          return { id: portal.id, connected: false };
        }
      }),
    );

    const map = new Map(statuses.map((status) => [status.id, status.connected]));
    const disconnectedPortalIds = statuses
      .filter((status) => !status.connected)
      .map((status) => status.id);
    setExpandedPortalIds((current) => Array.from(new Set([...current, ...disconnectedPortalIds])));

    setDemoPortals((current) => {
      let changed = false;
      const next = current.map((portal) => {
        const connected = map.get(portal.id) ?? false;
        if (portal.connected !== connected) {
          changed = true;
          return { ...portal, connected };
        }
        return portal;
      });
      return changed ? next : current;
    });
  };

  const refreshChallenges = async () => {
    setChallengeLoading(true);
    try {
      setChallengeError(null);
      const response = await fetch(`${baseUrl}/active/challenges?state=all`);
      if (!response.ok) throw new Error(`Backend ${response.status}`);

      const payload = (await response.json()) as { challenges?: unknown };
      if (!Array.isArray(payload.challenges)) {
        throw new Error("Invalid challenge response");
      }
      setChallenges(payload.challenges as ActiveChallenge[]);
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : "Could not load requests");
    } finally {
      setChallengeLoading(false);
    }
  };

  const createChallenge = async () => {
    setChallengeLoading(true);
    try {
      setChallengeError(null);
      const response = await fetch(`${baseUrl}/active/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newChallenge,
          ttl_seconds: Math.max(15, Math.min(900, Number(newChallenge.ttl_seconds) || 120)),
        }),
      });
      if (!response.ok) throw new Error(`Backend ${response.status}`);

      await refreshChallenges();
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : "Could not create request");
      setChallengeLoading(false);
    }
  };

  const cancelChallenge = async (challengeId: string) => {
    setCancelingChallengeId(challengeId);
    try {
      setChallengeError(null);
      const response = await fetch(`${baseUrl}/active/challenges/${challengeId}/deny`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`Backend ${response.status}`);
      await refreshChallenges();
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : "Could not cancel request");
    } finally {
      setCancelingChallengeId(null);
    }
  };

  useEffect(() => {
    setHealth("checking");
    void refreshHealth();
    void refreshChallenges();
    const timer = window.setInterval(() => {
      void refreshChallenges();
    }, 3000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  useEffect(() => {
    if (demoPortals.length === 0) return;
    void refreshPortalConnections();
    const id = window.setInterval(() => {
      void refreshPortalConnections();
    }, 5000);
    return () => window.clearInterval(id);
  }, [baseUrl, demoPortals.length]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0B0B0B" }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "#111", borderBottom: "1px solid #222" }}>
        <Toolbar sx={{ gap: 2 }}>
          <BrandLogo compact />
          <Box sx={{ flex: 1 }} />
          <Chip
            label={health === "online" ? "Backend Online" : health === "checking" ? "Checking" : "Backend Offline"}
            color={health === "online" ? "success" : health === "checking" ? "default" : "error"}
            variant="outlined"
          />
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => {
              void refreshHealth();
              void refreshChallenges();
            }}
          >
            Refresh
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3, display: "grid", gap: 2.5 }}>
        <Paper sx={{ p: 2, border: "1px solid #242424", bgcolor: "#111" }}>
          <Stack spacing={2}>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Xenon Auth Testing Portal
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Purpose-built test console for enrollment, token preview, and active sign-in request flows.
            </Typography>
            <TextField
              label="Backend URL"
              value={backendUrl}
              onChange={(event) => setBackendUrl(event.target.value)}
              fullWidth
            />
          </Stack>
        </Paper>

        <Paper sx={{ p: 1, border: "1px solid #242424", bgcolor: "#111" }}>
          <Tabs value={tab} onChange={(_, next) => setTab(next)} variant="fullWidth">
            <Tab value="codes" label="Code and Enrollment Lab" />
            <Tab value="requests" label="Active Request Lab" />
          </Tabs>
        </Paper>

        {tab === "codes" ? (
          <>
            <Card sx={{ border: "1px solid #242424", bgcolor: "#111" }}>
              <CardContent sx={{ display: "grid", gap: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Multi portal enrollment and code verifier
                </Typography>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Portal account"
                    value={portalDraft.accountName}
                    onChange={(event) =>
                      setPortalDraft((current) => ({
                        ...current,
                        accountName: event.target.value,
                      }))
                    }
                    fullWidth
                  />
                  <TextField
                    label="Portal issuer"
                    value={portalDraft.issuerName}
                    onChange={(event) =>
                      setPortalDraft((current) => ({
                        ...current,
                        issuerName: event.target.value,
                      }))
                    }
                    fullWidth
                  />
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Portal secret"
                    value={portalDraft.secretKey}
                    onChange={(event) =>
                      setPortalDraft((current) => ({
                        ...current,
                        secretKey: event.target.value.toUpperCase(),
                      }))
                    }
                    helperText="Each portal can use a different secret for separate mobile accounts."
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    sx={{
                      alignSelf: { xs: "stretch", md: "flex-start" },
                      minWidth: { md: 210 },
                      height: 56,
                      whiteSpace: "nowrap",
                      px: 1.5,
                    }}
                    onClick={() => setPortalDraft(generateRandomPortalDraft())}
                  >
                    Randomize demo fields
                  </Button>
                </Stack>

                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="contained"
                    startIcon={<QrCodeRoundedIcon />}
                    disabled={portalLoading}
                    onClick={() => void createDemoPortal()}
                  >
                    {portalLoading ? "Creating..." : "Create demo portal"}
                  </Button>
                </Stack>

                {portalError ? <Alert severity="error">{portalError}</Alert> : null}
              </CardContent>
            </Card>

            <Card sx={{ border: "1px solid #242424", bgcolor: "#111" }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Demo portal list
                </Typography>
                {demoPortals.length > 0 ? (
                  <Stack spacing={1.5}>
                    {demoPortals.map((portal) => {
                      const parts = portalCodeParts[portal.id] || ["", "", ""];
                      const verifyResult = portalVerifyResults[portal.id];
                      return (
                        <Paper key={portal.id} sx={{ p: 1.5, border: "1px solid #2C2C2C", bgcolor: "#111" }}>
                          <Box sx={{ display: "grid", gap: 1.2 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {portal.issuer}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {portal.account} · Created {portal.createdAt}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={0.8}>
                                <Chip
                                  size="small"
                                  icon={portal.connected ? <CheckCircleOutlineRoundedIcon /> : <LinkOffRoundedIcon />}
                                  label={portal.connected ? "Connected" : "Not connected"}
                                  variant="outlined"
                                  color={portal.connected ? "success" : "default"}
                                />
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  startIcon={<DeleteOutlineRoundedIcon />}
                                  onClick={() => deleteDemoPortal(portal.id)}
                                >
                                  Delete
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => togglePortalExpanded(portal.id)}
                                  endIcon={
                                    expandedPortalIds.includes(portal.id) ? (
                                      <ExpandLessRoundedIcon />
                                    ) : (
                                      <ExpandMoreRoundedIcon />
                                    )
                                  }
                                >
                                  Details
                                </Button>
                              </Stack>
                            </Box>

                            {expandedPortalIds.includes(portal.id) ? (
                              <>
                                <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
                                  <Box sx={{ backgroundColor: "#fff", p: 0.8, borderRadius: 1 }}>
                                    <QRCodeSVG value={portal.setupUri} size={240} />
                                  </Box>
                                </Box>
                                <TextField
                                  label="Setup URI"
                                  value={portal.setupUri}
                                  multiline
                                  minRows={2}
                                  fullWidth
                                  slotProps={{ input: { readOnly: true } }}
                                />
                                <TextField
                                  label="Secret"
                                  value={portal.secret}
                                  fullWidth
                                  slotProps={{ input: { readOnly: true } }}
                                />
                              </>
                            ) : null}

                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                opacity: 0.85,
                                display: "block",
                              }}
                            >
                              Enter the 3 code words from this portal in mobile. Press Enter in any box to verify.
                            </Typography>
                            <Box sx={{ display: "grid", gap: 1.2, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                              {([0, 1, 2] as const).map((index) => (
                                <TextField
                                  key={`${portal.id}-code-${index}`}
                                  label={`Code word ${index + 1}`}
                                  placeholder="WORD"
                                  value={parts[index]}
                                  disabled={!portal.connected}
                                  onChange={(event) => setPortalCodePart(portal.id, index, event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" && portal.connected) {
                                      event.preventDefault();
                                      void verifyPortalCode(portal);
                                    }
                                  }}
                                  fullWidth
                                />
                              ))}
                            </Box>
                            {verifyResult ? (
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.7,
                                  color: verifyResult.ok ? "success.main" : "warning.main",
                                }}
                              >
                                {verifyResult.ok ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: 14 }} /> : null}
                                <Typography variant="caption" sx={{ color: "inherit", fontWeight: 700 }}>
                                  {verifyResult.message}
                                </Typography>
                              </Box>
                            ) : null}
                            {verifyingPortalId === portal.id ? (
                              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                <CircularProgress size={14} />
                                <Typography variant="caption" color="text.secondary">
                                  Verifying code...
                                </Typography>
                              </Box>
                            ) : null}
                            {!portal.connected ? (
                              <Typography variant="caption" color="warning.main">
                                Not connected portal. Code verification is disabled.
                              </Typography>
                            ) : null}
                          </Box>
                        </Paper>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Create demo portals to generate multiple QR/URI entries for mobile import.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}

        {tab === "requests" ? (
          <Card sx={{ border: "1px solid #242424", bgcolor: "#111" }}>
            <CardContent sx={{ display: "grid", gap: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Active sign-in request simulator
              </Typography>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="User"
                  value={newChallenge.user}
                  onChange={(event) => setNewChallenge((current) => ({ ...current, user: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Application"
                  value={newChallenge.application}
                  onChange={(event) => setNewChallenge((current) => ({ ...current, application: event.target.value }))}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Location"
                  value={newChallenge.location}
                  onChange={(event) => setNewChallenge((current) => ({ ...current, location: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Device"
                  value={newChallenge.device_label}
                  onChange={(event) => setNewChallenge((current) => ({ ...current, device_label: event.target.value }))}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Message"
                  value={newChallenge.message}
                  onChange={(event) => setNewChallenge((current) => ({ ...current, message: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Request timeout (seconds)"
                  type="number"
                  value={newChallenge.ttl_seconds}
                  onChange={(event) =>
                    setNewChallenge((current) => ({
                      ...current,
                      ttl_seconds: Number(event.target.value || 120),
                    }))
                  }
                  slotProps={{ htmlInput: { min: 15, max: 900, step: 5 } }}
                  helperText="Allowed range: 15 to 900 seconds."
                  sx={{ minWidth: { md: 240 } }}
                />
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  disabled={challengeLoading}
                  onClick={() => void createChallenge()}
                >
                  Create request
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshRoundedIcon />}
                  disabled={challengeLoading}
                  onClick={() => void refreshChallenges()}
                >
                  Refresh list
                </Button>
              </Stack>

              {challengeError ? <Alert severity="error">{challengeError}</Alert> : null}

              <Divider />

              <Stack spacing={1.5}>
                {challenges.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    No requests yet.
                  </Typography>
                ) : (
                  challenges.map((challenge) => (
                    <Paper key={challenge.id} sx={{ p: 2, border: "1px solid #242424", bgcolor: "#0E0E0E" }}>
                      <Stack spacing={1.2}>
                        <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "space-between" }}>
                          <Typography sx={{ fontWeight: 700 }}>{challenge.application}</Typography>
                          <Chip
                            size="small"
                            label={challenge.status.toUpperCase()}
                            color={
                              challenge.status === "approved"
                                ? "success"
                                : challenge.status === "denied"
                                  ? "error"
                                  : challenge.status === "expired"
                                    ? "default"
                                    : "warning"
                            }
                            variant="outlined"
                          />
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                          {challenge.user} · {challenge.location} · {challenge.device_label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Sign-in displayed code: <strong>{challenge.verification_code}</strong>
                        </Typography>

                        {challenge.status === "pending" ? (
                          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                            <Box sx={{ display: "flex", gap: 1, alignItems: "center", px: 0.5 }}>
                              <CircularProgress size={16} />
                              <Typography variant="body2" color="text.secondary">
                                Pending...
                              </Typography>
                            </Box>
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<BlockRoundedIcon />}
                              disabled={cancelingChallengeId === challenge.id}
                              onClick={() => void cancelChallenge(challenge.id)}
                            >
                              {cancelingChallengeId === challenge.id ? "Canceling..." : "Cancel"}
                            </Button>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Request closed.
                          </Typography>
                        )}
                      </Stack>
                    </Paper>
                  ))
                )}
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Container>
    </Box>
  );
}