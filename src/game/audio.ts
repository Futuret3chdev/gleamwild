type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export class Choir {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private nextBell = 0;
  muted = false;

  unlock() {
    const w = window as WebkitWindow;
    const Ctor = window.AudioContext || w.webkitAudioContext;
    if (!Ctor) return;
    if (!this.ctx) {
      this.ctx = new Ctor({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.gain.value = 0.85;
      this.sfx.gain.value = 0.9;
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.2), this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.drone(110, 0.03);
      this.drone(164.81, 0.02);
      this.nextBell = this.ctx.currentTime + 1.2;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.music = null;
    this.sfx = null;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }

  tick() {
    if (!this.ctx || !this.music) return;
    if (this.ctx.currentTime < this.nextBell) return;
    this.nextBell = this.ctx.currentTime + 2.6;
    this.bell(523.25, 0.018);
    this.bell(783.99, 0.012, 0.08);
  }

  shoot() {
    this.tone(640 + Math.random() * 40, 880, 0.05, "sine", 0.018);
  }

  hit() {
    this.tone(520 + Math.random() * 80, 240, 0.09, "triangle", 0.04);
  }

  hurt() {
    this.tone(180, 60, 0.28, "sine", 0.08);
    this.burst(0.12, 0.05);
  }

  dash() {
    this.burst(0.16, 0.05);
    this.tone(420, 180, 0.14, "sine", 0.03);
  }

  nova() {
    this.tone(220, 660, 0.45, "triangle", 0.05);
    this.tone(330, 880, 0.5, "sine", 0.03);
  }

  graze() {
    this.tone(980, 1400, 0.04, "sine", 0.012);
  }

  boom() {
    this.tone(140, 40, 0.5, "sine", 0.07);
    this.bell(392, 0.04);
  }

  private drone(freq: number, gain: number) {
    if (!this.ctx || !this.music) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.value = 480;
    amp.gain.value = gain;
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(this.music);
    osc.start();
  }

  private bell(freq: number, gain: number, delay = 0) {
    if (!this.ctx || !this.music) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    osc.connect(amp);
    amp.connect(this.music);
    osc.start(t);
    osc.stop(t + 1.5);
    osc.onended = () => {
      osc.disconnect();
      amp.disconnect();
    };
  }

  private tone(freq: number, freq2: number, dur: number, type: OscillatorType, gain: number) {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq2), t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      amp.disconnect();
    };
  }

  private burst(dur: number, gain: number) {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.sfx);
    src.start(t);
    src.stop(t + dur);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      amp.disconnect();
    };
  }
}
