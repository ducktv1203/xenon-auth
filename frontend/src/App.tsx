import { useEffect, useMemo, useRef, useState } from "react";
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
import { QRCodeSVG } from "qrcode.react";
import { BrandLogo } from "./BrandLogo";

const DEFAULT_BACKEND_URL = "http://localhost:8000";
const DEFAULT_SECRET = "JBSWY3DPEHPK3PXP";

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

export default function App() {
  const [tab, setTab] = useState<PortalTab>("codes");
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");

  const [secretKey, setSecretKey] = useState(DEFAULT_SECRET);
  const [accountName, setAccountName] = useState("user@xenon");
  const [issuerName, setIssuerName] = useState("Xenon Auth");
  const [setupUri, setSetupUri] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);

  const [previewWords, setPreviewWords] = useState<string[]>(["----", "----", "----"]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [phonePhraseParts, setPhonePhraseParts] = useState<[string, string, string]>(["", "", ""]);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);
  const phraseFieldRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [newChallenge, setNewChallenge] = useState({
    user: "user@xenon",
    application: "Xenon Console",
    location: "New York, US",
    device_label: "Chrome on Windows",
    message: "Approve sign-in for Xenon Console",
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

  const refreshPreview = async () => {
    setPreviewLoading(true);
    try {
      setPreviewError(null);
      const response = await fetch(`${baseUrl}/preview/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret_key: secretKey }),
      });
      if (!response.ok) throw new Error(`Backend ${response.status}`);

      const payload = (await response.json()) as { words?: unknown };
      if (!Array.isArray(payload.words) || payload.words.length !== 3) {
        throw new Error("Invalid preview response");
      }
      setPreviewWords(payload.words.map((word) => String(word).toUpperCase()));
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Preview sync failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const normalizePhrase = (value: string) =>
    value
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean)
      .slice(0, 3);

  const sanitizeWord = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const setPhrasePart = (index: 0 | 1 | 2, value: string) => {
    const cleaned = sanitizeWord(value);
    setPhonePhraseParts((current) => {
      const next: [string, string, string] = [...current] as [string, string, string];
      next[index] = cleaned;
      return next;
    });
  };

  const onPhraseFieldKeyDown = async (
    event: React.KeyboardEvent<HTMLDivElement>,
    index: 0 | 1 | 2,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await verifyPhonePhrase();
      return;
    }

    if (event.key === "Backspace" && !phonePhraseParts[index] && index > 0) {
      phraseFieldRefs.current[index - 1]?.focus();
    }
  };

  const onPhrasePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData("text");
    const tokens = normalizePhrase(pasted);
    if (tokens.length === 0) return;

    event.preventDefault();
    setPhonePhraseParts([tokens[0] || "", tokens[1] || "", tokens[2] || ""]);
    const focusIndex = Math.min(2, Math.max(0, tokens.length - 1));
    phraseFieldRefs.current[focusIndex]?.focus();
  };

  const verifyPhonePhrase = async () => {
    setPreviewLoading(true);
    try {
      setPreviewError(null);
      setVerifyResult(null);

      const response = await fetch(`${baseUrl}/preview/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret_key: secretKey }),
      });
      if (!response.ok) throw new Error(`Backend ${response.status}`);

      const payload = (await response.json()) as { words?: unknown };
      if (!Array.isArray(payload.words) || payload.words.length !== 3) {
        throw new Error("Invalid preview response");
      }

      const expected = payload.words.map((word) => String(word).toUpperCase());
      setPreviewWords(expected);

      const actual = phonePhraseParts.map((part) => sanitizeWord(part)).filter(Boolean);
      if (actual.length !== 3) {
        setVerifyResult({ ok: false, message: "Enter exactly 3 words from your phone." });
        return;
      }

      const matched = actual.every((word, index) => word === expected[index]);
      setVerifyResult({
        ok: matched,
        message: matched
          ? "Phrase is valid for the current window."
          : "Phrase does not match the current window. Refresh code on phone and try again.",
      });
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Phrase verification failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const generateSetupUri = async () => {
    try {
      setSetupError(null);
      const response = await fetch(`${baseUrl}/enrollment/setup-uri`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret_key: secretKey,
          account_name: accountName,
          issuer: issuerName,
        }),
      });
      if (!response.ok) throw new Error(`Backend ${response.status}`);

      const payload = (await response.json()) as { otpauth_uri?: unknown };
      if (typeof payload.otpauth_uri !== "string") {
        throw new Error("Invalid enrollment response");
      }
      setSetupUri(payload.otpauth_uri);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Could not generate setup URI");
    }
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
        body: JSON.stringify(newChallenge),
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
    void refreshPreview();
    void refreshChallenges();
    const timer = window.setInterval(() => {
      void refreshChallenges();
    }, 3000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

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
              void refreshPreview();
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
          <Card sx={{ border: "1px solid #242424", bgcolor: "#111" }}>
            <CardContent sx={{ display: "grid", gap: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Setup URI and phone phrase verifier
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Base32 secret"
                  value={secretKey}
                  onChange={(event) => setSecretKey(event.target.value.toUpperCase())}
                  fullWidth
                />
                <TextField
                  label="Account"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Issuer"
                  value={issuerName}
                  onChange={(event) => setIssuerName(event.target.value)}
                  fullWidth
                />
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained"
                  startIcon={<QrCodeRoundedIcon />}
                  onClick={() => void generateSetupUri()}
                >
                  Generate Setup QR
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshRoundedIcon />}
                  disabled={previewLoading}
                  onClick={() => void verifyPhonePhrase()}
                >
                  {previewLoading ? "Checking" : "Check phrase from phone"}
                </Button>
              </Stack>

              {setupError ? <Alert severity="error">{setupError}</Alert> : null}
              {previewError ? <Alert severity="error">{previewError}</Alert> : null}

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Paper sx={{ p: 2, flex: 1, border: "1px solid #242424", bgcolor: "#0E0E0E" }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Phrase entered from phone
                  </Typography>
                  <Box sx={{ display: "grid", gap: 1.2, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                    {([0, 1, 2] as const).map((index) => (
                      <TextField
                        key={`phrase-field-${index}`}
                        label={`Word ${index + 1}`}
                        placeholder="WORD"
                        value={phonePhraseParts[index]}
                        onChange={(event) => setPhrasePart(index, event.target.value)}
                        onKeyDown={(event) => void onPhraseFieldKeyDown(event, index)}
                        onPaste={onPhrasePaste}
                        inputRef={(node) => {
                          phraseFieldRefs.current[index] = node;
                        }}
                        fullWidth
                      />
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    Use Tab to move between fields. Press Enter to check phrase.
                  </Typography>
                  {verifyResult ? (
                    <Alert severity={verifyResult.ok ? "success" : "warning"} sx={{ mt: 1.5 }}>
                      {verifyResult.message}
                    </Alert>
                  ) : null}
                </Paper>

                <Paper sx={{ p: 2, flex: 1, border: "1px solid #242424", bgcolor: "#0E0E0E" }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Setup URI QR
                  </Typography>
                  {setupUri ? (
                    <Box sx={{ display: "grid", gap: 1.5, justifyItems: "center" }}>
                      <Box sx={{ backgroundColor: "#fff", p: 1, borderRadius: 1 }}>
                        <QRCodeSVG value={setupUri} size={164} />
                      </Box>
                      <TextField value={setupUri} multiline minRows={2} fullWidth slotProps={{ input: { readOnly: true } }} />
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Generate setup URI to render QR.
                    </Typography>
                  )}
                </Paper>
              </Stack>
            </CardContent>
          </Card>
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