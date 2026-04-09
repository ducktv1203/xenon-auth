import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const STEP_SECONDS = 60;
const BACKEND_URL = "http://localhost:8000";
const STORAGE_KEY = "xenon_auth_accounts_v1";

type Mode = "passive" | "active";
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
  responded_at?: number | null;
};

type AccountItem = {
  id: string;
  issuer: string;
  account: string;
  secret: string;
  words: string[];
  lastUpdated: string;
  error: string | null;
};

const COLORS = {
  bg: "#0D0D0D",
  card: "#171717",
  cardSoft: "#1E1E1E",
  border: "#2F2F2F",
  text: "#F8FAFC",
  muted: "#A1A1AA",
  primary: "#FF5F1F",
  primarySoft: "rgba(255,95,31,0.14)",
  success: "#16A34A",
  error: "#DC2626",
};

const MODE_LABELS: Record<Mode, string> = {
  passive: "Codes",
  active: "Sign-in requests",
};

function pressFeedback(pressed: boolean, busy = false) {
  return {
    opacity: (busy ? 0.7 : 1) * (pressed ? 0.78 : 1),
    transform: [{ scale: pressed ? 0.985 : 1 }],
  };
}

function useRefreshWindow() {
  const [now, setNow] = useState(() => Date.now());
  const [anchorMs, setAnchorMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, now - anchorMs);
  const elapsed = (elapsedMs / 1000) % STEP_SECONDS;
  const normalizedElapsed = elapsed < 0 ? elapsed + STEP_SECONDS : elapsed;

  return {
    progress: normalizedElapsed / STEP_SECONDS,
    secondsLeft: Math.max(1, Math.ceil(STEP_SECONDS - normalizedElapsed)),
    windowIndex: Math.floor(now / (STEP_SECONDS * 1000)),
    resetWindow: () => {
      const ts = Date.now();
      setAnchorMs(ts);
      setNow(ts);
    },
  };
}

