import { Choir } from "./audio";

export const W = 540;
export const H = 960;

const SPEED = 318;
const DASH_CD = 1.08;
const STEP = 1 / 60;
const SAVE_KEY = "lumenfall-v1";

export type Phase = "title" | "play" | "pause" | "over";

export type Snap = {
  phase: Phase;
  score: number;
  best: number;
  lives: number;
  nova: number;
  dash: number;
  wave: number;
  combo: number;
  boss: number | null;
  bossMax: number;
  muted: boolean;
  shake: boolean;
  banner: string;
  bannerId: number;
  surpassed: boolean;
};

type Kind = "moth" | "lancer" | "bell" | "boss";

type Enemy = {
  alive: boolean;
  kind: Kind;
  x: number;
  y: number;
  hp: number;
  max: number;
  r: number;
  t: number;
  fire: number;
  state: number;
  vx: number;
  vy: number;
  ox: number;
  phase: number;
  flash: number;
  spin: number;
  lx: number;
  ly: number;
  volley: number;
};

type Bullet = {
  alive: boolean;
  friendly: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  grazed: boolean;
};

type Particle = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  mote: boolean;
};

type Ghost = { x: number; y: number; a: number };

type Spawn = { at: number; kind: Kind; x?: number };

type Save = { best: number; muted: boolean; shake: boolean };

const emptyEnemy = (): Enemy => ({
  alive: false,
  kind: "moth",
  x: 0,
  y: 0,
  hp: 1,
  max: 1,
  r: 20,
  t: 0,
  fire: 1,
  state: 0,
  vx: 0,
  vy: 0,
  ox: 0,
  phase: 0,
  flash: 0,
  spin: 0,
  lx: 0,
  ly: 0,
  volley: 0,
});

const emptyBullet = (): Bullet => ({
  alive: false,
  friendly: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  r: 6,
  life: 0,
  grazed: false,
});

const emptyParticle = (): Particle => ({
  alive: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  max: 1,
  size: 2,
  color: "#efece6",
  mote: false,
});

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function scriptFor(wave: number, tier: number): { name: string; events: Spawn[]; boss: boolean } {
  const cycle = ((wave - 1) % 5) + 1;
  const names = ["Glass moths", "Needles", "Clerestory", "Crossfire", "The Choir"];
  const extra = Math.min(3, tier);
  const events: Spawn[] = [];
  if (cycle === 1) {
    for (let i = 0; i < 5 + extra; i++) events.push({ at: 0.35 + i * 0.62, kind: "moth" });
  } else if (cycle === 2) {
    for (let i = 0; i < 3 + extra; i++) {
      events.push({ at: 0.3 + i * 0.95, kind: "lancer", x: 90 + (i % 4) * 110 });
      if (i % 2 === 0) events.push({ at: 0.55 + i * 0.95, kind: "moth" });
    }
  } else if (cycle === 3) {
    events.push({ at: 0.25, kind: "bell", x: 150 });
    events.push({ at: 0.4, kind: "bell", x: 390 });
    for (let i = 0; i < 4 + extra; i++) events.push({ at: 1.1 + i * 0.7, kind: "moth" });
  } else if (cycle === 4) {
    for (let i = 0; i < 5 + extra; i++) {
      events.push({ at: 0.25 + i * 0.5, kind: i % 2 === 0 ? "lancer" : "moth" });
    }
    events.push({ at: 1.4, kind: "bell", x: 270 });
  } else {
    return { name: names[4] ?? "The Choir", events: [], boss: true };
  }
  return { name: names[cycle - 1] ?? "Wave", events, boss: false };
}

