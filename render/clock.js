// Injected into the card page before any of its scripts. Replaces the page's sense of time with a
// virtual clock that only moves when the exporter calls window.__advance(ms), so every frame is
// exact however slow the machine is: timers, requestAnimationFrame, performance.now / Date.now,
// and every CSS animation, CSS transition and Web Animation.
(() => {
  let vt = 0, nextId = 1;
  const timers = new Map();
  let rafs = [];
  const flush = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });

  const startDate = Date.now();
  performance.now = () => vt;
  Date.now = () => startDate + vt;
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: vt + Math.max(0, +ms || 0), fn, args });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++, every = Math.max(1, +ms || 0);
    timers.set(id, { at: vt + every, fn, args, every });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  window.requestAnimationFrame = (cb) => { const id = nextId++; rafs.push({ id, cb }); return id; };
  window.cancelAnimationFrame = (id) => { rafs = rafs.filter((r) => r.id !== id); };
  window.requestIdleCallback = (cb) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1);

  // Seeded randomness so the same card always renders the same video.
  let seed = 20261031;
  Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  // Animations: each is pinned to (virtual now − the moment it appeared). Ones that reach their end
  // are finished properly, so code awaiting `animation.finished` carries on as it would live.
  // Web Animations are also tracked here: one paused a hair before its end can drop out of
  // document.getAnimations() and would then never finish.
  const born = new WeakMap(), own = new Set();
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (...a) {
    const an = animate.apply(this, a);
    born.set(an, vt);
    own.add(an);
    an.pause();
    an.currentTime = 0;
    return an;
  };
  function syncAnimations() {
    for (const an of new Set([...document.getAnimations(), ...own])) {
      if (an.playState === "finished" || an.playState === "idle") { own.delete(an); continue; }
      if (!born.has(an)) born.set(an, vt);
      const t = vt - born.get(an), end = an.effect ? an.effect.getComputedTiming().endTime : Infinity;
      if (Number.isFinite(end) && t >= end - 0.5) { an.finish(); own.delete(an); }
      else { an.pause(); an.currentTime = t; }
    }
  }

  window.__now = () => vt;
  window.__advance = async (ms) => {
    const target = vt + ms;
    for (let guard = 0; guard < 10000; guard++) {
      let next = null;
      for (const [id, t] of timers) if (t.at <= target && (!next || t.at < next.t.at)) next = { id, t };
      if (!next) break;
      vt = Math.max(vt, next.t.at);
      if (next.t.every) next.t.at += next.t.every; else timers.delete(next.id);
      try { typeof next.t.fn === "function" && next.t.fn(...next.t.args); } catch (e) { console.error(e); }
      await flush();
    }
    vt = target;
    const due = rafs;
    rafs = [];
    for (const r of due) { try { r.cb(vt); } catch (e) { console.error(e); } }
    await flush();
    syncAnimations();
    await flush();
    syncAnimations();
  };
})();
