import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  TextInput,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

const COLORS = {
  pitchBlack: "#0D0D0D",
  neonOrange: "#FF5F1F",
  leadGray: "#2F2F2F",
  ash: "#C6C6C6",
};

const STEP_SECONDS = 60;
const HALF_LIFE_SECONDS = 30;
const MONO_REGULAR = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const MONO_BOLD = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const DEFAULT_SECRET = "JBSWY3DPEHPK3PXP";
const DEFAULT_BACKEND_URL = "http://localhost:8000";

function useHalfLifeTimer() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const elapsed = (now / 1000) % STEP_SECONDS;
  const secondsLeft = Math.ceil(STEP_SECONDS - elapsed);
  const decayRatio = Math.exp(-(Math.log(2) / HALF_LIFE_SECONDS) * elapsed);
  const timeWindow = Math.floor(now / (STEP_SECONDS * 1000));

  return { secondsLeft, decayRatio, timeWindow };
}

export default function App() {
  const { width } = useWindowDimensions();
  const { secondsLeft, decayRatio, timeWindow } = useHalfLifeTimer();
  const sampleWords = useMemo(() => ["PLUTO", "JAZZ", "ECHO"], []);
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [secretKey, setSecretKey] = useState(DEFAULT_SECRET);
  const [words, setWords] = useState<string[]>(sampleWords);
  const [loadingWords, setLoadingWords] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchWords = async () => {
    setLoadingWords(true);
    setErrorMessage(null);
    try {
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
        throw new Error("Invalid words payload");
      }

      setWords(payload.words.map((word) => String(word).toUpperCase()));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch words");
    } finally {
      setLoadingWords(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, [backendUrl, secretKey]);

  useEffect(() => {
    fetchWords();
  }, [timeWindow]);

  const compact = width < 420;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" translucent={false} backgroundColor={COLORS.pitchBlack} />
      <View style={styles.shell}>
        <Text style={styles.eyebrow}>XENON AUTH // BARYONIC TOKEN</Text>
        <Text style={[styles.title, compact && styles.titleCompact]}>NUCLEAR-CHIC AUTH GATE</Text>

        <View style={styles.configPanel}>
          <Text style={styles.inputLabel}>BACKEND URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="http://localhost:8000"
            placeholderTextColor="#737373"
            style={styles.input}
          />
          <Text style={styles.inputLabel}>BASE32 SECRET</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            value={secretKey}
            onChangeText={setSecretKey}
            placeholder="JBSWY3DPEHPK3PXP"
            placeholderTextColor="#737373"
            style={styles.input}
          />
          <Pressable style={styles.refreshButton} onPress={fetchWords}>
            <Text style={styles.refreshText}>SYNC CORE</Text>
            {loadingWords ? <ActivityIndicator size="small" color="#0D0D0D" /> : null}
          </Pressable>
          {errorMessage ? <Text style={styles.errorText}>Link error: {errorMessage}</Text> : null}
        </View>

        <View style={[styles.wordsStack, compact && styles.wordsStackCompact]}>
          {words.map((word) => (
            <View key={word} style={styles.wordCell}>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>

        <View style={styles.decayZone}>
          <View style={styles.decayLabelRow}>
            <Text style={styles.decayLabel}>HALF-LIFE DECAY</Text>
            <Text style={styles.decayLabel}>{secondsLeft}s</Text>
          </View>
          <View style={styles.decayTrack}>
            <View style={[styles.decayFill, { transform: [{ scaleX: decayRatio }] }]} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.pitchBlack,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    justifyContent: "flex-start",
    backgroundColor: COLORS.pitchBlack,
  },
  eyebrow: {
    color: COLORS.ash,
    fontFamily: MONO_REGULAR,
    letterSpacing: 2,
    fontSize: 11,
    marginBottom: 10,
  },
  title: {
    color: COLORS.neonOrange,
    fontFamily: MONO_BOLD,
    fontWeight: "700",
    letterSpacing: 1,
    fontSize: 29,
    marginBottom: 18,
  },
  titleCompact: {
    fontSize: 24,
  },
  configPanel: {
    borderWidth: 2,
    borderColor: COLORS.leadGray,
    backgroundColor: "#151515",
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  inputLabel: {
    color: COLORS.ash,
    fontFamily: MONO_REGULAR,
    fontSize: 11,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 2,
    borderColor: COLORS.leadGray,
    color: "#FFFFFF",
    backgroundColor: "#0F0F0F",
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: MONO_REGULAR,
    fontSize: 13,
  },
  refreshButton: {
    marginTop: 2,
    borderWidth: 2,
    borderColor: COLORS.neonOrange,
    backgroundColor: COLORS.neonOrange,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  refreshText: {
    color: "#0D0D0D",
    fontFamily: MONO_BOLD,
    fontWeight: "700",
    letterSpacing: 1,
  },
  errorText: {
    color: "#FF8A6A",
    fontFamily: MONO_REGULAR,
    fontSize: 12,
  },
  wordsStack: {
    gap: 12,
  },
  wordsStackCompact: {
    gap: 10,
  },
  wordCell: {
    borderColor: COLORS.leadGray,
    borderWidth: 2,
    backgroundColor: "#141414",
    minHeight: 88,
    justifyContent: "center",
    alignItems: "center",
  },
  wordText: {
    color: "#FFF",
    fontFamily: MONO_BOLD,
    fontWeight: "700",
    letterSpacing: 4,
    fontSize: 30,
    textShadowColor: "rgba(255,95,31,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  decayZone: {
    marginTop: 24,
  },
  decayLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  decayLabel: {
    color: COLORS.ash,
    fontFamily: MONO_REGULAR,
    fontSize: 12,
    letterSpacing: 1,
  },
  decayTrack: {
    borderWidth: 2,
    borderColor: COLORS.leadGray,
    backgroundColor: "#111",
    padding: 3,
    overflow: "hidden",
  },
  decayFill: {
    height: 22,
    backgroundColor: COLORS.neonOrange,
  },
});
