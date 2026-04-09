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
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const STEP_SECONDS = 60;
const DEFAULT_SECRET = "JBSWY3DPEHPK3PXP";
const DEFAULT_BACKEND_URL = "http://localhost:8000";

type MobileTab = "status" | "testing" | "guide";

const COLORS = {
  bg: "#0D0D0D",
  card: "#161616",
  cardSoft: "#1D1D1D",
  border: "#2F2F2F",
  text: "#F8FAFC",
  muted: "#A1A1AA",
  primary: "#FF5F1F",
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
  const toneColor = tone === "success" ? COLORS.success : tone === "error" ? COLORS.error : tone === "muted" ? COLORS.muted : COLORS.primary;

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
            width: `${Math.max(8, bounded * 100)}%`,
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

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { progress, secondsLeft, windowIndex } = useRefreshWindow();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<MobileTab>("status");
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [secretKey, setSecretKey] = useState(DEFAULT_SECRET);
  const [autoHealth, setAutoHealth] = useState(true);
  const [autoPreview, setAutoPreview] = useState(true);
  const [previewWords, setPreviewWords] = useState<string[]>(["PLUTO", "JAZZ", "ECHO"]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const { status, lastChecked } = useBackendHealth(backendUrl, autoHealth);
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
                Mobile control center
              </Text>
            </View>
          </View>
          <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 22 }}>
            Status, testing, and usage guidance in one interactive mobile screen.
          </Text>
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
          {([
            ["status", "Status"],
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
          <Pressable onPress={() => setAutoHealth((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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

          <Pressable onPress={() => setAutoPreview((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 36,
                height: 20,
                borderRadius: 999,
                backgroundColor: autoPreview ? COLORS.primary : "#CBD5E1",
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
                  alignSelf: autoPreview ? "flex-end" : "flex-start",
                }}
              />
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 13 }}>Auto preview</Text>
          </Pressable>
        </View>

        {tab === "status" ? (
          <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>Backend status</Text>
            <SegmentedProgress
              label="Health confidence"
              caption={status === "online" ? "Connected" : status === "checking" ? "Checking" : "Offline"}
              value={backendScore}
              tone={status === "online" ? "success" : status === "offline" ? "error" : "muted"}
            />
            <Text style={{ color: COLORS.muted, fontSize: 12, letterSpacing: 1.1 }}>Endpoint</Text>
            <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: "700" }}>{backendUrl}</Text>
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>Last checked: {lastChecked || "pending"}</Text>
          </View>
        ) : null}

        {tab === "testing" ? (
          <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 12 }}>
            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>Testing console</Text>

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

            <Pressable
              onPress={syncPreview}
              style={{ backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>{loadingPreview ? "Syncing..." : "Sync now"}</Text>
              {loadingPreview ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
            </Pressable>

            <SegmentedProgress label="Refresh cadence" caption={`${secondsLeft}s to next window`} value={progress} />

            {previewError ? <Text style={{ color: COLORS.error, fontSize: 12 }}>Error: {previewError}</Text> : null}

            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {previewWords.map((word) => (
                <View key={word} style={{ flexGrow: 1, minWidth: 80, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 14, alignItems: "center", backgroundColor: COLORS.cardSoft }}>
                  <Text style={{ color: COLORS.text, fontWeight: "800", letterSpacing: 2 }}>{word}</Text>
                </View>
              ))}
            </View>

            <Text style={{ color: COLORS.muted, fontSize: 12 }}>Updated {previewUpdatedAt || "not yet"}</Text>
          </View>
        ) : null}

        {tab === "guide" ? (
          <View style={{ backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, gap: 10 }}>
            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "700" }}>How to use</Text>
            {[
              "Start backend and make sure status becomes Connected.",
              "Use Testing tab to set endpoint and secret.",
              "Watch progress cadence and confirm words rotate each interval.",
              "Switch off auto options when you want manual debugging only.",
            ].map((step, index) => (
              <View key={step} style={{ flexDirection: "row", gap: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: COLORS.cardSoft, padding: 10 }}>
                <View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: "rgba(15,118,110,0.15)", justifyContent: "center", alignItems: "center" }}>
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
