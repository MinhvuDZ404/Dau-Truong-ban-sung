// Simple WebAudio synth engine — no external audio files needed.
export class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;

  ensure() {
    if (!this.ctx) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.25;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol = 0.4, slideTo?: number) {
    if (this.muted) return;
    const ctx = this.ensure();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(dur: number, vol = 0.4, filterFreq = 1000) {
    if (this.muted) return;
    const ctx = this.ensure();
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master!);
    src.start();
  }

  shoot() { this.tone(880, 0.08, 'square', 0.12, 220); }
  laser() { this.tone(1400, 0.12, 'sawtooth', 0.1, 400); }
  hit() { this.noise(0.08, 0.2, 2500); }
  explode() { this.noise(0.45, 0.5, 700); this.tone(120, 0.4, 'sawtooth', 0.2, 40); }
  bigExplode() { this.noise(1.0, 0.7, 500); this.tone(70, 0.9, 'sawtooth', 0.3, 25); }
  pickup() { this.tone(660, 0.1, 'sine', 0.2, 1320); }
  levelUp() { [440, 660, 880, 1320].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.2), i * 90)); }
  gameOver() { [440, 330, 247, 165].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, 'triangle', 0.25), i * 200)); }
}

export const sfx = new Sfx();
