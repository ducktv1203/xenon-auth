import { useEffect, useMemo, useState } from "react";

const STEP_SECONDS = 60;
const HALF_LIFE_SECONDS = 30;
const DEFAULT_BACKEND_URL = "http://localhost:8000";

type BackendStatus = "checking" | "online" | "offline";

function useHalfLifeTimer() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = (now / 1000) % STEP_SECONDS;
  const secondsLeft = Math.ceil(STEP_SECONDS - elapsed);
  const lambda = Math.log(2) / HALF_LIFE_SECONDS;
  const decayRatio = Math.exp(-lambda * elapsed);

  return { secondsLeft, decayRatio };
}

function useBackendStatus(backendUrl: string) {
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [lastChecked, setLastChecked] = useState<string>("");

  useEffect(() => {
    let active = true;

    const checkHealth = async () => {
      setStatus((current) => (current === "offline" ? "checking" : current));
      try {
        const response = await fetch(`${backendUrl.replace(/\/$/, "")}/health`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        if (active) {
          setStatus("online");
          setLastChecked(new Date().toLocaleTimeString());
        }
      } catch {
        if (active) {
          setStatus("offline");
          setLastChecked(new Date().toLocaleTimeString());
        }
      }
    };

    checkHealth();
    const id = window.setInterval(checkHealth, STEP_SECONDS * 1000);

    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [backendUrl]);

  return { status, lastChecked };
}

export default function App() {
  const { secondsLeft, decayRatio } = useHalfLifeTimer();
  const sampleWords = useMemo(() => ["PLUTO", "JAZZ", "ECHO"], []);
  const [backendUrl] = useState(DEFAULT_BACKEND_URL);
  const { status, lastChecked } = useBackendStatus(backendUrl);

  const statusTone = status === "online" ? "LIVE" : status === "offline" ? "DOWN" : "CHECKING";

  return (
    <div className="shell">
      <div className="ambient-grid" aria-hidden="true" />
      <main className="landing-layout">
        <section className="hero-panel">
          <p className="eyebrow">XENON AUTH // BARYONIC AUTHENTICATION PLATFORM</p>
          <h1>Subatomic 2FA for products that refuse ordinary codes.</h1>
          <p className="hero-copy">
            Replace numeric OTPs with deterministic 3-word arrays, client-side encrypted
            personal decks, and a 60-second half-life refresh loop.
          </p>

          <div className="hero-actions">
            <a className="primary-action" href="#testing">
              Open Testing Console
            </a>
            <a className="secondary-action" href="#status">
              View System Status
            </a>
          </div>

          <div className="hero-stat-grid">
            <article className="hero-stat">
              <span>MODE</span>
              <strong>LANDING + TESTING</strong>
            </article>
            <article className="hero-stat">
              <span>REFRESH</span>
              <strong>{secondsLeft}s</strong>
            </article>
            <article className="hero-stat">
              <span>BACKEND</span>
              <strong>{statusTone}</strong>
            </article>
          </div>
        </section>

        <section className="status-column" id="status">
          <article className={`status-card status-${status}`}>
            <div className="status-card-header">
              <div>
                <p className="eyebrow">SYSTEM STATUS</p>
                <h2>{status === "online" ? "Backend is live" : status === "offline" ? "Backend unreachable" : "Checking backend"}</h2>
              </div>
              <div className="status-pill">{statusTone}</div>
            </div>
            <p className="status-copy">
              API endpoint: <span>{backendUrl}</span>
              <br />
              Last check: <span>{lastChecked || "pending"}</span>
            </p>
            <div className="status-meter">
              <div className="status-meter-fill" />
            </div>
          </article>

          <article className="status-card">
            <p className="eyebrow">PRODUCT TESTS</p>
            <h2>What this build already proves</h2>
            <ul className="feature-list">
              <li>Backend health route from mobile and web.</li>
              <li>Deterministic 3-word token preview every 60 seconds.</li>
              <li>Client-side encrypted personal deck flow scaffold.</li>
              <li>Mobile Expo app ready for live phone testing.</li>
            </ul>
          </article>
        </section>

        <section className="testing-panel" id="testing">
          <div className="panel-header">
            <p className="eyebrow">LIVE TOKEN PREVIEW</p>
            <h2>Testing surface</h2>
          </div>

          <section className="words-display" aria-label="Current authentication words">
            {sampleWords.map((word) => (
              <article key={word} className="word-cell">
                {word}
              </article>
            ))}
          </section>

          <section className="decay-zone" aria-label="Token half-life countdown">
            <div className="decay-label-row">
              <span>HALF-LIFE DECAY</span>
              <span>{secondsLeft}s</span>
            </div>
            <div className="decay-track">
              <div className="decay-fill" style={{ transform: `scaleX(${decayRatio})` }} />
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
