import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { setStringAsync } from "expo-clipboard";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const STEP_SECONDS = 60;
const DEFAULT_SECRET = "JBSWY3DPEHPK3PXP";
const DEFAULT_BACKEND_URL = "http://localhost:8000";

type MobileTab = "auth" | "testing" | "guide";
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
  warning: "#F59E0B",
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
      const response = await fetch(`${url.replace(/\/$/, "")}/active/challenges?state=pending`);
      if (!response.ok) throw new Error(`Backend responded ${response.status}`);

      const payload = (await response.json()) as { challenges?: unknown };
      if (!Array.isArray(payload.challenges)) throw new Error("Invalid active challenge payload");

      setChallenges(
        payload.challenges.map((entry) => ({
          ...entry,
          created_at: Number((entry as { created_at?: number }).created_at ?? 0),
          expires_at: Number((entry as { expires_at?: number }).expires_at ?? 0),
        })) as ActiveChallenge[],
      );
      setLastChecked(new Date().toLocaleTimeString());
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Active auth sync failed");
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
            shadowColor: toneColor,
            shadowOpacity: 0.45,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
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
            shadowColor: toneColor,
            shadowOpacity: 0.35,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </View>
    </View>
  );
}

function formatSecondsRemaining(expiresAt: number) {
  const remaining = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  if (remaining === 0) {
    return "Expired";
  }

  if (remaining < 60) {
    return `${remaining}s left`;
  }

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

function AppHeader() {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 20,
        padding: 16,
        gap: 12,
        shadowColor: "#000000",
        shadowOpacity: 0.28,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
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
            Duo-style mobile authenticator
          </Text>
        </View>
      </View>
      <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 22 }}>
        Rotating passcodes and live approve / deny requests, all from one phone screen.
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
    </View>
  );
}

