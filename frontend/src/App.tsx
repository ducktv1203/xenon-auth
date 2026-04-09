import { useEffect, useMemo, useState } from "react";

const STEP_SECONDS = 60;
const HALF_LIFE_SECONDS = 30;

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

export default function App() {
  const { secondsLeft, decayRatio } = useHalfLifeTimer();

  const sampleWords = useMemo(() => ["PLUTO", "JAZZ", "ECHO"], []);

  return (
    <div className="shell">
      <div className="ambient-grid" aria-hidden="true" />
      <main className="reactor-panel">
        <header className="panel-header">
          <p className="eyebrow">XENON AUTH // BARYONIC TOKEN</p>
          <h1>NUCLEAR-CHIC AUTH GATE</h1>
        </header>

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
      </main>
    </div>
  );
}
