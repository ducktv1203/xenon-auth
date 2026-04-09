import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { setStringAsync } from "expo-clipboard";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const STEP_SECONDS = 60;
const DEFAULT_SECRET = "JBSWY3DPEHPK3PXP";
const DEFAULT_BACKEND_URL = "http://localhost:8000";

type MobileTab = "home" | "requests" | "settings";
type ChallengeStatus = "pending" | "approved" | "denied" | "expired";

type ActiveChallenge = {
  id: string;
  user: string;
  application: string;
  location: string;
  device_label: string;
  message: string;
  status: ChallengeStatus;
  created_at: number;
  expires_at: number;
  responded_at?: number | null;
};

const COLORS = {
  bg: "#0D0D0D",
  card: "#161616",
  cardSoft: "#1D1D1D",
  border: "#2F2F2F",
  text: "#F8FAFC",
  muted: "#A1A1AA",
  primary: "#FF5F1F",
  primarySoft: "rgba(255,95,31,0.12)",
  success: "#16A34A",
  error: "#DC2626",
};

function useRefreshWindow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
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
    const id = enabled ? setInterval(run, STEP_SECONDS * 1000) : undefined;

    return () => {
      mounted = false;
      if (id) clearInterval(id);
    };
  }, [url, enabled]);

  return { status, lastChecked };
}

function useActiveChallenges(url: string, enabled: boolean) {
  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState("");
  const [error, setError] = useState<string | null>(null);

  const syncChallenges = async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await fetch(`${url.replace(/\/$/, "")}/active/challenges?state=all`);
      if (!response.ok) throw new Error(`Backend responded ${response.status}`);

      const payload = (await response.json()) as { challenges?: unknown };
      if (!Array.isArray(payload.challenges)) throw new Error("Invalid challenge payload");

      const normalized = payload.challenges.map((entry) => ({
        ...entry,
        created_at: Number((entry as { created_at?: number }).created_at ?? 0),
        expires_at: Number((entry as { expires_at?: number }).expires_at ?? 0),
      })) as ActiveChallenge[];

      setChallenges(normalized);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Active request sync failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void syncChallenges();
    if (!enabled) {
      return undefined;
    }

    const id = setInterval(() => {
      void syncChallenges();
    }, 15_000);

    return () => clearInterval(id);
  }, [url, enabled]);

  return {
    challenges,
    loading,
    error,
    lastChecked,
    syncChallenges,
    setChallenges,
    setError,
  };
}

function SegmentedProgress({
  label,
  caption,
  value,
  tone = "primary",
}: {
  label: string;
  caption: string;
  value: number;
  tone?: "primary" | "success" | "error" | "muted";
}) {
  const bounded = Math.max(0, Math.min(1, value));
  const toneColor =
    tone === "success" ? COLORS.success : tone === "error" ? COLORS.error : tone === "muted" ? COLORS.muted : COLORS.primary;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{caption}</Text>
      </View>

      <View
        style={{
          position: "relative",
          height: 14,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: "#1b1b1b",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${bounded * 100}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: toneColor,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: `${bounded * 100}%`,
            top: "50%",
            marginLeft: -8,
            marginTop: -8,
            width: 16,
            height: 16,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: "#0D0D0D",
            backgroundColor: toneColor,
          }}
        />
      </View>
    </View>
  );
}