function AppShell() {
  const { progress, secondsLeft, windowIndex } = useRefreshWindow();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<MobileTab>("auth");
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [secretKey, setSecretKey] = useState(DEFAULT_SECRET);
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

  const quickSecrets = useMemo(
    () => [
      { label: "Demo", value: DEFAULT_SECRET },
      { label: "A", value: "KRUGS4ZANFZSAYJA" },
      { label: "B", value: "MZXW6YTBOI======" },
    ],
    [],
  );

  const backendScore = status === "online" ? 1 : status === "checking" ? 0.5 : 0.12;

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

      setPreviewWords(payload.words.map((word) => String(word).toUpperCase()));
      setPreviewUpdatedAt(new Date().toLocaleTimeString());
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setLoadingPreview(false);
    }
  };

  const createDemoChallenge = async () => {
    try {
      setChallengeError(null);
      const response = await fetch(`${backendUrl.replace(/\/$/, "")}/active/challenges/demo`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`Backend responded ${response.status}`);
      await syncChallenges();
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : "Could not create demo request");
    }
  };

  const respondToChallenge = async (challengeId: string, action: "approve" | "deny") => {
    try {
      setChallengeError(null);
      const response = await fetch(`${backendUrl.replace(/\/$/, "")}/active/challenges/${challengeId}/${action}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`Backend responded ${response.status}`);
      setChallenges((current) => current.filter((challenge) => challenge.id !== challengeId));
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
        <AppHeader />

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
            ["auth", "Auth"],
            ["testing", "Testing"],
            ["guide", "Guide"],
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

        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <Pressable onPress={() => setAutoHealth((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 36,
                height: 20,
                borderRadius: 999,
                backgroundColor: autoHealth ? COLORS.primary : "#CBD5E1",
                justifyContent: "center",
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  backgroundColor: "white",
                  alignSelf: autoHealth ? "flex-end" : "flex-start",
                }}
              />
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 13 }}>Auto status</Text>
          </Pressable>

          <Pressable onPress={() => setAutoCodeSync((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 36,
                height: 20,
                borderRadius: 999,
                backgroundColor: autoCodeSync ? COLORS.primary : "#CBD5E1",
                justifyContent: "center",
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  backgroundColor: "white",
                  alignSelf: autoCodeSync ? "flex-end" : "flex-start",
                }}
              />
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 13 }}>Auto code</Text>
          </Pressable>

          <Pressable onPress={() => setAutoChallengeSync((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 36,
                height: 20,
                borderRadius: 999,
                backgroundColor: autoChallengeSync ? COLORS.primary : "#CBD5E1",
                justifyContent: "center",
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  backgroundColor: "white",
                  alignSelf: autoChallengeSync ? "flex-end" : "flex-start",
                }}
              />
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 13 }}>Auto requests</Text>
          </Pressable>
        </View>

        {tab === "auth" ? (
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>Rotating passcode</Text>
              <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>
                Works like a normal authenticator for passive sign-ins. The code rotates on every time window.
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

              <SegmentedProgress label="Refresh cadence" caption={`${secondsLeft}s to next window`} value={progress} />

              <Pressable
                onPress={async () => {
                  const token = previewWords.join(" - ");
                  try {
                    await setStringAsync(token);
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
            </View>

            <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>Active requests</Text>
                  <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>
                    Approve or deny live sign-in prompts like Duo Mobile.
                  </Text>
                </View>
                <Pressable
                  onPress={() => void syncChallenges()}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardSoft }}
                >
                  <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>{loadingChallenges ? "Syncing..." : "Refresh"}</Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <Text style={{ color: COLORS.muted, fontSize: 12 }}>Last sync: {challengeUpdatedAt || "pending"}</Text>
                <Text style={{ color: COLORS.muted, fontSize: 12 }}>{challenges.length} pending</Text>
              </View>

              {challengeError ? <Text style={{ color: COLORS.error, fontSize: 12 }}>Error: {challengeError}</Text> : null}

              {challenges.length === 0 ? (
                <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, backgroundColor: COLORS.cardSoft, gap: 10 }}>
                  <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: "700" }}>No pending requests</Text>
                  <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>
                    When a sign-in request arrives, it will appear here for quick approve / deny actions.
                  </Text>
                  <Pressable
                    onPress={() => void createDemoChallenge()}
                    style={{
                      borderRadius: 999,
                      paddingVertical: 10,
                      alignItems: "center",
                      backgroundColor: COLORS.primarySoft,
                      borderWidth: 1,
                      borderColor: COLORS.primary,
                    }}
                  >
                    <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "800" }}>Create demo request</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {challenges.map((challenge) => (
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
          </View>
        ) : null}

        {tab === "testing" ? (
          <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>Testing console</Text>
            <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>
              Point the app at your backend, sync the passcode, or create demo active requests.
            </Text>

            <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>Backend URL</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, backgroundColor: COLORS.cardSoft }}
              value={backendUrl}
              onChangeText={setBackendUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>Base32 secret</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, backgroundColor: COLORS.cardSoft }}
              value={secretKey}
              onChangeText={setSecretKey}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {quickSecrets.map((entry) => (
                <Pressable
                  key={entry.label}
                  onPress={() => setSecretKey(entry.value)}
                  style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.cardSoft }}
                >
                  <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>{entry.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <Pressable
                onPress={() => void syncPreview()}
                style={{ backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexGrow: 1 }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>{loadingPreview ? "Syncing..." : "Sync passcode"}</Text>
                {loadingPreview ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
              </Pressable>

              <Pressable
                onPress={() => void createDemoChallenge()}
                style={{ borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexGrow: 1, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardSoft }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "700" }}>Create demo request</Text>
              </Pressable>
            </View>

            <SegmentedProgress label="Refresh cadence" caption={`${secondsLeft}s to next window`} value={progress} />

            {previewError ? <Text style={{ color: COLORS.error, fontSize: 12 }}>Error: {previewError}</Text> : null}
            {challengeError ? <Text style={{ color: COLORS.error, fontSize: 12 }}>Error: {challengeError}</Text> : null}

            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Passive sync: {previewUpdatedAt || "not yet"}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Active sync: {challengeUpdatedAt || "pending"}</Text>
            </View>
          </View>
        ) : null}

        {tab === "guide" ? (
          <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 10 }}>
            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>How to use</Text>
            <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>
              Xenon Auth is split into two authenticator patterns: passive rotating codes and active sign-in approvals.
            </Text>
            {[
              "Use the Auth tab for passcodes and incoming requests.",
              "Use Testing to point at your backend and generate demo requests.",
              "Approve or deny active prompts as they arrive.",
              "Keep auto sync enabled for a Duo-style live experience.",
            ].map((step, index) => (
              <View key={step} style={{ flexDirection: "row", gap: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: COLORS.cardSoft, padding: 10 }}>
                <View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: "rgba(255,95,31,0.15)", justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: "800" }}>{index + 1}</Text>
                </View>
                <Text style={{ flex: 1, color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>{step}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
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
