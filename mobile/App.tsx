import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

const STEP_SECONDS = 60;
const HALF_LIFE_SECONDS = 30;
const DEFAULT_SECRET = "JBSWY3DPEHPK3PXP";
const DEFAULT_BACKEND_URL = "http://localhost:8000";

const COLORS = {
  background: "#F6F4EF",
  surface: "#FFFFFF",
  surfaceSoft: "#FBFAF7",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#475569",
  accent: "#F97316",
  accentSoft: "rgba(249, 115, 22, 0.14)",
  success: "#16A34A",
  danger: "#DC2626",
};

const MONO_REGULAR = Platform.select({ ios: "System", android: "sans-serif", default: "sans-serif" });
const MONO_BOLD = Platform.select({ ios: "System", android: "sans-serif-medium", default: "sans-serif-medium" });

function useRefreshWindow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
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
    const id = setInterval(checkHealth, STEP_SECONDS * 1000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [backendUrl]);

  return { status, lastChecked };
}

function ProgressRail({
  label,
  caption,
  value,
  statusTone = "accent",
}: {
  label: string;
  caption: string;
  value: number;
  statusTone?: "accent" | "success" | "danger" | "muted";
}) {
  const toneColor =
    statusTone === "success"
      ? COLORS.success
      : statusTone === "danger"
        ? COLORS.danger
        : statusTone === "muted"
          ? COLORS.muted
          : COLORS.accent;

  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressCaption}>{caption}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(8, Math.min(100, value * 100))}%`, backgroundColor: toneColor }]} />
        <View style={styles.progressTicks} pointerEvents="none">
          {Array.from({ length: 5 }).map((_, index) => (
            <View key={index} style={styles.progressTick} />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const { secondsLeft, progress, windowIndex } = useRefreshWindow();
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [secretKey, setSecretKey] = useState(DEFAULT_SECRET);
  const [previewWords, setPreviewWords] = useState<string[]>(["PLUTO", "JAZZ", "ECHO"]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const { status, lastChecked } = useBackendHealth(backendUrl);

  const compact = width < 390;

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
  const cadenceLabel = `${secondsLeft}s to refresh`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor={COLORS.background} translucent={false} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.shell}>
          <View style={styles.heroCard}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>X</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>XENON AUTH</Text>
                <Text style={styles.brandTitle}>Three-word authentication for modern product teams.</Text>
              </View>
            </View>

            <Text style={styles.heroCopy}>
              Use Xenon Auth to test 3-word token generation, monitor backend health, and validate a
              60-second refresh cycle without numeric OTPs.
            </Text>

            <View style={styles.heroActions}>
              <Pressable style={styles.primaryAction} onPress={syncPreview}>
                <Text style={styles.primaryActionText}>Sync preview</Text>
              </Pressable>
              <Pressable style={styles.secondaryAction} onPress={() => setPreviewWords(["PLUTO", "JAZZ", "ECHO"])}>
                <Text style={styles.secondaryActionText}>Reset sample</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionKicker}>SYSTEM STATUS</Text>
                <Text style={styles.sectionTitle}>{statusLabel}</Text>
              </View>
              <View style={[styles.pill, status === "offline" ? styles.pillDanger : status === "checking" ? styles.pillMuted : styles.pillSuccess]}>
                <Text style={styles.pillText}>{statusLabel.toUpperCase()}</Text>
              </View>
            </View>

            <ProgressRail
              label="Backend health"
              caption={status === "online" ? "API reachable" : status === "checking" ? "Checking now" : "No response"}
              value={backendScore / 100}
              statusTone={status === "online" ? "success" : status === "offline" ? "danger" : "muted"}
            />

            <View style={styles.statusDetails}>
              <Text style={styles.statusLine}>Endpoint</Text>
              <Text style={styles.statusValue}>{backendUrl}</Text>
              <Text style={styles.statusMeta}>Last checked: {lastChecked || "pending"}</Text>
            </View>
          </View>

          <View style={styles.testingCard}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionKicker}>TESTING CONSOLE</Text>
                <Text style={styles.sectionTitle}>Preview live codes and timing.</Text>
              </View>
            </View>

            <View style={styles.formGrid}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Backend URL</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={backendUrl}
                  onChangeText={setBackendUrl}
                  placeholder="http://localhost:8000"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Base32 secret</Text>
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={secretKey}
                  onChangeText={setSecretKey}
                  placeholder="JBSWY3DPEHPK3PXP"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.primaryAction} onPress={syncPreview}>
                <Text style={styles.primaryActionText}>{loadingPreview ? "Syncing..." : "Sync preview"}</Text>
                {loadingPreview ? <ActivityIndicator size="small" color="#ffffff" /> : null}
              </Pressable>
            </View>

            <ProgressRail label="Refresh cycle" caption={cadenceLabel} value={progress} />

            {previewError ? <Text style={styles.errorText}>Link error: {previewError}</Text> : null}

            <View style={styles.wordRow}>
              {previewWords.map((word) => (
                <View key={word} style={[styles.wordCard, compact && styles.wordCardCompact]}>
                  <Text style={styles.wordText}>{word}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.statusMeta}>Updated {previewUpdatedAt || "not yet"} • window {windowIndex}</Text>
          </View>

          <View style={styles.howCard}>
            <Text style={styles.sectionKicker}>HOW TO USE</Text>
            <Text style={styles.sectionTitle}>A simple path for testing and rollout.</Text>
            <View style={styles.stepList}>
              {[
                "Start the backend and confirm the health card turns green.",
                "Enter the backend URL and your base32 secret in testing.",
                "Watch the refresh bar roll over every minute and verify the words update.",
              ].map((item, index) => (
                <View key={item} style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
  },
  shell: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: "#FFFFFF",
    fontFamily: MONO_BOLD,
    fontSize: 20,
  },
  kicker: {
    color: COLORS.muted,
    fontFamily: MONO_REGULAR,
    fontSize: 12,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  brandTitle: {
    color: COLORS.text,
    fontFamily: MONO_BOLD,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  heroCopy: {
    color: COLORS.muted,
    fontFamily: MONO_REGULAR,
    fontSize: 14,
    lineHeight: 22,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryAction: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontFamily: MONO_BOLD,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  secondaryAction: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  secondaryActionText: {
    color: COLORS.text,
    fontFamily: MONO_BOLD,
    fontSize: 13,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionKicker: {
    color: COLORS.muted,
    fontFamily: MONO_REGULAR,
    fontSize: 11,
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: COLORS.text,
    fontFamily: MONO_BOLD,
    fontSize: 22,
    lineHeight: 28,
  },
  pill: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  pillText: {
    color: "#FFFFFF",
    fontFamily: MONO_BOLD,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  pillSuccess: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
  pillDanger: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.danger,
  },
  pillMuted: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.muted,
  },
  progressCard: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  progressLabel: {
    color: COLORS.text,
    fontFamily: MONO_BOLD,
    fontSize: 13,
  },
  progressCaption: {
    color: COLORS.muted,
    fontFamily: MONO_REGULAR,
    fontSize: 12,
  },
  progressTrack: {
    height: 14,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    justifyContent: "center",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressTicks: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    opacity: 0.3,
  },
  progressTick: {
    width: 1,
    height: 8,
    backgroundColor: COLORS.text,
  },
  statusDetails: {
    gap: 4,
  },
  statusLine: {
    color: COLORS.muted,
    fontFamily: MONO_REGULAR,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  statusValue: {
    color: COLORS.text,
    fontFamily: MONO_BOLD,
    fontSize: 13,
    lineHeight: 20,
  },
  statusMeta: {
    color: COLORS.muted,
    fontFamily: MONO_REGULAR,
    fontSize: 12,
    lineHeight: 18,
  },
  testingCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  formGrid: {
    gap: 12,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: COLORS.text,
    fontFamily: MONO_BOLD,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: MONO_REGULAR,
    fontSize: 14,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  wordRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  wordCard: {
    flexGrow: 1,
    minWidth: 88,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  wordCardCompact: {
    minWidth: 74,
  },
  wordText: {
    color: COLORS.text,
    fontFamily: MONO_BOLD,
    fontSize: 18,
    letterSpacing: 3,
  },
  errorText: {
    color: COLORS.danger,
    fontFamily: MONO_REGULAR,
    fontSize: 12,
    lineHeight: 18,
  },
  howCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  stepList: {
    gap: 10,
  },
  stepItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepBadgeText: {
    color: COLORS.accent,
    fontFamily: MONO_BOLD,
    fontSize: 12,
  },
  stepText: {
    flex: 1,
    color: COLORS.muted,
    fontFamily: MONO_REGULAR,
    fontSize: 13,
    lineHeight: 20,
  },
} as const;
