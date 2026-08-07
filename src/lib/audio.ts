// Tiny WebAudio synth — no asset files, everything procedural.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.2, slideTo = 0, delay = 0) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol = 0.15, hp = 800, delay = 0) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  unlock() { ac(); },
  setMuted(m: boolean) { muted = m; },
  click() { tone(520, 0.06, "triangle", 0.12, 340); },
  hover() { tone(760, 0.04, "sine", 0.05); },
  collect() { tone(620, 0.08, "triangle", 0.16, 880); tone(930, 0.1, "triangle", 0.14, 1240, 0.05); },
  coin() { tone(1180, 0.07, "square", 0.07, 1560); tone(1560, 0.09, "square", 0.06, 2100, 0.045); },
  hit() { noise(0.12, 0.2, 300); tone(160, 0.12, "sawtooth", 0.14, 70); },
  crit() { noise(0.18, 0.28, 200); tone(120, 0.2, "sawtooth", 0.2, 50); tone(880, 0.14, "square", 0.08, 220, 0.02); },
  slash() { noise(0.09, 0.16, 1800); },
  heal() { tone(520, 0.16, "sine", 0.12, 780); tone(780, 0.2, "sine", 0.1, 1040, 0.08); },
  hurt() { tone(220, 0.15, "sawtooth", 0.12, 110); },
  build() { noise(0.06, 0.2, 900); tone(240, 0.08, "square", 0.1, 180, 0.02); noise(0.06, 0.18, 700, 0.12); },
  levelup() { [440, 550, 660, 880].forEach((f, i) => tone(f, 0.14, "triangle", 0.14, 0, i * 0.08)); },
  quest() { [660, 830, 990].forEach((f, i) => tone(f, 0.16, "triangle", 0.13, 0, i * 0.09)); },
  victory() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, "triangle", 0.13, 0, i * 0.11)); },
  defeat() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.1, 0, i * 0.16)); },
  summon(r: number) {
    tone(200, 0.5, "sine", 0.12, 900);
    noise(0.4, 0.08, 400);
    const base = r >= 3 ? 660 : r >= 2 ? 550 : 440;
    [base, base * 1.25, base * 1.5].forEach((f, i) => tone(f, 0.2, "triangle", 0.14, 0, 0.45 + i * 0.09));
  },
  whoosh() { noise(0.2, 0.1, 500); },
  error() { tone(180, 0.14, "square", 0.1, 120); },
  mail() { tone(880, 0.08, "triangle", 0.12, 660); tone(660, 0.1, "triangle", 0.1, 880, 0.08); },
};
