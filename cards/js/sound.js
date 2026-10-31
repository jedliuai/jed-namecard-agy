// Sound: per-style background music (looped with a crossfade so the seam is inaudible) and small
// synthesized effects for the morphs. Nothing plays until the first tap (browser autoplay rules).
const KEY = "nc-muted";
let ac = null, master, musicBus, sfxBus, noise;
let muted = false;
try { muted = localStorage.getItem(KEY) === "1"; } catch {}
let wantStyle = null, current = null;
const cache = new Map();
const listeners = new Set();

function init() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ac.destination);
  musicBus = ac.createGain();
  musicBus.gain.value = 0.42;
  musicBus.connect(master);
  sfxBus = ac.createGain();
  sfxBus.gain.value = 0.7;
  sfxBus.connect(master);
  const len = ac.sampleRate;
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  return ac;
}

export function unlock() {
  if (!init()) return;
  if (ac.state === "suspended") ac.resume();
  if (wantStyle && (!current || current.style !== wantStyle)) startMusic(wantStyle);
}
export const isMuted = () => muted;
export const ready = () => !!ac && ac.state === "running";
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {}
  if (ac) master.gain.setTargetAtTime(v ? 0 : 1, ac.currentTime, 0.12);
  if (!v) unlock();
  listeners.forEach((f) => f(v));
}

/* ---------- music ---------- */
// The small compressed files are kept for every style; decoded audio is ~15 MB per track, so only
// the few most recent tracks stay decoded (phones run out of memory otherwise).
const bytes = new Map();
const DECODED_MAX = 2;
// Opus (webm) is the smallest for the same quality; Safari gets AAC (m4a), which it always decodes.
// If one format fails to load or decode, the other is tried.
let formats = null;
function order() {
  if (!formats) {
    const ios = document.documentElement.classList.contains("webkit");
    const opus = !ios && document.createElement("audio").canPlayType('audio/webm; codecs="opus"');
    formats = opus ? ["webm", "m4a"] : ["m4a", "webm"];
  }
  return formats;
}
function fetchBytes(style, ext = order()[0]) {
  const key = style + "." + ext;
  if (!bytes.has(key)) {
    const p = fetch(new URL(`../audio/${key}`, import.meta.url)).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))));
    p.catch(() => bytes.delete(key));
    bytes.set(key, p);
  }
  return bytes.get(key);
}
const decode = (b) => new Promise((res, rej) => ac.decodeAudioData(b.slice(0), res, rej));
async function fetchDecode(style) {
  for (const ext of order()) {
    try { return seamless(await decode(await fetchBytes(style, ext))); } catch {}
  }
  throw new Error("no playable track for " + style);
}
function load(style) {
  if (cache.has(style)) {
    const hit = cache.get(style);
    cache.delete(style);
    cache.set(style, hit);
    return hit;
  }
  const p = fetchDecode(style).catch(() => { cache.delete(style); return null; });
  cache.set(style, p);
  for (const k of cache.keys()) {
    if (cache.size <= DECODED_MAX) break;
    if (k !== style && !(current && current.style === k)) cache.delete(k);
  }
  return p;
}
// Fetch the other tracks' files in the background (the showroom), so switching style is quick.
export function preload(styles) {
  if (muted) return;
  const go = () => styles.reduce((p, s) => p.then(() => fetchBytes(s).catch(() => {})), Promise.resolve());
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(go);
}

// Fold the last few seconds over the start so loop=true has no seam.
function seamless(buf) {
  const sr = buf.sampleRate, fade = Math.min(Math.floor(sr * 3), Math.floor(buf.length / 4));
  const len = buf.length - fade;
  const out = ac.createBuffer(buf.numberOfChannels, len, sr);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c), dst = out.getChannelData(c);
    dst.set(src.subarray(0, len));
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      dst[i] = src[i] * Math.sin(t * Math.PI / 2) + src[len + i] * Math.cos(t * Math.PI / 2);
    }
  }
  return out;
}

async function startMusic(style) {
  const token = {};
  startMusic.token = token;
  // Fade the old track straight away instead of waiting for the new one to load.
  if (current && current.style !== style) stopMusic(0.6);
  if (current && current.style === style) return;
  const buf = await load(style);
  if (startMusic.token !== token || !buf) return;
  stopMusic(0.6);
  const t = ac.currentTime, g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.7);
  g.connect(musicBus);
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(g);
  src.start(t);
  current = { style, src, g };
}
function stopMusic(fade = 0.8) {
  if (!current) return;
  const { src, g } = current, t = ac.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0, t + fade);
  try { src.stop(t + fade + 0.05); } catch {}
  src.onended = () => { src.disconnect(); g.disconnect(); };
  current = null;
}
export function music(style) {
  wantStyle = style;
  if (ac && ac.state === "running") startMusic(style);
}
export function silence() { wantStyle = null; if (ac) stopMusic(); }
// Duck the music under a big effect.
export function duck(amount = 0.45, ms = 900) {
  if (!ac) return;
  const t = ac.currentTime, p = musicBus.gain;
  p.cancelScheduledValues(t);
  p.setTargetAtTime(0.42 * amount, t, 0.05);
  p.setTargetAtTime(0.42, t + ms / 1000, 0.3);
}

