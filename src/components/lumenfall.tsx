import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { formatScore, Game, type Snap } from "@/game/game";

const initial: Snap = {
  phase: "title",
  score: 0,
  best: 0,
  lives: 3,
  nova: 0,
  dash: 1,
  wave: 1,
  combo: 0,
  boss: null,
  bossMax: 1,
  muted: false,
  shake: true,
  banner: "",
  bannerId: 0,
  surpassed: false,
};

export function LumenfallApp() {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snap>(initial);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.max(1, Math.round(frame.clientWidth * dpr));
      const bh = Math.max(1, Math.round(frame.clientHeight * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    const game = new Game(canvas, setSnap);
    gameRef.current = game;
    const onVis = () => {
      if (document.hidden && game.phase === "play") game.pause();
      else game.audioResume();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const play = () => {
    const game = gameRef.current;
    game?.unlock();
    game?.begin();
  };

  return (
    <main className="app">
      <div className="frame" ref={frameRef}>
        <canvas ref={canvasRef} aria-label="Lumenfall" />
        {snap.phase === "play" || snap.phase === "pause" ? (
          <>
            <header className="hud">
              <div className="chip">
                <p className="label">Score</p>
                <p className="stat">{formatScore(snap.score)}</p>
                {snap.combo >= 2 ? <p className="combo">Chain {snap.combo}</p> : null}
                {snap.surpassed ? <p className="mark">Best</p> : null}
              </div>
              <div className="chip-row">
                <div className="chip">
                  <p className="label">{snap.boss !== null ? "Choir" : "Wave"}</p>
                  <p className="stat">{snap.wave}</p>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={snap.phase === "pause" ? "Resume" : "Pause"}
                  onClick={() => {
                    const game = gameRef.current;
                    if (snap.phase === "pause") game?.resume();
                    else game?.pause();
                  }}
                >
                  {snap.phase === "pause" ? <Play size={18} strokeWidth={1.75} /> : <Pause size={18} strokeWidth={1.75} />}
                </button>
              </div>
            </header>
            {snap.boss !== null ? (
              <div className="bossbar" aria-hidden="true">
                <span style={{ width: `${Math.max(0, (snap.boss / snap.bossMax) * 100)}%` }} />
              </div>
            ) : null}
            {snap.banner ? (
              <p className="banner" key={snap.bannerId}>
                {snap.banner}
              </p>
            ) : null}
            <div className="dock">
              <div className="meters">
                <div className="lives" aria-label={`${snap.lives} lives`}>
                  {[0, 1, 2].map((i) => (
                    <i key={i} className={i < snap.lives ? "on" : ""} />
                  ))}
                </div>
                <div className="meter-line">
                  <span>Dash</span>
                  <div className="track">
                    <b style={{ width: `${snap.dash * 100}%` }} />
                  </div>
                </div>
                <div className={`meter-line${snap.nova >= 1 ? " ready" : ""}`}>
                  <span>Nova</span>
                  <div className="track">
                    <b style={{ width: `${snap.nova * 100}%` }} />
                  </div>
                </div>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="act"
                  disabled={snap.nova < 1}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const game = gameRef.current;
                    game?.unlock();
                    game?.requestNova();
                  }}
                >
                  Nova
                </button>
                <button
                  type="button"
                  className="act solid"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const game = gameRef.current;
                    game?.unlock();
                    game?.requestDash();
                  }}
                >
                  Dash
                </button>
              </div>
            </div>
          </>
        ) : null}

        {snap.phase === "title" ? (
          <section className="sheet" aria-label="Start">
            <h1>Lumenfall</h1>
            <p className="dek">Weave a glass courier through the falling nave.</p>
              <button type="button" className="btn primary" onClick={play}>
                Begin
              </button>
            <ul className="help">
              <li>
                <span>Move</span>
                <span>Keys or drag</span>
              </li>
              <li>
                <span>Dash</span>
                <span>Space</span>
              </li>
              <li>
                <span>Nova</span>
                <span>F when the meter is full</span>
              </li>
            </ul>
            {snap.best > 0 ? (
              <p className="best">
                Best <strong>{formatScore(snap.best)}</strong>
              </p>
            ) : null}
          </section>
        ) : null}

        {snap.phase === "pause" ? (
          <div className="veil center">
            <div className="modal" role="dialog" aria-label="Paused">
              <h2>Paused</h2>
              <p className="dek">The nave holds.</p>
              <div className="stack">
                <button type="button" className="btn primary" onClick={() => gameRef.current?.resume()}>
                  Resume
                </button>
                <button
                  type="button"
                  className="toggle"
                  aria-pressed={snap.shake}
                  onClick={() => gameRef.current?.toggleShake()}
                >
                  Screen shake
                  <em>{snap.shake ? "On" : "Off"}</em>
                </button>
                <button
                  type="button"
                  className="toggle"
                  aria-pressed={!snap.muted}
                  onClick={() => gameRef.current?.toggleMute()}
                >
                  Sound
                  <em>{snap.muted ? "Off" : "On"}</em>
                </button>
                <button type="button" className="btn ghost" onClick={() => gameRef.current?.endRun()}>
                  End run
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {snap.phase === "over" ? (
          <div className="veil">
            <div className="modal" role="dialog" aria-label="Run over">
              <h2>The nave closes</h2>
              <p className="stat over-score">{formatScore(snap.score)}</p>
              <p className="best">
                Best <strong>{formatScore(snap.best)}</strong>
              </p>
              <button type="button" className="btn primary" onClick={play}>
                Fly again
              </button>
              <button type="button" className="btn ghost" onClick={() => gameRef.current?.toTitle()}>
                Title
              </button>
              <button
                type="button"
                className="icon-btn mute"
                aria-label={snap.muted ? "Unmute" : "Mute"}
                onClick={() => gameRef.current?.toggleMute()}
              >
                {snap.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