function loadFrames(folder: string) {
  return [1, 2, 3, 4].map((i) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/sprites/${folder}/hover-${i}.png`;
    return img;
  });
}

export function formatScore(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export class Game {
  phase: Phase = "title";
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onSnap: (snap: Snap) => void;
  private audio = new Choir();
  private keys = new Set<string>();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private scroll = 0;
  private reduce: boolean;
  private bg = new Image();
  private frames: Record<Kind | "player", HTMLImageElement[]>;

  private px = W / 2;
  private py = H * 0.72;
  private speed = 0;
  private lives = 3;
  private score = 0;
  private best = 0;
  private bestAtStart = 0;
  private nova = 0;
  private combo = 0;
  private comboT = 0;
  private wave = 1;
  private tier = 0;
  private invuln = 0;
  private fireCd = 0;
  private dashCd = 0;
  private dashT = 0;
  private dashVX = 0;
  private dashVY = 0;
  private lastX = 0;
  private lastY = -1;
  private dashHeld = false;
  private novaHeld = false;
  private dashQueued = false;
  private novaQueued = false;
  private pointerOn = false;
  private desireX = W / 2;
  private desireY = H * 0.72;
  private pointerId = -1;

  private rest = 0;
  private script: Spawn[] = [];
  private scriptI = 0;
  private scriptT = 0;
  private bossWave = false;
  private bossSpawned = false;
  private banner = "";
  private bannerT = 0;
  private bannerId = 0;

  private trauma = 0;
  private flash = 0;
  private novaRing = 0;
  shakeOn: boolean;
  private muted = false;
  private hudT = 0;
  private dirty = true;
  private shotN = 0;

  private enemies: Enemy[] = Array.from({ length: 18 }, emptyEnemy);
  private bullets: Bullet[] = Array.from({ length: 260 }, emptyBullet);
  private particles: Particle[] = Array.from({ length: 280 }, emptyParticle);
  private ghosts: Ghost[] = [];
  private bCursor = 0;
  private pCursor = 0;

  constructor(canvas: HTMLCanvasElement, onSnap: (snap: Snap) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    this.ctx = ctx;
    this.onSnap = onSnap;
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const save = readSave();
    this.best = save.best;
    this.bestAtStart = save.best;
    this.muted = save.muted;
    this.shakeOn = save.present ? save.shake : !this.reduce;
    this.audio.muted = this.muted;
    this.bg.crossOrigin = "anonymous";
    this.bg.src = "/art/nave.jpg";
    this.frames = {
      player: loadFrames("player"),
      moth: loadFrames("moth"),
      lancer: loadFrames("lancer"),
      bell: loadFrames("bell"),
      boss: loadFrames("boss"),
    };
    this.bind();
    this.publishProbe();
    this.emit();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.audio.dispose();
    if (window.__controlsTest) delete window.__controlsTest;
  }

  unlock() {
    this.audio.unlock();
    this.audio.setMuted(this.muted);
  }

  audioResume() {
    this.audio.resume();
  }

  begin() {
    this.unlock();
    this.phase = "play";
    this.score = 0;
    this.lives = 3;
    this.nova = 0;
    this.combo = 0;
    this.comboT = 0;
    this.wave = 1;
    this.tier = 0;
    this.px = W / 2;
    this.py = H * 0.74;
    this.invuln = 1.1;
    this.fireCd = 0.2;
    this.dashCd = 0;
    this.dashT = 0;
    this.rest = 0.85;
    this.script = [];
    this.scriptI = 0;
    this.scriptT = 0;
    this.bossWave = false;
    this.bossSpawned = false;
    this.banner = "Weave";
    this.bannerT = 1.5;
    this.bannerId++;
    this.trauma = 0;
    this.flash = 0;
    this.novaRing = 0;
    this.bestAtStart = this.best;
    this.dashHeld = true;
    this.ghosts = [];
    for (const e of this.enemies) e.alive = false;
    for (const b of this.bullets) b.alive = false;
    this.dirty = true;
    this.emit();
  }

  pause() {
    if (this.phase !== "play") return;
    this.phase = "pause";
    this.pointerOn = false;
    this.dirty = true;
    this.emit();
  }

  resume() {
    if (this.phase !== "pause") return;
    this.phase = "play";
    this.dirty = true;
    this.emit();
  }

  endRun() {
    if (this.phase === "title") return;
    this.finish();
  }

  toTitle() {
    this.phase = "title";
    this.pointerOn = false;
    this.banner = "";
    this.dirty = true;
    this.emit();
  }

  requestDash() {
    this.dashQueued = true;
  }

  requestNova() {
    this.novaQueued = true;
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this.persist();
    this.dirty = true;
    this.emit();
  }

  toggleShake() {
    this.shakeOn = !this.shakeOn;
    this.persist();
    this.dirty = true;
    this.emit();
  }

  private bind() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA") return;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    this.keys.add(e.code);
    if (e.code === "Escape" || e.code === "KeyP") {
      if (this.phase === "play") this.pause();
      else if (this.phase === "pause") this.resume();
    }
    if ((e.code === "Enter" || e.code === "Space") && this.phase === "title") this.begin();
    if (e.code === "Enter" && this.phase === "over") this.begin();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.pointerOn = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.phase !== "play") return;
    if (this.pointerId !== -1) return;
    this.pointerId = e.pointerId;
    this.pointerOn = true;
    this.placeDesire(e);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerOn || e.pointerId !== this.pointerId) return;
    this.placeDesire(e);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerOn = false;
    this.pointerId = -1;
  };

  private placeDesire(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const rawY = ((e.clientY - r.top) / r.height) * H;
    const offset = rawY > H - 140 ? 28 : 86;
    this.desireX = x;
    this.desireY = rawY - offset;
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < 5) {
      this.step(STEP);
      this.acc -= STEP;
      n++;
    }
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private step(dt: number) {
    this.time += dt;
    this.audio.tick();
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    this.flash = Math.max(0, this.flash - dt);
    if (this.novaRing > 0) this.novaRing = Math.max(0, this.novaRing - dt);
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) {
        this.banner = "";
        this.dirty = true;
      }
    }
    for (const g of this.ghosts) g.a -= dt * 2.4;
    this.ghosts = this.ghosts.filter((g) => g.a > 0);

    if (this.phase !== "play") {
      this.scroll += dt * (this.phase === "pause" ? 8 : 16);
      this.tickParticles(dt);
      this.spawnMotes();
      this.publishProbe();
      this.emitMaybe(dt);
      return;
    }

    if (this.freezeGuard(dt)) {
      this.publishProbe();
      this.emitMaybe(dt);
      return;
    }

    this.scroll += dt * 26;
    this.director(dt);
    this.player(dt);
    this.tickBullets(dt);
    this.tickEnemies(dt);
    this.collide();
    this.tickParticles(dt);
    this.spawnMotes();
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0 && this.combo !== 0) {
        this.combo = 0;
        this.dirty = true;
      }
    }
    this.publishProbe();
    this.emitMaybe(dt);
  }

  private freezeLeft = 0;

  private freezeGuard(dt: number) {
    if (this.freezeLeft <= 0) return false;
    this.freezeLeft -= dt;
    return true;
  }

  private director(dt: number) {
    if (this.rest > 0) {
      this.rest -= dt;
      if (this.rest <= 0) this.beginWave();
      return;
    }
    if (this.bossWave) {
      const boss = this.enemies.find((e) => e.alive && e.kind === "boss");
      if (!boss && !this.bossSpawned) {
        this.spawnEnemy("boss", W / 2);
        this.bossSpawned = true;
        this.dirty = true;
      } else if (!boss && this.bossSpawned && !this.anyEnemy()) {
        this.tier += 1;
        this.wave += 1;
        this.bossSpawned = false;
        this.rest = 2.1;
        this.dirty = true;
      }
      return;
    }
    this.scriptT += dt;
    while (this.scriptI < this.script.length && (this.script[this.scriptI]?.at ?? 99) <= this.scriptT) {
      const s = this.script[this.scriptI];
      this.scriptI++;
      if (s) this.spawnEnemy(s.kind, s.x);
    }
    if (this.scriptI >= this.script.length && !this.anyEnemy()) {
      this.wave += 1;
      this.rest = 1.3;
      this.dirty = true;
    }
  }

  private beginWave() {
    const info = scriptFor(this.wave, this.tier);
    this.script = info.events;
    this.scriptI = 0;
    this.scriptT = 0;
    this.bossWave = info.boss;
    this.bossSpawned = false;
    const prefix = this.tier > 0 ? "Ascent  ·  " : "";
    this.banner = info.boss ? "The Choir" : `${prefix}Wave ${this.wave}  ·  ${info.name}`;
    this.bannerT = 1.7;
    this.bannerId++;
    this.dirty = true;
  }

  private player(dt: number) {
    const prevX = this.px;
    const prevY = this.py;
    this.invuln = Math.max(0, this.invuln - dt);
    let ix = 0;
    let iy = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ix -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ix += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) iy -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) iy += 1;
    const dashDown =
      this.keys.has("Space") ||
      this.keys.has("ShiftLeft") ||
      this.keys.has("ShiftRight") ||
      this.keys.has("KeyK");
    const novaDown = this.keys.has("KeyF") || this.keys.has("KeyJ");
    if ((dashDown && !this.dashHeld) || this.dashQueued) this.tryDash(ix, iy);
    if ((novaDown && !this.novaHeld) || this.novaQueued) this.tryNova();
    this.dashHeld = dashDown;
    this.novaHeld = novaDown;
    this.dashQueued = false;
    this.novaQueued = false;

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.px += this.dashVX * dt;
      this.py += this.dashVY * dt;
      if (this.ghosts.length < 8) this.ghosts.push({ x: this.px, y: this.py, a: 0.4 });
    } else if (ix !== 0 || iy !== 0) {
      const len = Math.hypot(ix, iy) || 1;
      this.lastX = ix / len;
      this.lastY = iy / len;
      this.px += this.lastX * SPEED * dt;
      this.py += this.lastY * SPEED * dt;
      this.pointerOn = false;
    } else if (this.pointerOn) {
      const dx = this.desireX - this.px;
      const dy = this.desireY - this.py;
      const dist = Math.hypot(dx, dy);
      if (dist > 3) {
        const step = Math.min(dist, SPEED * 1.2 * dt);
        this.lastX = dx / dist;
        this.lastY = dy / dist;
        this.px += this.lastX * step;
        this.py += this.lastY * step;
      }
    }
    if (this.dashCd > 0) this.dashCd = Math.max(0, this.dashCd - dt);
    this.px = clamp(this.px, 30, W - 30);
    this.py = clamp(this.py, 48, H - 36);
    this.speed = Math.hypot(this.px - prevX, this.py - prevY) / dt;

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = 0.16;
      this.shotN++;
      const spread = this.shotN % 4 === 0 ? 0.08 : 0;
      this.shot(this.px - 10, this.py - 28, -Math.PI / 2 - spread, 760, true, 4.5);
      this.shot(this.px + 10, this.py - 28, -Math.PI / 2 + spread, 760, true, 4.5);
      if (this.shotN % 2 === 0) this.audio.shoot();
    }
  }

  private tryDash(ix: number, iy: number) {
    if (this.dashCd > 0 || this.dashT > 0 || this.phase !== "play") return;
    let x = ix;
    let y = iy;
    if (x === 0 && y === 0) {
      x = this.lastX;
      y = this.lastY;
    }
    const len = Math.hypot(x, y) || 1;
    this.dashVX = (x / len) * 1080;
    this.dashVY = (y / len) * 1080;
    this.dashT = 0.14;
    this.dashCd = DASH_CD;
    this.invuln = Math.max(this.invuln, 0.26);
    this.audio.dash();
    this.dirty = true;
  }

  private tryNova() {
    if (this.nova < 1 || this.phase !== "play") return;
    this.nova = 0;
    this.novaRing = 0.42;
    this.freezeLeft = 0.045;
    this.trauma = Math.min(1, this.trauma + 0.62);
    this.flash = 0.16;
    this.audio.nova();
    let cleared = 0;
    for (const b of this.bullets) {
      if (!b.alive || b.friendly) continue;
      b.alive = false;
      cleared++;
      if (cleared <= 28) this.score += 15;
      this.burst(b.x, b.y, 3, "#efece6");
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.damage(e, e.kind === "boss" ? 22 : 16);
    }
    this.dirty = true;
  }

  private tickBullets(dt: number) {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) b.alive = false;
    }
  }

  private tickEnemies(dt: number) {
    const speedMul = 1 + Math.min(0.4, this.tier * 0.07);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.kind === "moth") {
        e.y += (78 + this.tier * 8) * dt;
        e.x = e.ox + Math.sin(e.t * 1.7 + e.phase) * 64;
        e.fire -= dt;
        if (e.fire <= 0 && e.y > 30 && e.y < H * 0.78) {
          e.fire = 2.05;
          const ang = this.aim(e.x, e.y, this.px, this.py) + (Math.random() - 0.5) * 0.35;
          this.shot(e.x, e.y + 10, ang, 148 * speedMul, false, 6);
        }
        if (e.y > H + 50) e.alive = false;
      } else if (e.kind === "lancer") {
        if (e.state === 0) {
          e.y += 150 * dt;
          if (e.y >= 120) {
            e.state = 1;
            e.fire = 0.62;
            e.lx = this.px;
            e.ly = this.py;
          }
        } else if (e.state === 1) {
          e.fire -= dt;
          if (e.fire <= 0) {
            e.state = 2;
            const ang = this.aim(e.x, e.y, e.lx, e.ly);
            const sp = 500 * speedMul;
            e.vx = Math.cos(ang) * sp;
            e.vy = Math.sin(ang) * sp;
          }
        } else {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (e.x < -80 || e.x > W + 80 || e.y < -80 || e.y > H + 80) e.alive = false;
        }
      } else if (e.kind === "bell") {
        e.x += e.vx * dt;
        e.y = e.ox + Math.sin(e.t * 1.2) * 16;
        if (e.x < 70 || e.x > W - 70) e.vx *= -1;
        e.fire -= dt;
        if (e.fire <= 0) {
          e.fire = 1.85;
          const ang = this.aim(e.x, e.y, this.px, this.py);
          for (const off of [-0.32, 0, 0.32]) {
            this.shot(e.x, e.y + 16, ang + off, 168 * speedMul, false, 6);
          }
        }
      } else if (e.kind === "boss") {
        if (e.y < 196) e.y += 80 * dt;
        e.x = W / 2 + Math.sin(e.t * 0.55) * (e.phase === 3 ? 170 : 120);
        const ratio = e.hp / e.max;
        const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
        if (phase !== e.phase && e.phase !== 0) {
          e.phase = phase;
          this.freezeLeft = 0.05;
          this.trauma = Math.min(1, this.trauma + 0.35);
          this.burst(e.x, e.y, 20, "#efece6");
          this.banner = phase === 2 ? "The choir shifts" : "Last light";
          this.bannerT = 1.3;
          this.bannerId++;
          this.dirty = true;
        } else if (e.phase === 0 && e.y >= 196) {
          e.phase = 1;
        }
        if (e.y >= 180) {
          e.fire -= dt;
          if (e.fire <= 0) {
            e.volley++;
            if (e.phase <= 1) {
              e.fire = 1.22;
              e.spin += 0.28;
              for (let i = 0; i < 12; i++) {
                const ang = e.spin + (i / 12) * Math.PI * 2;
                this.shot(e.x, e.y, ang, 128 * speedMul, false, 6.5);
              }
            } else if (e.phase === 2) {
              e.fire = 0.95;
              const ang = this.aim(e.x, e.y, this.px, this.py);
              for (let i = -3; i <= 3; i++) {
                this.shot(e.x, e.y + 20, ang + i * 0.16, 196 * speedMul, false, 6);
              }
              if (e.volley % 2 === 0) {
                e.spin += 0.4;
                for (let i = 0; i < 14; i++) {
                  const a = e.spin + (i / 14) * Math.PI * 2;
                  this.shot(e.x, e.y, a, 112 * speedMul, false, 5.5);
                }
              }
            } else {
              e.fire = 0.48;
              e.spin += 0.42;
              for (const arm of [0, Math.PI]) {
                this.shot(e.x, e.y, e.spin + arm, 168 * speedMul, false, 6.5);
                this.shot(e.x, e.y, e.spin + arm + 0.18, 150 * speedMul, false, 6);
              }
            }
          }
        }
      }
    }
  }

  private collide() {
    for (const b of this.bullets) {
      if (!b.alive || !b.friendly) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const rr = b.r + e.r;
        if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 <= rr * rr) {
          b.alive = false;
          this.damage(e, 1);
          break;
        }
      }
    }
    if (this.invuln > 0) return;
    const pr = 11;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const rr = pr + e.r * 0.72;
      if ((this.px - e.x) ** 2 + (this.py - e.y) ** 2 <= rr * rr) {
        this.hurt();
        return;
      }
    }
    for (const b of this.bullets) {
      if (!b.alive || b.friendly) continue;
      const d = Math.hypot(b.x - this.px, b.y - this.py);
      if (d <= pr + b.r) {
        this.hurt();
        return;
      }
      if (!b.grazed && d < 36) {
        b.grazed = true;
        this.nova = Math.min(1, this.nova + 0.045);
        this.score += 12;
        if (Math.random() < 0.3) this.audio.graze();
        this.dirty = true;
      }
    }
  }

  private damage(e: Enemy, amount: number) {
    if (!e.alive) return;
    e.hp -= amount;
    e.flash = 0.08;
    this.trauma = Math.min(1, this.trauma + (e.kind === "boss" ? 0.05 : 0.1));
    if (e.hp > 0) {
      this.audio.hit();
      this.burst(e.x, e.y, 4, "#d5f4ef");
      return;
    }
    e.alive = false;
    this.combo += 1;
    this.comboT = 2.15;
    const base = e.kind === "moth" ? 120 : e.kind === "lancer" ? 200 : e.kind === "bell" ? 320 : 2500;
    const mult = Math.min(4, 1 + (this.combo - 1) * 0.25);
    const gained = Math.round(base * mult);
    this.score += gained;
    this.nova = Math.min(1, this.nova + (e.kind === "boss" ? 0.35 : 0.07));
    this.burst(e.x, e.y, e.kind === "boss" ? 36 : 12, e.kind === "boss" ? "#efece6" : "#9fd9d0");
    if (e.kind === "boss") {
      this.freezeLeft = 0.12;
      this.trauma = 0.85;
      this.flash = 0.28;
      this.audio.boom();
      for (const b of this.bullets) if (!b.friendly) b.alive = false;
    } else {
      this.audio.hit();
    }
    if (this.score > this.best) {
      this.best = this.score;
      this.persist();
    }
    this.dirty = true;
  }

  private hurt() {
    if (this.invuln > 0 || this.phase !== "play") return;
    this.lives -= 1;
    this.invuln = 1.35;
    this.freezeLeft = 0.07;
    this.trauma = Math.min(1, this.trauma + 0.58);
    this.flash = this.reduce ? 0.08 : 0.24;
    this.combo = 0;
    this.audio.hurt();
    this.burst(this.px, this.py, 18, "#efece6");
    let n = 0;
    for (const b of this.bullets) {
      if (!b.alive || b.friendly) continue;
      if ((b.x - this.px) ** 2 + (b.y - this.py) ** 2 < 170 * 170) {
        b.alive = false;
        n++;
      }
    }
    void n;
    this.dirty = true;
    if (this.lives <= 0) this.finish();
  }

  private finish() {
    if (this.phase === "over") return;
    this.phase = "over";
    this.pointerOn = false;
    if (this.score > this.best) this.best = this.score;
    this.persist();
    this.audio.boom();
    this.dirty = true;
    this.emit();
  }

  private shot(x: number, y: number, ang: number, speed: number, friendly: boolean, r: number) {
    const b = this.bullets[this.bCursor]!;
    this.bCursor = (this.bCursor + 1) % this.bullets.length;
    if (b.alive) {
      const spare = this.bullets.find((item) => !item.alive);
      if (!spare) return;
      return this.fillBullet(spare, x, y, ang, speed, friendly, r);
    }
    this.fillBullet(b, x, y, ang, speed, friendly, r);
  }

  private fillBullet(b: Bullet, x: number, y: number, ang: number, speed: number, friendly: boolean, r: number) {
    b.alive = true;
    b.friendly = friendly;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    b.r = r;
    b.life = 5;
    b.grazed = false;
  }

  private aim(x: number, y: number, tx: number, ty: number) {
    return Math.atan2(ty - y, tx - x);
  }

  private spawnEnemy(kind: Kind, x?: number) {
    const e = this.enemies.find((item) => !item.alive);
    if (!e) return;
    const tierHp = 1 + this.tier * 0.35;
    e.alive = true;
    e.kind = kind;
    e.t = 0;
    e.flash = 0;
    e.spin = Math.random() * 0.4;
    e.volley = 0;
    e.phase = Math.random() * Math.PI * 2;
    e.state = 0;
    e.lx = this.px;
    e.ly = this.py;
    if (kind === "moth") {
      e.ox = x ?? 80 + Math.random() * (W - 160);
      e.x = e.ox;
      e.y = -30;
      e.hp = Math.round(5 * tierHp);
      e.r = 26;
      e.fire = 1.25;
      e.vx = 0;
      e.vy = 0;
    } else if (kind === "lancer") {
      e.x = clamp(x ?? 80 + Math.random() * (W - 160), 60, W - 60);
      e.y = -40;
      e.ox = e.x;
      e.hp = Math.round(6 * tierHp);
      e.r = 18;
      e.fire = 0;
      e.vx = 0;
      e.vy = 0;
    } else if (kind === "bell") {
      e.x = x ?? W / 2;
      e.ox = 150 + (x && x > W / 2 ? 28 : 0);
      e.y = e.ox;
      e.hp = Math.round(16 * tierHp);
      e.r = 28;
      e.fire = 1.2;
      e.vx = x && x > W / 2 ? -42 : 42;
      e.vy = 0;
    } else {
      e.x = W / 2;
      e.y = -80;
      e.ox = 196;
      e.hp = Math.round(280 * (1 + this.tier * 0.4));
      e.r = 58;
      e.fire = 0.9;
      e.phase = 0;
      e.vx = 0;
      e.vy = 0;
    }
    e.max = e.hp;
  }

  private anyEnemy() {
    return this.enemies.some((e) => e.alive);
  }

  private burst(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      const p = this.takeParticle();
      if (!p) return;
      const ang = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 140;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp;
      p.life = 0.35 + Math.random() * 0.35;
      p.max = p.life;
      p.size = 1.5 + Math.random() * 2.4;
      p.color = color;
      p.mote = false;
    }
  }

  private spawnMotes() {
    let motes = 0;
    for (const p of this.particles) if (p.alive && p.mote) motes++;
    if (motes > 36) return;
    if (Math.random() > 0.35) return;
    const p = this.takeParticle();
    if (!p) return;
    p.alive = true;
    p.mote = true;
    p.x = Math.random() * W;
    p.y = H + 8;
    p.vx = (Math.random() - 0.5) * 12;
    p.vy = -18 - Math.random() * 28;
    p.life = 6;
    p.max = 6;
    p.size = 1.2 + Math.random() * 1.6;
    p.color = Math.random() > 0.5 ? "#efece6" : "#9fd9d0";
  }

  private takeParticle() {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[this.pCursor]!;
      this.pCursor = (this.pCursor + 1) % this.particles.length;
      if (!p.alive) return p;
    }
    return null;
  }

  private tickParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (!p.mote) p.vy += 20 * dt;
      if (p.life <= 0 || p.y < -20) p.alive = false;
    }
  }

  private emitMaybe(dt: number) {
    this.hudT += dt;
    if (this.hudT >= 0.1 || this.dirty) {
      this.hudT = 0;
      this.dirty = false;
      this.emit();
    }
  }

  private emit() {
    const boss = this.enemies.find((e) => e.alive && e.kind === "boss");
    const snap: Snap = {
      phase: this.phase,
      score: this.score,
      best: this.best,
      lives: this.lives,
      nova: this.nova,
      dash: this.dashCd <= 0 ? 1 : 1 - this.dashCd / DASH_CD,
      wave: this.wave,
      combo: this.combo,
      boss: boss ? boss.hp : null,
      bossMax: boss ? boss.max : 1,
      muted: this.muted,
      shake: this.shakeOn,
      banner: this.banner,
      bannerId: this.bannerId,
      surpassed: this.bestAtStart > 0 && this.score > this.bestAtStart,
    };
    this.onSnap(snap);
  }

  private persist() {
    const data: Save = { best: this.best, muted: this.muted, shake: this.shakeOn };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* ignore quota */
    }
  }

  private publishProbe() {
    window.__controlsTest = {
      getX: () => this.px,
      getY: () => this.py,
      getYaw: () => 0,
      getSpeed: () => this.speed,
      setKeys: (codes: string[]) => {
        this.keys = new Set(codes);
      },
    };
  }

  private draw() {
    const ctx = this.ctx;
    const s = this.canvas.width / W || 1;
    const mag = this.shakeOn ? this.trauma * this.trauma * 13 : 0;
    const ox = Math.sin(this.time * 47) * mag;
    const oy = Math.cos(this.time * 39) * mag * 0.8;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, ox * s, oy * s);
    this.drawWorld(ctx);
  }

  private drawWorld(ctx: CanvasRenderingContext2D) {
    if (this.bg.complete && this.bg.naturalWidth) {
      const scale = Math.max(W / this.bg.naturalWidth, (H * 1.08) / this.bg.naturalHeight);
      const dw = this.bg.naturalWidth * scale;
      const dh = this.bg.naturalHeight * scale;
      const x = (W - dw) / 2;
      const off = this.scroll % dh;
      ctx.drawImage(this.bg, x, off - dh, dw, dh);
      ctx.drawImage(this.bg, x, off, dw, dh);
    } else {
      ctx.fillStyle = "#0c0d10";
      ctx.fillRect(0, 0, W, H);
    }
    const veil = ctx.createLinearGradient(0, 0, 0, H);
    veil.addColorStop(0, "rgba(12,13,16,0.18)");
    veil.addColorStop(0.4, "rgba(12,13,16,0.28)");
    veil.addColorStop(1, "rgba(12,13,16,0.55)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(180, 210, 206, 0.05)";
    for (let i = 0; i < 3; i++) {
      const x = 80 + i * 160 + Math.sin(this.time * 0.2 + i) * 20;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 70, 0);
      ctx.lineTo(x + 20, H);
      ctx.lineTo(x - 40, H);
      ctx.fill();
    }
    ctx.restore();

    this.drawParticles(ctx, true);

    for (const b of this.bullets) {
      if (!b.alive || b.friendly) continue;
      this.diamond(ctx, b.x, b.y, b.r + 1.5, "rgba(12,13,16,0.85)");
      this.diamond(ctx, b.x, b.y, b.r, "#f4efe6");
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.kind === "lancer" && e.state === 1) {
        ctx.save();
        ctx.strokeStyle = "rgba(239,236,230,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.lx, e.ly);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(e.lx, e.ly, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      const size = e.kind === "boss" ? 300 : e.kind === "lancer" ? 150 : e.kind === "moth" ? 118 : 108;
      const fps = e.kind === "boss" ? 5 : e.kind === "moth" ? 9 : 7;
      this.sprite(ctx, this.frames[e.kind], e.x, e.y, size, e.t, fps, e.flash);
    }

    for (const b of this.bullets) {
      if (!b.alive || !b.friendly) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = "rgba(12,13,16,0.8)";
      ctx.fillRect(-3.2, -12, 6.4, 22);
      ctx.fillStyle = "#dff6f2";
      ctx.fillRect(-2, -10, 4, 18);
      ctx.restore();
    }

    const showPlayer = this.phase !== "over";
    if (showPlayer) {
      const x = this.phase === "title" ? W / 2 : this.px;
      const y = this.phase === "title" ? H * 0.4 + Math.sin(this.time * 1.6) * 8 : this.py;
      for (const g of this.ghosts) {
        ctx.save();
        ctx.globalAlpha = g.a;
        this.sprite(ctx, this.frames.player, g.x, g.y, 124, this.time, 8, 0);
        ctx.restore();
      }
      const blink = this.invuln > 0 && Math.sin(this.time * 28) > 0;
      if (!blink) {
        ctx.save();
        const lean = clamp((this.phase === "play" ? this.lastX : 0) * 0.12, -0.18, 0.18);
        ctx.translate(x, y);
        ctx.rotate(lean);
        ctx.translate(-x, -y);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#b7ddd6";
        ctx.beginPath();
        ctx.ellipse(x, y + 8, 28, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        this.sprite(ctx, this.frames.player, x, y, 128, this.time, 8, 0);
        ctx.restore();
      }
    }

    this.drawParticles(ctx, false);

    if (this.novaRing > 0) {
      const k = 1 - this.novaRing / 0.42;
      ctx.save();
      ctx.strokeStyle = `rgba(239,236,230,${(1 - k) * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.px, this.py, 24 + k * 460, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(239,236,230,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, motes: boolean) {
    for (const p of this.particles) {
      if (!p.alive || p.mote !== motes) continue;
      const a = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private sprite(
    ctx: CanvasRenderingContext2D,
    frames: HTMLImageElement[],
    x: number,
    y: number,
    size: number,
    t: number,
    fps: number,
    flash: number,
  ) {
    const img = frames[Math.floor(t * fps) % frames.length];
    if (!img || !img.complete || !img.naturalWidth) return;
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    if (flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.45;
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      ctx.restore();
    }
  }

  private diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
}

function readSave(): Save & { present: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { best: 0, muted: false, shake: true, present: false };
    const parsed = JSON.parse(raw) as Partial<Save>;
    return {
      best: typeof parsed.best === "number" ? parsed.best : 0,
      muted: Boolean(parsed.muted),
      shake: parsed.shake !== false,
      present: true,
    };
  } catch {
    return { best: 0, muted: false, shake: true, present: false };
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getX: () => number;
      getY: () => number;
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
    };
  }
}