function formatSecondsRemaining(expiresAt: number) {
  const remaining = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  if (remaining === 0) return "Expired";
  if (remaining < 60) return `${remaining}s left`;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s left`;
}

function challengeStatusTone(status: ChallengeStatus) {
  if (status === "approved") return COLORS.success;
  if (status === "denied") return COLORS.error;
  if (status === "expired") return COLORS.muted;
  return COLORS.primary;
}

function parseSetupUri(uri: string): { secret: string; account: string; issuer: string } {
  const trimmed = uri.trim();
  if (!trimmed.toLowerCase().startsWith("otpauth://totp/")) {
    throw new Error("Not a valid TOTP setup URI");
  }

  const withoutScheme = trimmed.replace(/^otpauth:\/\/totp\//i, "");
  const qIndex = withoutScheme.indexOf("?");
  const encodedLabel = qIndex >= 0 ? withoutScheme.slice(0, qIndex) : withoutScheme;
  const query = qIndex >= 0 ? withoutScheme.slice(qIndex + 1) : "";

  const params: Record<string, string> = {};
  for (const part of query.split("&")) {
    if (!part) continue;
    const [rawKey, rawValue = ""] = part.split("=");
    params[decodeURIComponent(rawKey).toLowerCase()] = decodeURIComponent(rawValue);
  }

  const secret = (params.secret || "").replace(/\s+/g, "").toUpperCase();
  if (!secret) {
    throw new Error("Setup URI does not include a secret");
  }

  const pathLabel = decodeURIComponent(encodedLabel.replace(/^\//, ""));
  const pathParts = pathLabel.split(":");
  const accountFromPath = pathParts.length > 1 ? pathParts.slice(1).join(":") : pathParts[0] || "user@xenon";
  const issuerFromPath = pathParts.length > 1 ? pathParts[0] : "";

  const issuer = (params.issuer || issuerFromPath || "Xenon Auth").trim();
  const account = accountFromPath.trim() || "user@xenon";

  return { secret, account, issuer };
}

function HeaderCard() {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 20,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: COLORS.primary,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 15, fontWeight: "800", letterSpacing: 1 }}>XA</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1.4 }}>XENON AUTH</Text>
          <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "800", lineHeight: 28 }}>
            Secure authenticator
          </Text>
        </View>
      </View>
      <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 22 }}>
        Verify sign-ins with rotating codes and real-time approval requests.
      </Text>
    </View>
  );
}

function ChallengeCard({
  challenge,
  onApprove,
  onDeny,
  busy,
}: {
  challenge: ActiveChallenge;
  onApprove: () => void;
  onDeny: () => void;
  busy: boolean;
}) {
  const tone = challengeStatusTone(challenge.status);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 16,
        backgroundColor: COLORS.cardSoft,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "800" }}>{challenge.application}</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12 }}>{challenge.user}</Text>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: `${tone}22`,
            borderWidth: 1,
            borderColor: `${tone}55`,
          }}
        >
          <Text style={{ color: tone, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>
            {challenge.status}
          </Text>
        </View>
      </View>

      <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>{challenge.message}</Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{challenge.location}</Text>
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{challenge.device_label}</Text>
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{formatSecondsRemaining(challenge.expires_at)}</Text>
      </View>

      {challenge.status === "pending" ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={onDeny}
            disabled={busy}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 999,
              alignItems: "center",
              borderWidth: 1,
              borderColor: COLORS.error,
              backgroundColor: "rgba(220,38,38,0.12)",
              opacity: busy ? 0.7 : 1,
            }}
          >
            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "800" }}>Deny</Text>
          </Pressable>
          <Pressable
            onPress={onApprove}
            disabled={busy}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 999,
              alignItems: "center",
              backgroundColor: COLORS.primary,
              opacity: busy ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "white", fontSize: 13, fontWeight: "800" }}>Approve</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function AppShell() {
  const { progress, secondsLeft, windowIndex } = useRefreshWindow();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<MobileTab>("home");
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [secretKey, setSecretKey] = useState(DEFAULT_SECRET);
  const [accountName, setAccountName] = useState("user@xenon");
  const [issuerName, setIssuerName] = useState("Xenon Auth");
  const [setupUriInput, setSetupUriInput] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [autoHealth, setAutoHealth] = useState(true);
  const [autoCodeSync, setAutoCodeSync] = useState(true);
  const [autoChallengeSync, setAutoChallengeSync] = useState(true);

  const [previewWords, setPreviewWords] = useState<string[]>(["PLUTO", "JAZZ", "ECHO"]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const { status, lastChecked } = useBackendHealth(backendUrl, autoHealth);
  const {
    challenges,
    loading: loadingChallenges,
    error: challengeError,
    lastChecked: challengeUpdatedAt,
    syncChallenges,
    setChallenges,
    setError: setChallengeError,
  } = useActiveChallenges(backendUrl, autoChallengeSync);

  const backendScore = status === "online" ? 1 : status === "checking" ? 0.5 : 0.12;

  const pendingChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.status === "pending"),
    [challenges],
  );

  const recentChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.status !== "pending").slice(0, 6),
    [challenges],
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
        throw new Error("Invalid passcode payload");
      }

      setPreviewWords(payload.words.map((word) => String(word).toUpperCase()));
      setPreviewUpdatedAt(new Date().toLocaleTimeString());
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Passcode sync failed");
    } finally {
      setLoadingPreview(false);
    }
  };

  const applySetupUri = (candidate: string) => {
    try {
      const parsed = parseSetupUri(candidate);
      setSecretKey(parsed.secret);
      setAccountName(parsed.account);
      setIssuerName(parsed.issuer);
      setSetupUriInput(candidate.trim());
      setSetupError(null);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Could not parse setup URI");
    }
  };

  const openScanner = async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) {
      setSetupError("Camera permission is required to scan QR setup codes.");
      return;
    }
    setSetupError(null);
    setScanLocked(false);
    setShowScanner(true);
  };

  const onQrScanned = ({ data }: { data: string }) => {
    if (scanLocked) return;
    setScanLocked(true);
    setShowScanner(false);
    applySetupUri(data);
  };

  const respondToChallenge = async (challengeId: string, action: "approve" | "deny") => {
    try {
      setChallengeError(null);
      const response = await fetch(`${backendUrl.replace(/\/$/, "")}/active/challenges/${challengeId}/${action}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`Backend responded ${response.status}`);

      setChallenges((current) =>
        current.map((challenge) =>
          challenge.id === challengeId
            ? {
                ...challenge,
                status: action === "approve" ? "approved" : "denied",
                responded_at: Math.floor(Date.now() / 1000),
              }
            : challenge,
        ),
      );

      await syncChallenges();
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : "Could not update request");
    }
  };

  useEffect(() => {
    if (autoCodeSync) {
      void syncPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl, secretKey, windowIndex, autoCodeSync]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={["top", "left", "right"]}>
      <StatusBar style="light" backgroundColor={COLORS.bg} translucent={false} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: Math.max(insets.top, 16) + 8,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          gap: 14,
        }}
      >
        <HeaderCard />

        <View
          style={{
            backgroundColor: COLORS.card,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 18,
            padding: 8,
            flexDirection: "row",
            gap: 8,
          }}
        >
          {([
            ["home", "Home"],
            ["requests", "Requests"],
            ["settings", "Settings"],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                alignItems: "center",
                backgroundColor: tab === value ? COLORS.primary : COLORS.cardSoft,
                borderWidth: 1,
                borderColor: tab === value ? COLORS.primary : COLORS.border,
              }}
            >
              <Text style={{ color: tab === value ? "#FFFFFF" : COLORS.text, fontSize: 13, fontWeight: "700" }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "home" ? (
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>Authenticator code</Text>
              <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>
                Use this rotating three-word code for sign-ins that require a one-time passcode.
              </Text>

              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {previewWords.map((word) => (
                  <View
                    key={word}
                    style={{
                      flexGrow: 1,
                      minWidth: 80,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: "center",
                      backgroundColor: COLORS.cardSoft,
                    }}
                  >
                    <Text style={{ color: COLORS.text, fontWeight: "800", letterSpacing: 2 }}>{word}</Text>
                  </View>
                ))}
              </View>

              <SegmentedProgress label="Rotation window" caption={`${secondsLeft}s until refresh`} value={progress} />

              <Pressable
                onPress={async () => {
                  try {
                    await setStringAsync(previewWords.join(" - "));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    setCopied(false);
                  }
                }}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 999,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>{copied ? "Copied" : "Copy code"}</Text>
              </Pressable>

              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Updated {previewUpdatedAt || "not yet"}</Text>
              {previewError ? <Text style={{ color: COLORS.error, fontSize: 12 }}>Error: {previewError}</Text> : null}
            </View>

            <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>Security overview</Text>
              <SegmentedProgress
                label="Backend confidence"
                caption={status === "online" ? "Connected" : status === "checking" ? "Checking" : "Offline"}
                value={backendScore}
                tone={status === "online" ? "success" : status === "offline" ? "error" : "muted"}
              />
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Last health check: {lastChecked || "pending"}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Pending requests: {pendingChallenges.length}</Text>
            </View>
          </View>
        ) : null}

        {tab === "requests" ? (
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>Pending sign-in requests</Text>
                <Pressable
                  onPress={() => void syncChallenges()}
                  style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.cardSoft }}
                >
                  <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>{loadingChallenges ? "Syncing..." : "Refresh"}</Text>
                </Pressable>
              </View>
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Last sync: {challengeUpdatedAt || "pending"}</Text>
              {challengeError ? <Text style={{ color: COLORS.error, fontSize: 12 }}>Error: {challengeError}</Text> : null}

              {pendingChallenges.length === 0 ? (
                <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: COLORS.cardSoft, padding: 12 }}>
                  <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: "700" }}>No pending approvals</Text>
                  <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>
                    Incoming sign-in requests will appear here for approve or deny.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {pendingChallenges.map((challenge) => (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      busy={loadingChallenges}
                      onApprove={() => void respondToChallenge(challenge.id, "approve")}
                      onDeny={() => void respondToChallenge(challenge.id, "deny")}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
              <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "700" }}>Recent decisions</Text>
              {recentChallenges.length === 0 ? (
                <Text style={{ color: COLORS.muted, fontSize: 12 }}>No recent approvals or denials yet.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {recentChallenges.map((challenge) => (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      busy={false}
                      onApprove={() => {}}
                      onDeny={() => {}}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : null}

        {tab === "settings" ? (
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>App settings</Text>
              <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>
                Configure your service endpoint and secret. Keep this private.
              </Text>

              <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>Scan or paste setup URI</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, backgroundColor: COLORS.cardSoft }}
                value={setupUriInput}
                onChangeText={setSetupUriInput}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="otpauth://totp/..."
                placeholderTextColor={COLORS.muted}
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => applySetupUri(setupUriInput)}
                  style={{
                    flex: 1,
                    borderRadius: 999,
                    paddingVertical: 10,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.cardSoft,
                  }}
                >
                  <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: 12 }}>Apply URI</Text>
                </Pressable>

                <Pressable
                  onPress={() => void openScanner()}
                  style={{
                    flex: 1,
                    borderRadius: 999,
                    paddingVertical: 10,
                    alignItems: "center",
                    backgroundColor: COLORS.primary,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Scan QR</Text>
                </Pressable>
              </View>

              {setupError ? <Text style={{ color: COLORS.error, fontSize: 12 }}>{setupError}</Text> : null}

              <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>Backend URL</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, backgroundColor: COLORS.cardSoft }}
                value={backendUrl}
                onChangeText={setBackendUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>Account name</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, backgroundColor: COLORS.cardSoft }}
                value={accountName}
                onChangeText={setAccountName}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>Issuer</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, backgroundColor: COLORS.cardSoft }}
                value={issuerName}
                onChangeText={setIssuerName}
                autoCorrect={false}
              />

              <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>Account secret (Base32)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, backgroundColor: COLORS.cardSoft }}
                value={secretKey}
                onChangeText={setSecretKey}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <Pressable
                onPress={() => {
                  void syncPreview();
                  void syncChallenges();
                }}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 999,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>Sync now</Text>
              </Pressable>
            </View>

            <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
              <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "700" }}>Automatic sync</Text>

              <Pressable onPress={() => setAutoHealth((value) => !value)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: COLORS.muted, fontSize: 13 }}>Backend health polling</Text>
                <Text style={{ color: autoHealth ? COLORS.primary : COLORS.muted, fontWeight: "700" }}>{autoHealth ? "On" : "Off"}</Text>
              </Pressable>

              <Pressable onPress={() => setAutoCodeSync((value) => !value)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: COLORS.muted, fontSize: 13 }}>Passive code refresh</Text>
                <Text style={{ color: autoCodeSync ? COLORS.primary : COLORS.muted, fontWeight: "700" }}>{autoCodeSync ? "On" : "Off"}</Text>
              </Pressable>

              <Pressable onPress={() => setAutoChallengeSync((value) => !value)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: COLORS.muted, fontSize: 13 }}>Active request refresh</Text>
                <Text style={{ color: autoChallengeSync ? COLORS.primary : COLORS.muted, fontWeight: "700" }}>{autoChallengeSync ? "On" : "Off"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={showScanner} transparent animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", padding: 16, gap: 12 }}>
          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "800", textAlign: "center" }}>Scan setup QR</Text>
          <Text style={{ color: COLORS.muted, fontSize: 13, textAlign: "center" }}>
            Point your camera at the Xenon Auth setup QR code.
          </Text>
          <View style={{ borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, backgroundColor: "black", height: 360 }}>
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={onQrScanned}
            />
          </View>
          <Pressable
            onPress={() => setShowScanner(false)}
            style={{
              borderRadius: 999,
              paddingVertical: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.cardSoft,
            }}
          >
            <Text style={{ color: COLORS.text, fontWeight: "700" }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}
