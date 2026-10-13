import { useEffect, useRef, useState } from "react";

export function Credit() {
  return (
    <div className="credit">
      <img className="mark" src="/brand/futuret3ch.png" alt="" />
      <p>
        Created by <strong>Futuret3ch</strong>
      </p>
      <img className="coin" src="/brand/t3x-coin.png" alt="T3x" />
    </div>
  );
}

export function Trailer({ onDone }: { onDone: () => void }) {
  const done = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [audible, setAudible] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = () => {
    if (done.current) return;
    done.current = true;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    onDoneRef.current();
  };

  const enableSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    setAudible(true);
    void video.play().catch(() => setFailed(true));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape" && e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      finish();
    };
    window.addEventListener("keydown", onKey, true);
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.volume = 1;
      void video.play().then(() => setAudible(true)).catch(() => {
        video.muted = true;
        setAudible(false);
        void video.play().catch(() => setFailed(true));
      });
    }
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  if (failed) {
    return (
      <div className="trailer" role="dialog" aria-label="Lumenfall trailer">
        <img className="tr-still" src="/art/nave.jpg" alt="" />
        <div className="tr-card">
          <p className="label">A Futuret3ch game</p>
          <h1>Lumenfall</h1>
          <p className="dek">Weave through the falling nave.</p>
          <Credit />
          <button type="button" className="btn primary" onClick={finish}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="trailer"
      role="dialog"
      aria-label="Lumenfall trailer"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        if (!audible) enableSound();
      }}
    >
      <video
        ref={videoRef}
        className="tr-video"
        src="/trailers/intro.mp4"
        poster="/trailers/poster.jpg"
        autoPlay
        playsInline
        preload="auto"
        onEnded={finish}
        onError={() => setFailed(true)}
      />
      <div className="tr-tools">
        {audible ? null : (
          <button type="button" className="tr-skip" onClick={enableSound}>
            Sound
          </button>
        )}
        <button type="button" className="tr-skip" onClick={finish}>
          Skip
        </button>
      </div>
    </div>
  );
}