/* ---------- effects ---------- */
const live = () => ac && ac.state === "running" && !muted;
function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function osc(type, f0, f1, dur, peak = 0.3, delay = 0, a = 0.005) {
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, a, peak, dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + a + dur + 0.05);
}
function hiss(type, f0, f1, dur, peak = 0.3, delay = 0, q = 1, a = 0.005) {
  const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noise;
  s.loop = true;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, a, peak, dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + a + dur + 0.05);
}
const r = (a, b) => a + Math.random() * (b - a);

export const sfx = {
  thud(power = 1) {
    if (!live()) return;
    const p = Math.max(0.15, Math.min(1, power));
    osc("sine", r(120, 160), 42, 0.22, 0.55 * p);
    hiss("lowpass", 900, 140, 0.12, 0.35 * p);
  },
  boing(pitch = 1) {
    if (!live()) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(260 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(520 * pitch, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(330 * pitch, t + 0.32);
    lfo.frequency.value = 22;
    lg.gain.value = 18 * pitch;
    lfo.connect(lg).connect(o.frequency);
    env(g, t, 0.006, 0.22, 0.32);
    o.connect(g).connect(sfxBus);
    o.start(t); lfo.start(t);
    o.stop(t + 0.4); lfo.stop(t + 0.4);
  },
  pop() {
    if (!live()) return;
    osc("sine", r(500, 700), r(1400, 1800), 0.07, 0.35);
    hiss("bandpass", 2400, 1200, 0.05, 0.25, 0, 3);
  },
  whoosh(dur = 0.6, peak = 0.22) {
    if (!live()) return;
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; s.loop = true;
    f.type = "bandpass"; f.Q.value = 1.4;
    f.frequency.setValueAtTime(350, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.55);
    f.frequency.exponentialRampToValueAtTime(500, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(sfxBus);
    s.start(t); s.stop(t + dur + 0.05);
  },
  click(delay = 0, hi = 1) {
    if (!live()) return;
    osc("square", 1800 * hi, 900 * hi, 0.025, 0.12, delay, 0.001);
    hiss("highpass", 3000, 3000, 0.02, 0.12, delay);
  },
  tick(delay = 0) {
    if (!live()) return;
    hiss("bandpass", r(2500, 4200), 2000, 0.02, 0.16, delay, 4, 0.001);
  },
  // A computer keyboard key: a bright click on the way down and a short plastic thock; the
  // space bar is deeper and a little longer.
  key(delay = 0, space = false) {
    if (!live()) return;
    const v = r(0.85, 1.1);
    hiss("highpass", 4200, 4200, 0.006, 0.42 * v, delay, 0.7, 0.0005);
    hiss("bandpass", space ? r(420, 520) : r(900, 1300), space ? 380 : 700, space ? 0.05 : 0.028, 0.55 * v, delay + 0.003, 3, 0.001);
    osc("sine", space ? 160 : r(230, 280), space ? 90 : 140, space ? 0.045 : 0.025, 0.28 * v, delay + 0.002, 0.001);
    hiss("highpass", 3000, 3000, 0.008, 0.16 * v, delay + (space ? 0.075 : 0.06), 0.7, 0.0005);
  },
  stamp() {
    if (!live()) return;
    osc("sine", 95, 38, 0.3, 0.6);
    hiss("lowpass", 1400, 200, 0.2, 0.4);
    hiss("bandpass", 3000, 1500, 0.08, 0.12, 0.01, 2);
  },
  clink() {
    if (!live()) return;
    [1, 2.76, 5.4].forEach((m, i) => osc("sine", 1320 * m, 1320 * m, 0.9 - i * 0.25, 0.09 / (i + 1), 0, 0.002));
  },
  chime(base = 880, n = 4, gap = 0.09) {
    if (!live()) return;
    const scale = [0, 3, 5, 7, 10, 12, 15];
    for (let i = 0; i < n; i++) {
      const f = base * Math.pow(2, scale[(i * 2 + (Math.random() * 2 | 0)) % scale.length] / 12);
      osc("sine", f, f, 1.4, 0.07, i * gap, 0.01);
      osc("sine", f * 2.01, f * 2.01, 0.6, 0.02, i * gap, 0.01);
    }
  },
  shimmer() {
    if (!live()) return;
    for (let i = 0; i < 7; i++) { const f = r(1800, 4200); osc("sine", f, f * 1.02, 0.5, 0.035, i * 0.05, 0.01); }
    this.whoosh(0.8, 0.12);
  },
  crtOff() {
    if (!live()) return;
    osc("sawtooth", 900, 60, 0.28, 0.08);
    hiss("highpass", 6000, 6000, 0.12, 0.08);
  },
  crtOn() {
    if (!live()) return;
    osc("sine", 60, 15000, 0.25, 0.03);
    hiss("bandpass", 200, 4000, 0.3, 0.1, 0, 0.8);
  },
  snap() {
    if (!live()) return;
    osc("sine", 140, 70, 0.08, 0.35);
    this.click(0, 0.6);
  },
  zip(up = true) {
    if (!live()) return;
    for (let i = 0; i < 9; i++) this.tick(i * 0.03);
    osc("triangle", up ? 300 : 900, up ? 900 : 300, 0.3, 0.06);
  },
};