function parseSetupUri(uri: string): { secret: string; account: string; issuer: string } {
  const trimmed = uri.trim();
  if (!trimmed.toLowerCase().startsWith("otpauth://totp/")) {
    throw new Error("Invalid setup URI");
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
    throw new Error("Secret missing in setup URI");
  }

  const label = decodeURIComponent(encodedLabel.replace(/^\//, ""));
  const labelParts = label.split(":");
  const issuerFromLabel = labelParts.length > 1 ? labelParts[0] : "";
  const accountFromLabel = labelParts.length > 1 ? labelParts.slice(1).join(":") : label;

  return {
    secret,
    issuer: (params.issuer || issuerFromLabel || "Xenon Auth").trim(),
    account: (accountFromLabel || "user@xenon").trim(),
  };
}

function formatSecondsRemaining(expiresAt: number) {
  const remaining = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  if (remaining === 0) return "Expired";
  if (remaining < 60) return `${remaining}s left`;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s left`;
}

function challengeTone(status: ChallengeStatus) {
  if (status === "approved") return COLORS.success;
  if (status === "denied") return COLORS.error;
  if (status === "expired") return COLORS.muted;
  return "#FACC15";
}

function ChallengeCard({
  challenge,
  busy,
  approveCode,
  onApproveCodeChange,
  onApprove,
  onDeny,
}: {
  challenge: ActiveChallenge;
  busy: boolean;
  approveCode: string;
  onApproveCodeChange: (value: string) => void;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const tone = challengeTone(challenge.status);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        backgroundColor: COLORS.cardSoft,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: "800" }}>{challenge.application}</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12 }}>{challenge.user}</Text>
        </View>
        <View
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: `${tone}66`,
            backgroundColor: `${tone}22`,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: tone, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>
            {challenge.status}
          </Text>
        </View>
      </View>

      <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 18 }}>{challenge.message}</Text>
      <Text style={{ color: COLORS.muted, fontSize: 12 }}>
        {challenge.location} · {challenge.device_label} · {formatSecondsRemaining(challenge.expires_at)}
      </Text>

      {challenge.status === "pending" ? (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>Enter code shown on sign-in screen</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 9,
                color: COLORS.text,
                backgroundColor: COLORS.card,
                fontWeight: "700",
                letterSpacing: 1.5,
              }}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="3-digit code"
              placeholderTextColor={COLORS.muted}
              value={approveCode}
              onChangeText={(text) => onApproveCodeChange(text.replace(/\D+/g, "").slice(0, 3))}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={onDeny}
            disabled={busy}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              borderRadius: 999,
              paddingVertical: 11,
              borderWidth: 1,
              borderColor: COLORS.error,
              backgroundColor: "rgba(220,38,38,0.12)",
              ...pressFeedback(pressed, busy),
            })}
          >
            <Text style={{ color: COLORS.text, fontWeight: "800", fontSize: 13 }}>Deny</Text>
          </Pressable>
          <Pressable
            onPress={onApprove}
            disabled={busy}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              borderRadius: 999,
              paddingVertical: 11,
              backgroundColor: COLORS.primary,
              ...pressFeedback(pressed, busy),
            })}
          >
            <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>Approve</Text>
          </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const { progress, secondsLeft, windowIndex, resetWindow } = useRefreshWindow();
  const [mode, setMode] = useState<Mode>("passive");

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const syncCodesInFlightRef = useRef(false);
  const pendingManualRefreshRef = useRef(false);
  const [pasteUri, setPasteUri] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);
  const [challengeCodes, setChallengeCodes] = useState<Record<string, string>>({});
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [loadingChallenges, setLoadingChallenges] = useState(false);

  const pendingChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.status === "pending"),
    [challenges],
  );

  const recentChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.status !== "pending").slice(0, 6),
    [challenges],
  );

  const upsertAccount = (parsed: { secret: string; account: string; issuer: string }) => {
    const accountId = `${parsed.issuer}:${parsed.account}`.toLowerCase();
    setAccounts((current) => {
      const existing = current.find((item) => item.id === accountId);
      const base: AccountItem = {
        id: accountId,
        issuer: parsed.issuer,
        account: parsed.account,
        secret: parsed.secret,
        words: existing?.words ?? ["----", "----", "----"],
        lastUpdated: existing?.lastUpdated ?? "",
        error: null,
      };
      if (existing) {
        return current.map((item) => (item.id === accountId ? base : item));
      }
      return [base, ...current];
    });
    setSetupError(null);
  };

  const applySetupUri = (candidate: string) => {
    try {
      const parsed = parseSetupUri(candidate);
      upsertAccount(parsed);
      setPasteUri("");
      setSetupError(null);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Failed to import account");
    }
  };

  const syncAccountCodes = async (options?: { resetTimer?: boolean }) => {
    if (accounts.length === 0) return;
    if (syncCodesInFlightRef.current) {
      if (options?.resetTimer) {
        pendingManualRefreshRef.current = true;
      }
      return;
    }

    syncCodesInFlightRef.current = true;
    setLoadingCodes(true);
    try {
      const fetchWordsForTime = async (secret: string, unixTime?: number): Promise<string[]> => {
        const response = await fetch(`${BACKEND_URL}/preview/words`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret_key: secret,
            ...(unixTime ? { unix_time: unixTime } : {}),
          }),
        });
        if (!response.ok) throw new Error(`Backend ${response.status}`);

        const payload = (await response.json()) as { words?: unknown };
        if (!Array.isArray(payload.words) || payload.words.length !== 3) {
          throw new Error("Invalid response");
        }
        return payload.words.map((word) => String(word).toUpperCase());
      };

      const updates = await Promise.all(
        accounts.map(async (account) => {
          try {
            let words = await fetchWordsForTime(account.secret);

            if (
              options?.resetTimer &&
              words.join("|") === account.words.join("|")
            ) {
              const nextWindowTime = Math.floor(Date.now() / 1000) + STEP_SECONDS;
              words = await fetchWordsForTime(account.secret, nextWindowTime);
            }

            return {
              id: account.id,
              words,
              lastUpdated: new Date().toLocaleTimeString(),
              error: null,
            };
          } catch (error) {
            return {
              id: account.id,
              words: account.words,
              lastUpdated: account.lastUpdated,
              error: error instanceof Error ? error.message : "Sync failed",
            };
          }
        }),
      );

      setAccounts((current) =>
        current.map((account) => {
          const patch = updates.find((entry) => entry.id === account.id);
          return patch
            ? {
                ...account,
                words: patch.words,
                lastUpdated: patch.lastUpdated,
                error: patch.error,
              }
            : account;
        }),
      );

      if (options?.resetTimer) {
        resetWindow();
      }
    } finally {
      syncCodesInFlightRef.current = false;
      if (pendingManualRefreshRef.current) {
        pendingManualRefreshRef.current = false;
        void syncAccountCodes({ resetTimer: true });
        return;
      }
      setLoadingCodes(false);
    }
  };

  const syncChallenges = async () => {
    setLoadingChallenges(true);
    try {
      setChallengeError(null);
      const response = await fetch(`${BACKEND_URL}/active/challenges?state=all`);
      if (!response.ok) throw new Error(`Backend ${response.status}`);

      const payload = (await response.json()) as { challenges?: unknown };
      if (!Array.isArray(payload.challenges)) throw new Error("Invalid challenge payload");

      setChallenges(
        payload.challenges.map((entry) => ({
          ...entry,
          created_at: Number((entry as { created_at?: number }).created_at ?? 0),
          expires_at: Number((entry as { expires_at?: number }).expires_at ?? 0),
        })) as ActiveChallenge[],
      );
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : "Could not sync requests");
    } finally {
      setLoadingChallenges(false);
    }
  };

  const respondToChallenge = async (challengeId: string, action: "approve" | "deny") => {
    try {
      setChallengeError(null);
      const payload =
        action === "approve"
          ? {
              verification_code: (challengeCodes[challengeId] || "").trim(),
            }
          : undefined;

      if (action === "approve" && !payload?.verification_code) {
        setChallengeError("Enter the 3-digit verification code before approving.");
        return;
      }

      const response = await fetch(`${BACKEND_URL}/active/challenges/${challengeId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      if (!response.ok) {
        let detail = "";
        try {
          const body = (await response.json()) as { detail?: unknown };
          if (typeof body.detail === "string") {
            detail = body.detail;
          }
        } catch {
          // Ignore malformed error payload.
        }

        if (response.status === 400 && /invalid verification code/i.test(detail)) {
          throw new Error("Wrong verification code. Please try again.");
        }

        if (detail) {
          throw new Error(detail);
        }

        throw new Error(`Backend ${response.status}`);
      }
      setChallengeCodes((current) => {
        const next = { ...current };
        delete next[challengeId];
        return next;
      });
      await syncChallenges();
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : "Request update failed");
    }
  };

  const openScanner = async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) {
      setSetupError("Camera permission is required to scan setup QR codes.");
      return;
    }
    setMenuOpen(false);
    setShowScanner(true);
    setScanLocked(false);
  };

  useEffect(() => {
    const loadAccounts = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as AccountItem[];
        if (Array.isArray(parsed)) {
          setAccounts(
            parsed.map((account) => ({
              ...account,
              words: Array.isArray(account.words) && account.words.length === 3 ? account.words : ["----", "----", "----"],
              error: null,
            })),
          );
        }
      } catch {
        // Ignore malformed local state.
      }
    };
    void loadAccounts();
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (accounts.length > 0) {
      void syncAccountCodes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowIndex]);

  useEffect(() => {
    void syncChallenges();
    const id = setInterval(() => {
      void syncChallenges();
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={["top", "left", "right"]}>
      <StatusBar style="light" backgroundColor={COLORS.bg} translucent={false} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: Math.max(insets.top, 14),
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          gap: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: COLORS.primary,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "800", letterSpacing: 1 }}>XA</Text>
            </View>
            <View>
              <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "800" }}>Xenon Auth</Text>
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Secure authenticator</Text>
            </View>
          </View>

          <Pressable
            onPress={() => setMenuOpen(true)}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 12,
              backgroundColor: COLORS.cardSoft,
              paddingHorizontal: 12,
              paddingVertical: 9,
              ...pressFeedback(pressed),
            })}
          >
            <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "800", lineHeight: 20 }}>☰</Text>
          </Pressable>
        </View>

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
          {(["passive", "active"] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setMode(item)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                alignItems: "center",
                backgroundColor: mode === item ? COLORS.primary : COLORS.cardSoft,
                borderWidth: 1,
                borderColor: mode === item ? COLORS.primary : COLORS.border,
                ...pressFeedback(pressed),
              })}
            >
              <Text style={{ color: mode === item ? "#fff" : COLORS.text, fontSize: 13, fontWeight: "800" }}>
                {MODE_LABELS[item]}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === "passive" ? (
          <View style={{ gap: 12 }}>
            {accounts.length === 0 ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 16,
                  backgroundColor: COLORS.card,
                  padding: 16,
                  gap: 10,
                }}
              >
                <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "800" }}>No accounts linked</Text>
                <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>
                  Use Menu to add an account by scanning a QR setup code or pasting an otpauth URI.
                </Text>
              </View>
            ) : (
              accounts.map((account) => (
                <View
                  key={account.id}
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 16,
                    backgroundColor: COLORS.card,
                    padding: 14,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: "800" }}>{account.issuer}</Text>
                      <Text style={{ color: COLORS.muted, fontSize: 12 }}>{account.account}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {account.words.map((word, index) => (
                      <View
                        key={`${account.id}-${index}-${word}`}
                        style={{
                          flexGrow: 1,
                          minWidth: 80,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          borderRadius: 12,
                          paddingVertical: 12,
                          alignItems: "center",
                          backgroundColor: COLORS.cardSoft,
                        }}
                      >
                        <Text style={{ color: COLORS.text, fontWeight: "800", letterSpacing: 1.6 }}>{word}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ gap: 7 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>Rotation window</Text>
                      <Text style={{ color: COLORS.muted, fontSize: 12 }}>{secondsLeft}s to refresh</Text>
                    </View>
                    <View style={{ height: 10, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardSoft, overflow: "hidden" }}>
                      <View style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%`, height: "100%", backgroundColor: COLORS.primary }} />
                    </View>
                  </View>

                  <Text style={{ color: account.error ? COLORS.error : COLORS.muted, fontSize: 12 }}>
                    {account.error || `Updated ${account.lastUpdated || "pending"}`}
                  </Text>
                </View>
              ))
            )}

            <Pressable
              onPress={() => void syncAccountCodes({ resetTimer: true })}
              disabled={loadingCodes || accounts.length === 0}
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: COLORS.primary,
                borderRadius: 999,
                backgroundColor: COLORS.primarySoft,
                paddingVertical: 11,
                alignItems: "center",
                ...pressFeedback(pressed, loadingCodes || accounts.length === 0),
              })}
            >
              <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "800" }}>
                {loadingCodes ? "Refreshing codes..." : "Refresh all codes"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 16,
                backgroundColor: COLORS.card,
                padding: 14,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "800" }}>Sign-in requests</Text>
                <Pressable
                  onPress={() => void syncChallenges()}
                  style={({ pressed }) => ({
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 999,
                    backgroundColor: COLORS.cardSoft,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    ...pressFeedback(pressed),
                  })}
                >
                  <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>
                    {loadingChallenges ? "Syncing..." : "Refresh"}
                  </Text>
                </Pressable>
              </View>

              {challengeError ? <Text style={{ color: COLORS.error, fontSize: 12 }}>{challengeError}</Text> : null}

              {pendingChallenges.length === 0 ? (
                <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, backgroundColor: COLORS.cardSoft }}>
                  <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "700" }}>No pending approvals</Text>
                  <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>
                    Incoming requests will appear here automatically.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {pendingChallenges.map((challenge) => (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      busy={loadingChallenges}
                      approveCode={challengeCodes[challenge.id] || ""}
                      onApproveCodeChange={(value) =>
                        setChallengeCodes((current) => ({
                          ...current,
                          [challenge.id]: value,
                        }))
                      }
                      onApprove={() => void respondToChallenge(challenge.id, "approve")}
                      onDeny={() => void respondToChallenge(challenge.id, "deny")}
                    />
                  ))}
                </View>
              )}
            </View>

            <View
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 16,
                backgroundColor: COLORS.card,
                padding: 14,
                gap: 10,
              }}
            >
              <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "800" }}>Recent activity</Text>
              {recentChallenges.length === 0 ? (
                <Text style={{ color: COLORS.muted, fontSize: 12 }}>No completed approvals yet.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {recentChallenges.map((challenge) => (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      busy={false}
                      approveCode={challengeCodes[challenge.id] || ""}
                      onApproveCodeChange={() => {}}
                      onApprove={() => {}}
                      onDeny={() => {}}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.62)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 14,
          }}
        >
          <View
            style={{
              width: "92%",
              maxWidth: 360,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.card,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "800" }}>Accounts</Text>

            <Pressable
              onPress={() => void openScanner()}
              style={({ pressed }) => ({
                borderRadius: 999,
                backgroundColor: COLORS.primary,
                paddingVertical: 10,
                alignItems: "center",
                ...pressFeedback(pressed),
              })}
            >
              <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>Scan QR setup code</Text>
            </Pressable>

            <TextInput
              style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, color: COLORS.text, backgroundColor: COLORS.cardSoft }}
              placeholder="Paste otpauth URI"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              value={pasteUri}
              onChangeText={setPasteUri}
            />

            <Pressable
              onPress={() => applySetupUri(pasteUri)}
              style={({ pressed }) => ({
                borderRadius: 999,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.cardSoft,
                paddingVertical: 10,
                alignItems: "center",
                ...pressFeedback(pressed),
              })}
            >
              <Text style={{ color: COLORS.text, fontWeight: "800", fontSize: 13 }}>Import from URI</Text>
            </Pressable>

            {setupError ? <Text style={{ color: COLORS.error, fontSize: 12 }}>{setupError}</Text> : null}

            <View style={{ maxHeight: 220, gap: 8 }}>
              {accounts.length === 0 ? (
                <Text style={{ color: COLORS.muted, fontSize: 12 }}>No linked accounts yet.</Text>
              ) : (
                accounts.map((account) => (
                  <View
                    key={`menu-${account.id}`}
                    style={{
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      borderRadius: 12,
                      padding: 10,
                      backgroundColor: COLORS.cardSoft,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "700" }}>{account.issuer}</Text>
                      <Text style={{ color: COLORS.muted, fontSize: 11 }}>{account.account}</Text>
                    </View>
                    <Pressable
                      onPress={() => setAccounts((current) => current.filter((item) => item.id !== account.id))}
                      style={({ pressed }) => ({
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: COLORS.error,
                        backgroundColor: "rgba(220,38,38,0.12)",
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        ...pressFeedback(pressed),
                      })}
                    >
                      <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: "800" }}>Remove</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            <Pressable
              onPress={() => setMenuOpen(false)}
              style={({ pressed }) => ({
                borderRadius: 999,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.cardSoft,
                paddingVertical: 10,
                alignItems: "center",
                ...pressFeedback(pressed),
              })}
            >
              <Text style={{ color: COLORS.text, fontWeight: "800", fontSize: 13 }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showScanner} transparent animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", padding: 16, gap: 12 }}>
          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "800", textAlign: "center" }}>Scan setup QR</Text>
          <Text style={{ color: COLORS.muted, fontSize: 13, textAlign: "center" }}>
            Point the camera at the enrollment QR from your service.
          </Text>

          <View style={{ borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, backgroundColor: "black", height: 360 }}>
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => {
                if (scanLocked) return;
                setScanLocked(true);
                setShowScanner(false);
                applySetupUri(data);
              }}
            />
          </View>

          <Pressable
            onPress={() => setShowScanner(false)}
            style={({ pressed }) => ({
              borderRadius: 999,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.cardSoft,
              paddingVertical: 11,
              alignItems: "center",
              ...pressFeedback(pressed),
            })}
          >
            <Text style={{ color: COLORS.text, fontWeight: "800", fontSize: 13 }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {(loadingCodes || (mode === "active" && loadingChallenges)) ? (
        <View style={{ position: "absolute", bottom: Math.max(insets.bottom, 14), right: 14 }}>
          <View style={{ borderRadius: 999, backgroundColor: COLORS.cardSoft, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: "700" }}>Syncing</Text>
          </View>
        </View>
      ) : null}
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
