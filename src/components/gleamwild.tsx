import { useEffect, useRef, useState } from "react";
import { Credit } from "@/components/trailer";
import { advantage, byId, rollSpecies, type Species } from "@/game/gleam/bestiary";

type Kin = { uid: string; species: string; hp: number; max: number };
type Spawn = { id: string; species: string; yaw: number; pitch: number };
type Save = { prisms: number; roster: Kin[]; seen: string[]; caught: string[]; active: string | null };
type Meet = {
  spawnId: string;
  species: string;
  hp: number;
  max: number;
  note: string;
  busy: boolean;
  battle: boolean;
};

const SAVE_KEY = "gleamwild-v1";

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) throw new Error("empty");
    const data = JSON.parse(raw) as Save;
    if (!Array.isArray(data.roster)) throw new Error("bad");
    return data;
  } catch {
    return { prisms: 6, roster: [], seen: [], caught: [], active: null };
  }
}

function uid() {
  return `k${Math.random().toString(36).slice(2, 8)}`;
}

function wrap(n: number) {
  let v = n;
  while (v > 180) v -= 360;
  while (v < -180) v += 360;
  return v;
}

export function Gleamwild() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const look = useRef({ yaw: 0, pitch: 0 });
  const ringScale = useRef(1);
  const tilt = useRef(false);
  const keys = useRef<Record<string, boolean>>({});
  const audio = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [save, setSave] = useState<Save>({ prisms: 6, roster: [], seen: [], caught: [], active: null });
  const [ready, setReady] = useState(false);
  const [field, setField] = useState(false);
  const [cam, setCam] = useState(false);
  const [spawns, setSpawns] = useState<Spawn[]>([]);
  const [meet, setMeet] = useState<Meet | null>(null);
  const [dex, setDex] = useState(false);
  const [banner, setBanner] = useState("");
  const [camNote, setCamNote] = useState("");

  useEffect(() => {
    setSave(loadSave());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [save, ready]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!field) return;
    let raf = 0;
    const tick = (t: number) => {
      const held = keys.current;
      if (!tilt.current) {
        if (held.ArrowLeft || held.KeyA) look.current.yaw -= 1.4;
        if (held.ArrowRight || held.KeyD) look.current.yaw += 1.4;
        if (held.ArrowUp || held.KeyW) look.current.pitch -= 0.9;
        if (held.ArrowDown || held.KeyS) look.current.pitch += 0.9;
        look.current.pitch = Math.max(-30, Math.min(30, look.current.pitch));
      }
      const nodes = stageRef.current?.querySelectorAll<HTMLElement>(".gw-kin");
      nodes?.forEach((el) => {
        if (el.dataset.lock === "1") return;
        const dy = wrap(Number(el.dataset.yaw) - look.current.yaw);
        const dp = Number(el.dataset.pitch) - look.current.pitch;
        const x = 50 + (dy / 62) * 50;
        const y = 44 + (dp / 46) * 50;
        const on = Math.abs(dy) < 50 && Math.abs(dp) < 36;
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        el.style.opacity = on ? "1" : "0";
        el.style.visibility = on ? "visible" : "hidden";
        const bob = Math.sin(t / 480 + Number(el.dataset.yaw)) * 7;
        el.style.transform = `translate(-50%, -50%) translateY(${bob}px)`;
      });
      if (worldRef.current && !cam) {
        worldRef.current.style.backgroundPosition = `${50 - look.current.yaw * 0.32}% ${40 + look.current.pitch * 0.35}%`;
      }
      if (ringRef.current) {
        const u = (t % 1200) / 1200;
        const scale = 1.18 - u * 0.82;
        ringScale.current = scale;
        ringRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [field, cam]);

  const tone = (freq: number, dur = 0.12, gain = 0.05) => {
    const ctx = audio.current;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  };

  const unlock = () => {
    if (!audio.current) audio.current = new AudioContext();
    void audio.current.resume();
  };

  const enter = async (wantCam: boolean) => {
    unlock();
    tone(520, 0.08, 0.04);
    let got = false;
    if (wantCam) {
      const video = videoRef.current;
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamNote("This browser is blocking the camera. Open the Gleamwild link in Safari or Chrome, not inside the X app.");
        return;
      }
      if (video) {
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
      }
      const Device = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      const orientPromise =
        typeof Device.requestPermission === "function" ? Device.requestPermission() : null;
      const tries: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        { video: true, audio: false },
      ];
      let stream: MediaStream | null = null;
      let reason = "blocked";
      for (const constraints of tries) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          reason = err instanceof Error ? err.name : "blocked";
        }
      }
      if (!stream || !video) {
        const inApp = /FBAN|FBAV|Instagram|Twitter|Line\//i.test(navigator.userAgent);
        setCamNote(
          reason === "NotAllowedError"
            ? "Camera permission was denied. Allow it, or open this page in Safari or Chrome."
            : inApp
              ? "The in-app browser is blocking the camera. Use the menu and open this page in Safari or Chrome."
              : "Could not open the camera. Open this page in Safari or Chrome and allow the prompt.",
        );
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        stream.getTracks().forEach((track) => track.stop());
        setCamNote("The camera would not start. Open this page in Safari or Chrome.");
        return;
      }
      got = true;
      if (orientPromise) {
        void orientPromise.then((answer) => {
          if (answer !== "granted") return;
          let origin: number | null = null;
          window.addEventListener("deviceorientation", (e) => {
            if (e.alpha == null || e.beta == null) return;
            if (origin == null) origin = e.alpha;
            const delta = wrap(e.alpha - origin);
            if (Math.abs(delta) < 3 && !tilt.current) return;
            tilt.current = true;
            look.current.yaw = delta;
            look.current.pitch = Math.max(-30, Math.min(30, (e.beta - 70) * 0.55));
          });
        });
      }
    }
    setCam(got);
    setCamNote("");
    setBanner(got ? "Turn in place. Tap what you find." : "Drag to look around. Tap a gleam.");
    const spots = [
      { yaw: 0, pitch: -2 },
      { yaw: -34, pitch: 5 },
      { yaw: 40, pitch: 1 },
      { yaw: 108, pitch: -4 },
      { yaw: -102, pitch: 6 },
    ];
    const used: string[] = [];
    const placed: Spawn[] = spots.map((spot) => {
      const species = rollSpecies(used);
      used.push(species.id);
      return { id: uid(), species: species.id, ...spot };
    });
    setSpawns(placed);
    setSave((s) => ({ ...s, seen: Array.from(new Set([...s.seen, ...used])) }));
    setField(true);
  };

  const openSpawn = (spawn: Spawn) => {
    if (meet) return;
    tone(660, 0.07, 0.04);
    const species = byId(spawn.species);
    setMeet({
      spawnId: spawn.id,
      species: spawn.species,
      hp: species.hp,
      max: species.hp,
      note: species.blurb,
      busy: false,
      battle: false,
    });
  };

  const activeKin = save.roster.find((k) => k.uid === save.active) ?? save.roster[0] ?? null;

  const replaceSpawn = (spawnId: string) => {
    setSpawns((list) => {
      const used = list.map((s) => s.species);
      const species = rollSpecies(used);
      const yaw = look.current.yaw + 70 + Math.random() * 80;
      const next = list.filter((s) => s.id !== spawnId);
      next.push({ id: uid(), species: species.id, yaw, pitch: -4 + Math.random() * 10 });
      setSave((s) => ({ ...s, seen: Array.from(new Set([...s.seen, species.id])) }));
      return next;
    });
  };

  const keep = (speciesId: string, spawnId: string) => {
    const species = byId(speciesId);
    const kin: Kin = { uid: uid(), species: speciesId, hp: species.hp, max: species.hp };
    setSave((s) => ({
      ...s,
      roster: [...s.roster, kin],
      caught: s.caught.includes(speciesId) ? s.caught : [...s.caught, speciesId],
      active: s.active ?? kin.uid,
      prisms: Math.min(10, s.prisms + 1),
    }));
    tone(784, 0.16, 0.06);
    replaceSpawn(spawnId);
    setMeet((m) => (m ? { ...m, busy: true, note: `${species.name} stays with you.` } : m));
    setBanner(`${species.name} caught.`);
  };

  const slipAway = () => {
    if (!meet) return;
    replaceSpawn(meet.spawnId);
    setMeet(null);
    setBanner("It slipped back into the glass.");
  };

  const throwPrism = () => {
    if (!meet || meet.busy || save.prisms < 1) return;
    const scale = ringScale.current;
    const quality = scale < 0.5 ? 1 : scale < 0.74 ? 0.7 : 0.36;
    const species = byId(meet.species);
    const hpLeft = meet.hp / meet.max;
    const chance = Math.min(0.94, Math.max(0.07, species.catch * quality * (1.25 - hpLeft * 0.8)));
    const label = quality > 0.9 ? "The prism sits true." : quality > 0.5 ? "A fair throw." : "It glanced off.";
    setSave((s) => ({ ...s, prisms: s.prisms - 1 }));
    setMeet({ ...meet, busy: true, note: label });
    tone(quality > 0.9 ? 880 : 440, 0.1, 0.05);
    window.setTimeout(() => {
      if (Math.random() < chance) keep(meet.species, meet.spawnId);
      else {
        tone(196, 0.14, 0.04);
        setMeet((m) => (m ? { ...m, busy: false, note: "It shook free." } : m));
      }
    }, 680);
  };

  const strike = (moveIndex: 0 | 1, fromKin: boolean) => {
    if (!meet || meet.busy) return;
    const wild = byId(meet.species);
    const kin = fromKin ? activeKin : null;
    const actor: Species | null = kin ? byId(kin.species) : null;
    const move = actor ? actor.moves[moveIndex] : { name: "Shard", type: "neutral" as const, power: 8 };
    const mult = advantage(move.type, wild.type);
    const dmg = Math.max(1, Math.round(move.power * mult * (0.9 + Math.random() * 0.22)));
    const hp = Math.max(0, meet.hp - dmg);
    const edge = mult > 1 ? " It bites." : mult < 1 ? " It glances." : "";
    tone(320, 0.08, 0.05);
    if (hp <= 0) {
      setMeet({ ...meet, hp: 0, busy: true, note: `${move.name}.${edge} It yields.` });
      window.setTimeout(() => keep(meet.species, meet.spawnId), 500);
      return;
    }
    setMeet({ ...meet, hp, busy: true, battle: fromKin, note: `${move.name} for ${dmg}.${edge}` });
    window.setTimeout(() => {
      if (!kin) {
        setMeet((m) => (m ? { ...m, busy: false, note: "It watches you." } : m));
        return;
      }
      const back = wild.moves[Math.random() < 0.45 ? 0 : 1];
      const backMult = advantage(back.type, byId(kin.species).type);
      const backDmg = Math.max(1, Math.round(back.power * backMult * (0.85 + Math.random() * 0.25)));
      setSave((s) => ({
        ...s,
        roster: s.roster.map((row) =>
          row.uid === kin.uid ? { ...row, hp: Math.max(0, row.hp - backDmg) } : row,
        ),
      }));
      const faint = kin.hp - backDmg <= 0;
      if (faint) {
        setSave((s) => ({
          ...s,
          roster: s.roster.map((row) => (row.uid === kin.uid ? { ...row, hp: 1 } : row)),
        }));
        setMeet((m) =>
          m ? { ...m, busy: false, battle: false, note: `${byId(kin.species).name} drops. The gleam stays.` } : m,
        );
        return;
      }
      setMeet((m) =>
        m ? { ...m, busy: false, note: `${wild.name} uses ${back.name} for ${backDmg}.` } : m,
      );
    }, 520);
  };

  const species = meet ? byId(meet.species) : null;

  return (
    <main
      className={field && meet ? "gleam meeting" : "gleam"}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button, a")) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const yaw = look.current.yaw;
        const pitch = look.current.pitch;
        const id = e.pointerId;
        const move = (ev: PointerEvent) => {
          if (ev.pointerId !== id || tilt.current) return;
          look.current.yaw = yaw + (ev.clientX - startX) * 0.16;
          look.current.pitch = Math.max(-30, Math.min(30, pitch + (ev.clientY - startY) * 0.1));
        };
        const stop = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", stop);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", stop);
      }}
    >
      <video ref={videoRef} className={cam ? "gw-cam on" : "gw-cam"} playsInline muted autoPlay />
      <div ref={worldRef} className={cam ? "gw-world off" : "gw-world"} />
      <div ref={stageRef} className="gw-stage">
        {spawns.map((spawn) => (
          <button
            key={spawn.id}
            type="button"
            className={meet?.spawnId === spawn.id ? "gw-kin focus" : "gw-kin"}
            data-yaw={spawn.yaw}
            data-pitch={spawn.pitch}
            data-lock={meet?.spawnId === spawn.id ? "1" : "0"}
            onClick={() => openSpawn(spawn)}
          >
            <img src={`/gleam/${spawn.species}.png`} alt={byId(spawn.species).name} />
          </button>
        ))}
      </div>

      {field ? (
        <header className="gw-hud">
          <p className="gw-pill">Prisms {save.prisms}</p>
          <button type="button" className="gw-pill" onClick={() => setDex(true)}>
            Field book {save.caught.length}/8
          </button>
        </header>
      ) : null}

      {field && banner ? <p className="gw-banner">{banner}</p> : null}

      {field && activeKin ? (
        <button
          type="button"
          className="gw-partner"
          onClick={() => setDex(true)}
          aria-label={`${byId(activeKin.species).name}, your partner`}
        >
          <img src={`/gleam/${activeKin.species}.png`} alt="" />
          <span>
            {byId(activeKin.species).name}
            <em>
              {activeKin.hp}/{activeKin.max}
            </em>
          </span>
        </button>
      ) : null}

      {!field ? (
        <section className="gw-title">
          <p className="label">Futuret3ch</p>
          <h1>Gleamwild</h1>
          <p className="dek">Original kin, seen through the glass. Look around. Weaken them. Throw a prism.</p>
          <button type="button" className="btn primary" onClick={() => void enter(true)}>
            Open the camera
          </button>
          {camNote ? <p className="gw-note">{camNote}</p> : null}
          <button type="button" className="btn ghost" onClick={() => void enter(false)}>
            Walk the field
          </button>
          <Credit />
        </section>
      ) : null}

      {meet && species ? (
        <section className="gw-sheet" role="dialog" aria-label={species.name}>
          <div className="gw-row">
            <div>
              <p className={`gw-type ${species.type}`}>{species.type}</p>
              <h2>{species.name}</h2>
            </div>
            <p className="gw-hp">
              {meet.hp}/{meet.max}
            </p>
          </div>
          <div className="gw-bar">
            <span style={{ width: `${(meet.hp / meet.max) * 100}%` }} />
          </div>
          {meet.battle && activeKin ? (
            <p className="gw-note">
              {byId(activeKin.species).name} {activeKin.hp}/{activeKin.max}
            </p>
          ) : null}
          <p className="gw-note">{meet.note}</p>
          {meet.note.includes("stays with you") ? (
            <button type="button" className="btn primary" onClick={() => setMeet(null)}>
              Keep looking
            </button>
          ) : (
            <>
              <div ref={ringRef} className="gw-ring" aria-hidden />
              <div className="gw-actions">
                <button type="button" className="btn ghost" disabled={meet.busy} onClick={() => strike(0, false)}>
                  Shard
                </button>
                {activeKin ? (
                  <button type="button" className="btn ghost" disabled={meet.busy} onClick={() => strike(1, true)}>
                    {byId(activeKin.species).moves[1].name}
                  </button>
                ) : null}
                <button type="button" className="btn primary" disabled={meet.busy || save.prisms < 1} onClick={throwPrism}>
                  Throw prism
                </button>
              </div>
              {save.prisms < 1 ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setSave((s) => ({ ...s, prisms: Math.min(10, s.prisms + 4) }))}
                >
                  Cut four prisms
                </button>
              ) : null}
              <button type="button" className="gw-quiet" onClick={slipAway}>
                Let it go
              </button>
            </>
          )}
        </section>
      ) : null}

      {dex ? (
        <section className="gw-dex" role="dialog" aria-label="Field book">
          <div className="gw-row">
            <h2>Field book</h2>
            <button type="button" className="gw-pill" onClick={() => setDex(false)}>
              Close
            </button>
          </div>
          <p className="gw-note">Glass beats ember. Ember beats thorn. Thorn beats tide. Tide beats glass.</p>
          <ul className="gw-grid">
            {["mote", "kiln", "brine", "thornbuck", "lantern", "cinderwing", "kelp", "vespers"].map((id) => {
              const spec = byId(id);
              const seen = save.seen.includes(id);
              const caught = save.caught.includes(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={seen ? "gw-card" : "gw-card lost"}
                    onClick={() => {
                      const owned = save.roster.find((k) => k.species === id && k.hp > 0);
                      if (owned) setSave((s) => ({ ...s, active: owned.uid }));
                    }}
                  >
                    {seen ? <img src={`/gleam/${id}.png`} alt="" /> : <span className="gw-q">?</span>}
                    <span>{seen ? spec.name : "Unseen"}</span>
                    <em className={spec.type}>{caught ? spec.type : seen ? "seen" : ""}</em>
                  </button>
                </li>
              );
            })}
          </ul>
          <Credit />
        </section>
      ) : null}
    </main>
  );
}
