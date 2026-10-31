// Card runtime: light that follows tilt (pointer or gyroscope), swipe-to-flip with inertia,
// portrait ↔ landscape morphs (also with rotation lock on), full-screen mode, music and effects.
import { renderCard, waLink, cardURL, esc } from "./templates.js";
import { MORPHS } from "./morphs.js";
import { mountLive } from "./fx.js";
import { play } from "./util.js";
import * as sound from "./sound.js";

const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = matchMedia("(pointer: coarse)").matches;
const EASE = "cubic-bezier(.2,.8,.2,1)";
// Safari's engine (every browser on iOS) gets a few rendering workarounds, see base.css.
const ua = navigator.userAgent;
root.classList.toggle("webkit", /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || (/Safari/.test(ua) && !/Chrom|Android|Firefox|Edg/.test(ua)));

export function qrSVG(text) {
  if (!window.qrcode || !text) return "";
  const q = window.qrcode(0, "M");
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" aria-label="QR code"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="var(--qr-bg)"/><path d="${d}" fill="var(--qr-fg)"/></svg>`;
}

// Pinned elements are absolutely positioned inside .lay; grid-area must be cleared or the grid
// area (not .lay) becomes their containing block and every element lands in the wrong place.
const PIN_PROPS = ["position", "left", "top", "right", "bottom", "width", "height", "margin", "gridArea", "transformOrigin", "opacity", "transform", "zIndex", "filter"];
const px = (v) => v + "px";

const I = {
  save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>`,
  wa: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>`,
  rotate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="7" y="2" width="10" height="16" rx="2"/><path d="M21 14a8 8 0 0 1-8 8M21 14l-2.5 1M21 14l1 2.5"/></svg>`,
  full: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path class="i-in" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><path class="i-out" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>`,
  sound: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke-linejoin="round"/><path class="i-on" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="i-off" d="M17 9l5 6M22 9l-5 6"/></svg>`,
};

export function mountCard(stage, { style, data }) {
  let alive = true;
  const S = {
    style, data,
    land: false,          // current layout
    rot: 0,               // stage counter-rotation (deg) when the OS did not rotate
    manual: null,         // true / false when the rotate button forces a layout
    gyroSide: 0,          // -90 / 0 / 90 from the gyroscope
    viewLand: innerWidth > innerHeight,
    flip: 0, flipV: 0, dragging: false,
    busy: false, queued: null,
    tilt: { x: 0, y: 0, tx: 0, ty: 0, src: "idle" },
  };

  stage.innerHTML = `
    <div class="scene"><div class="enter"><div class="tilt"><div class="flipper">${renderCard(style, data, { qr: qrSVG })}</div></div></div></div>
    <nav class="actions" aria-label="Card actions">
      <button class="act" data-a="save" type="button">${I.save}Save contact</button>
      ${waLink(data) ? `<a class="act" data-a="wa" href="${esc(waLink(data))}" target="_blank" rel="noopener">${I.wa}WhatsApp</a>` : ""}
      <button class="act" data-a="share" type="button">${I.share}Share</button>
      <button class="act icon" data-a="sound" type="button" aria-label="Music on / off">${I.sound}</button>
      <button class="act icon" data-a="rotate" type="button" aria-label="Switch portrait / landscape">${I.rotate}</button>
      <button class="act icon" data-a="full" type="button" aria-label="Full screen">${I.full}</button>
    </nav>`;

  const scene = stage.querySelector(".scene");
  const enterEl = stage.querySelector(".enter");
  const tiltEl = stage.querySelector(".tilt");
  const flipper = stage.querySelector(".flipper");
  const front = stage.querySelector(".face.front");
  const back = stage.querySelector(".face.back");
  const actions = stage.querySelector(".actions");
  const visibleFace = () => (Math.cos((S.flip * Math.PI) / 180) >= 0 ? front : back);
  const live = mountLive(style, [front, back]);
  // Safari: the faces are clipped to their rounded corners (base.css), which also clips their outer
  // shadow, so it is drawn on a layer behind them instead.
  if (root.classList.contains("webkit") && style !== "pop") {
    const outer = getComputedStyle(front).boxShadow.split(/,(?![^(]*\))/).filter((s) => !/inset/.test(s)).join(",");
    flipper.style.setProperty("--card-shadow", outer || "none");
  }

  /* ---------- measuring ---------- */
  // Exact (sub-pixel) layout boxes relative to `face`, ignoring the 3D tilt/flip transforms.
  // The stage's own 2D rotation is undone mathematically so it can keep transitioning.
  function stageAngle() {
    const m = getComputedStyle(stage).transform;
    if (!m || m === "none") return 0;
    const v = m.match(/-?[\d.]+(?:e[-+]?\d+)?/g).map(Number);
    return Math.atan2(v[1], v[0]);
  }
  function measure(els, face) {
    if (!alive) throw new Error("card destroyed");
    stage.classList.add("measuring");
    const th = -stageAngle(), c = Math.cos(th), s = Math.sin(th);
    const fr = face.getBoundingClientRect(), fs = getComputedStyle(face);
    const fcx = fr.left + fr.width / 2, fcy = fr.top + fr.height / 2;
    const fw = parseFloat(fs.width), fh = parseFloat(fs.height);
    const out = els.map((el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      let w = parseFloat(cs.width), h = parseFloat(cs.height);
      if (!(w >= 0)) w = el.offsetWidth + 1;
      if (!(h >= 0)) h = el.offsetHeight;
      const vx = r.left + r.width / 2 - fcx, vy = r.top + r.height / 2 - fcy;
      const lx = vx * c - vy * s, ly = vx * s + vy * c;
      return { x: fw / 2 + lx - w / 2, y: fh / 2 + ly - h / 2, w, h };
    });
    stage.classList.remove("measuring");
    return out;
  }
  const flipSize = () => { const cs = getComputedStyle(flipper); return { W: parseFloat(cs.width), H: parseFloat(cs.height) }; };
  const sceneCenter = () => ({ x: scene.offsetLeft + scene.offsetWidth / 2 - stage.clientWidth / 2, y: scene.offsetTop + scene.offsetHeight / 2 - stage.clientHeight / 2 });

  function pin(els, boxes) {
    els.forEach((el, i) => {
      const b = boxes[i];
      Object.assign(el.style, { position: "absolute", left: px(b.x - 0.25), top: px(b.y), right: "auto", bottom: "auto", width: px(b.w + 0.5), height: px(b.h), margin: "0", gridArea: "auto", transformOrigin: "50% 50%" });
    });
  }

  /* ---------- morph context ---------- */
  function makeCtx(face, land, apply = () => {}) {
    const box = face.querySelector(".box");
    const ctx = {
      face, flipper, wrap: enterEl, scene, land, style: S.style, live,
      W: () => flipSize().W, H: () => flipSize().H,
      els: () => [...face.querySelectorAll("[data-m]")],
      rel: (el) => measure([el], face)[0],
      // Measure, switch layout, measure again, then pin every element at its final spot and put
      // the card back at its old size and place so the style can animate from there.
      switch() {
        const els = ctx.els();
        const { W: W0, H: H0 } = flipSize();
        const c0 = sceneCenter();
        const a0 = actions.getBoundingClientRect();
        const first = measure(els, face);
        apply();
        root.classList.toggle("land", land);
        const { W: W1, H: H1 } = flipSize();
        const c1 = sceneCenter();
        const last = measure(els, face);
        // Freeze the content's container at the final size: font sizes stay put while the card resizes.
        Object.assign(box.style, { width: px(W1), height: px(H1), right: "auto", bottom: "auto" });
        pin(els, last);
        flipper.style.width = px(W0);
        flipper.style.height = px(H0);
        const dx = c0.x - c1.x, dy = c0.y - c1.y;
        if (dx || dy) scene.style.transform = `translate(${dx}px,${dy}px)`;
        const a1 = actions.getBoundingClientRect();
        if (Math.abs(a1.left - a0.left) + Math.abs(a1.top - a0.top) > 40) play(actions, [{ opacity: 0, transform: land ? "translateX(12px)" : "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 260, easing: EASE, fill: "backwards" });
        return (ctx.m = { pairs: els.map((el, i) => ({ el, f: first[i], l: last[i] })), W0, H0, W1, H1, dx, dy });
      },
      // Pin the current layout without switching (entrance animations).
      freeze() {
        const els = ctx.els();
        const { W, H } = flipSize();
        const last = measure(els, face);
        Object.assign(box.style, { width: px(W), height: px(H), right: "auto", bottom: "auto" });
        pin(els, last);
        return { pairs: els.map((el, i) => ({ el, f: last[i], l: last[i] })), W0: W, H0: H, W1: W, H1: H, dx: 0, dy: 0 };
      },
      resize(m, o) {
        const a = flipper.animate([{ width: px(m.W0), height: px(m.H0) }, { width: px(m.W1), height: px(m.H1) }], { fill: "both", ...o });
        if (m.dx || m.dy) {
          const b = scene.animate([{ transform: `translate(${m.dx}px,${m.dy}px)` }, { transform: "none" }], { fill: "both", ...o });
          b.finished.catch(() => {}).then(() => { scene.style.transform = ""; b.cancel(); });
        }
        return a.finished.catch(() => {}).then(() => { flipper.style.width = px(m.W1); flipper.style.height = px(m.H1); a.cancel(); });
      },
      // FLIP one element from its first box (plus optional extra transform) to its last box.
      flip(p, { duration = 650, easing = EASE, delay = 0, from = "", to = "", uniform = true, extra = {} } = {}) {
        const { f, l } = p;
        const dx = f.x + f.w / 2 - (l.x + l.w / 2), dy = f.y + f.h / 2 - (l.y + l.h / 2);
        let sx = l.w ? f.w / l.w : 1, sy = l.h ? f.h / l.h : 1;
        if (uniform) sx = sy = Math.sqrt(Math.max(sx, .05) * Math.max(sy, .05));
        return play(p.el, [
          { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy}) ${from}`, ...(extra.from || {}) },
          { transform: `translate(0,0) scale(1,1) ${to}`, ...(extra.to || {}) },
        ], { duration: reduce ? 1 : duration, easing, delay: reduce ? 0 : delay, fill: "backwards" });
      },
      // The transform that puts an element back at its first box, for styles that animate by hand.
      from(p) {
        const { f, l } = p;
        const s = Math.sqrt(Math.max(f.w / (l.w || 1), .05) * Math.max(f.h / (l.h || 1), .05));
        return { x: f.x + f.w / 2 - (l.x + l.w / 2), y: f.y + f.h / 2 - (l.y + l.h / 2), s };
      },
      done(m) {
        m.pairs.forEach(({ el }) => {
          el.getAnimations().forEach((a) => a.cancel());
          PIN_PROPS.forEach((k) => (el.style[k] = ""));
        });
        box.style.width = box.style.height = box.style.right = box.style.bottom = "";
        flipper.style.width = flipper.style.height = "";
        scene.style.transform = "";
      },
    };
    return ctx;
  }

  function applyRot(rot) {
    S.rot = rot;
    stage.classList.toggle("virtual", rot !== 0);
    stage.style.setProperty("--stage-rot", rot + "deg");
  }

  async function setLayout(target) {
    if (!alive) return;
    if (S.busy) { S.queued = target; return; }
    if (target.land === S.land) {
      if (target.rot !== S.rot) applyRot(target.rot);
      return;
    }
    S.busy = true;
    stage.dataset.busy = "1";
    S.land = target.land;
    const face = visibleFace();
    const ctx = makeCtx(face, target.land, () => applyRot(target.rot));
    const run = (MORPHS[S.style] && MORPHS[S.style].morph) || MORPHS.default.morph;
    let dog = 0;
    try {
      await Promise.race([
        reduce ? MORPHS.default.morph(ctx) : run(ctx),
        new Promise((_, rej) => { dog = setTimeout(() => rej(new Error("morph timed out")), 9000); }),
      ]);
    } catch (e) {
      if (!alive) return;
      console.error(e);
      face.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      if (ctx.m) ctx.done(ctx.m);
      applyRot(target.rot);
      root.classList.toggle("land", target.land);
    }
    clearTimeout(dog);
    if (!alive) return;
    S.busy = false;
    delete stage.dataset.busy;
    lastBox = snapBox();
    const q = S.queued;
    S.queued = null;
    if (q) setLayout(q); else evaluate();
  }

  /* ---------- orientation: real viewport, gyroscope (rotation lock), or the button ---------- */
  function want() {
    const viewLand = innerWidth > innerHeight;
    if (viewLand !== S.viewLand) {
      S.viewLand = viewLand; S.manual = null;
      // The OS rotates the page itself (rotation lock off): leave orientation to it from now on.
      if (isTouch) { osRotates = true; S.gyroSide = 0; }
    }
    if (S.manual !== null) {
      // On a phone held upright, a forced landscape turns the whole card so it fills the screen.
      const rot = S.manual && !viewLand && isTouch ? 90 : 0;
      return { land: S.manual, rot };
    }
    if (!viewLand && S.gyroSide) return { land: true, rot: -S.gyroSide };
    return { land: viewLand, rot: 0 };
  }
  function evaluate() {
    if (!alive) return;
    const t = want();
    if (S.busy) { S.queued = t; return; }
    if (t.land !== S.land || t.rot !== S.rot) setLayout(t);
  }
  const onResize = () => evaluate();
  addEventListener("resize", onResize);

  /* ---------- size changes outside a morph (full screen, toolbars): scale the card smoothly ---------- */
  const snapBox = () => ({ w: flipper.offsetWidth, ...sceneCenter() });
  let lastBox = null;
  const ro = new ResizeObserver(() => {
    const now = snapBox();
    if (lastBox && !S.busy && now.w && (Math.abs(now.w - lastBox.w) > 1 || Math.abs(now.x - lastBox.x) > 1 || Math.abs(now.y - lastBox.y) > 1)) {
      scene.getAnimations().forEach((a) => a.cancel());
      play(scene, [{ transform: `translate(${lastBox.x - now.x}px,${lastBox.y - now.y}px) scale(${lastBox.w / now.w})` }, { transform: "none" }], { duration: reduce ? 1 : 560, easing: EASE });
    }
    if (!S.busy) lastBox = now;
  });
  ro.observe(flipper);
  ro.observe(stage);

  /* ---------- gyroscope ---------- */
  // Gravity is low-pass filtered, a side needs a clear tilt (with hysteresis back to upright) and
  // must hold for a moment before the card turns. Readings with the phone near flat are ignored.
  let gyroOn = false, base = null, grav = null, cand = 0, candT = 0, osRotates = false;
  const SIDE_HOLD = 600;
  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    const b = (e.beta * Math.PI) / 180, g = (e.gamma * Math.PI) / 180;
    // Gravity direction in the screen plane: (0,1) = held upright, (±1,0) = on its side.
    const X0 = Math.cos(b) * Math.sin(g), Y0 = Math.sin(b), Z0 = Math.cos(b) * Math.cos(g);
    if (!grav) grav = { X: X0, Y: Y0, Z: Z0 };
    grav.X += (X0 - grav.X) * 0.2; grav.Y += (Y0 - grav.Y) * 0.2; grav.Z += (Z0 - grav.Z) * 0.2;
    const { X, Y, Z } = grav;
    const mag = Math.hypot(X, Y), a = Math.abs((Math.atan2(X, Y) * 180) / Math.PI);
    let side = cand;
    if (mag > 0.62) {
      if (a > 62 && a < 118 && Math.abs(X) > 0.58) side = X > 0 ? 90 : -90;
      else if (a < 32) side = 0;
    }
    const now = performance.now();
    if (side !== cand) { cand = side; candT = now; }
    if (cand !== S.gyroSide && now - candT > SIDE_HOLD && !S.dragging) {
      const g2 = innerWidth > innerHeight || osRotates ? 0 : cand;
      if (g2 !== S.gyroSide) { S.gyroSide = g2; S.manual = null; evaluate(); }
    }
    // Light: deviation of the gravity vector from a slowly drifting baseline.
    const r = ((S.rot ? -S.rot : (screen.orientation ? screen.orientation.angle : 0)) * Math.PI) / 180;
    const ux = X * Math.cos(r) + Y * Math.sin(r);
    if (!base) base = { ux, z: Z };
    base.ux += (ux - base.ux) * 0.015;
    base.z += (Z - base.z) * 0.015;
    S.tilt.tx = Math.max(-1, Math.min(1, (ux - base.ux) * 2.6));
    S.tilt.ty = Math.max(-1, Math.min(1, (Z - base.z) * -2.6));
    S.tilt.src = "gyro";
  }
  function startGyro() {
    if (gyroOn) return;
    gyroOn = true;
    addEventListener("deviceorientation", onOrient);
  }
  const needsPermission = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
  if (!needsPermission) startGyro();
  async function askGyro() {
    if (!needsPermission || gyroOn) return;
    try { if ((await DeviceOrientationEvent.requestPermission()) === "granted") startGyro(); } catch {}
  }

  /* ---------- pointer: hover tilt (mouse) and swipe-to-flip (any pointer) ---------- */
  let drag = null;
  const toStage = (dx, dy) => { const r = (S.rot * Math.PI) / 180; return dx * Math.cos(r) + dy * Math.sin(r); };
  scene.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" && !drag) {
      const r = flipper.getBoundingClientRect();
      S.tilt.tx = Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / r.width) * 1.6));
      S.tilt.ty = Math.max(-1, Math.min(1, ((e.clientY - (r.top + r.height / 2)) / r.height) * 1.6));
      S.tilt.src = "pointer";
    }
    if (!drag) return;
    const now = performance.now();
    const dx = toStage(e.clientX - drag.x0, e.clientY - drag.y0);
    const prev = S.flip;
    S.flip = drag.a0 + dx * 0.55;
    const dt = Math.max(1, now - drag.t);
    drag.v = (S.flip - prev) / dt;
    drag.t = now;
    drag.moved = drag.moved || Math.abs(dx) > 6;
  });
  scene.addEventListener("pointerdown", (e) => {
    askGyro();
    hideHint();
    scene.setPointerCapture(e.pointerId);
    drag = { x0: e.clientX, y0: e.clientY, a0: S.flip, t: performance.now(), t0: performance.now(), v: 0, moved: false };
    S.flipV = 0;
    S.dragging = true;
  });
  const endDrag = () => {
    if (!drag) return;
    if (!drag.moved && performance.now() - drag.t0 < 350) {
      S.flipV = 0;
      S.flipTarget = Math.round(S.flip / 180) * 180 + 180; // tap flips
      sound.sfx.whoosh(0.45, 0.12);
    } else {
      S.flipV = drag.v;
      S.flipTarget = null;
      if (Math.abs(drag.v) > 0.4) sound.sfx.whoosh(0.7, Math.min(0.3, Math.abs(drag.v) * 0.12));
    }
    drag = null;
    S.dragging = false;
  };
  scene.addEventListener("pointerup", endDrag);
  scene.addEventListener("pointercancel", endDrag);
  scene.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !drag) S.tilt.src = "idle"; });

  // Audio can only start inside a user gesture.
  const onFirstTouch = () => sound.unlock();
  addEventListener("pointerdown", onFirstTouch, true);
  addEventListener("keydown", onFirstTouch, true);
  sound.music(style);

  /* ---------- animation loop ---------- */
  let lastT = performance.now(), lastFace = 0, backShown = false, wasTurning = false;
  back.classList.add("off");
  function tick(t) {
    if (!alive) return;
    const dt = Math.min(48, t - lastT);
    lastT = t;
    const k = t / 1000, T = S.tilt;
    if (T.src === "idle") { T.tx = reduce ? 0.2 : Math.sin(k * 0.55) * 0.5; T.ty = reduce ? -0.25 : Math.cos(k * 0.42) * 0.35; }
    T.x += (T.tx - T.x) * 0.09;
    T.y += (T.ty - T.y) * 0.09;
    // Flip physics: free spin with friction, then a spring onto the nearest face.
    if (!S.dragging) {
      if (S.flipTarget == null && Math.abs(S.flipV) > 0.06) {
        S.flip += S.flipV * dt;
        S.flipV *= Math.pow(0.965, dt / 16);
      } else {
        if (S.flipTarget == null) S.flipTarget = Math.round(S.flip / 180) * 180;
        const a = (S.flipTarget - S.flip) * 0.0009 - S.flipV * 0.045;
        S.flipV += a * dt;
        S.flip += S.flipV * dt;
        if (Math.abs(S.flipTarget - S.flip) < 0.05 && Math.abs(S.flipV) < 0.002) { S.flip = S.flipTarget; S.flipV = 0; }
      }
    }
    // Hide the face that points away. Safari does not always honour backface-visibility for
    // composited children, so the two faces showed through each other and flickered.
    const showBack = Math.cos(((S.flip + T.x * 14) * Math.PI) / 180) < 0;
    if (showBack !== backShown) { backShown = showBack; front.classList.toggle("off", showBack); back.classList.toggle("off", !showBack); }
    const turning = S.dragging || Math.abs(S.flip - Math.round(S.flip / 180) * 180) > 2;
    if (turning !== wasTurning) { wasTurning = turning; stage.classList.toggle("turning", turning); }
    const faceNow = Math.round(S.flip / 180);
    if (faceNow !== lastFace) { lastFace = faceNow; if (Math.abs(S.flipV) > 0.25) sound.sfx.tick(); }
    tiltEl.style.setProperty("--ry", (T.x * 14).toFixed(2) + "deg");
    tiltEl.style.setProperty("--rx", (-T.y * 10).toFixed(2) + "deg");
    // The light moves opposite to the flip so the back face is lit correctly too.
    const lx = 50 + T.x * 48, ly = 42 + T.y * 45;
    front.style.setProperty("--px", lx.toFixed(1) + "%");
    front.style.setProperty("--py", ly.toFixed(1) + "%");
    back.style.setProperty("--px", (100 - lx).toFixed(1) + "%");
    back.style.setProperty("--py", ly.toFixed(1) + "%");
    flipper.style.setProperty("--flip", S.flip.toFixed(2) + "deg");
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- actions ---------- */
  const toast = Object.assign(document.createElement("div"), { className: "toast" });
  document.body.appendChild(toast);
  let toastT = 0;
  const say = (msg) => { toast.textContent = msg; toast.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove("show"), 1800); };

  const soundBtn = actions.querySelector('[data-a="sound"]');
  const syncSound = () => soundBtn.classList.toggle("off", sound.isMuted());
  syncSound();
  const offSound = sound.onChange(syncSound);

  let fsByUs = false;
  async function setImmersive(on) {
    root.classList.toggle("immersive", on);
    if (on && root.requestFullscreen && !document.fullscreenElement) {
      try { await root.requestFullscreen({ navigationUI: "hide" }); fsByUs = true; } catch {}
    } else if (!on && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
    if (on) say(isTouch ? "Full screen · turn your phone or tap ⟳" : "Full screen");
  }
  const onFs = () => { if (!document.fullscreenElement && fsByUs) { fsByUs = false; root.classList.remove("immersive"); } };
  document.addEventListener("fullscreenchange", onFs);

  actions.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    const a = b.dataset.a, d = S.data;
    if (a === "save") {
      const v = ["BEGIN:VCARD", "VERSION:3.0", `N:;${d.name};;;`, `FN:${d.name}`, d.company && `ORG:${d.company}`, d.title && `TITLE:${d.title}`,
        d.phone && `TEL;TYPE=CELL:${d.phone}`, d.email && `EMAIL:${d.email}`, `URL:${cardURL(d)}`, d.wa && `X-SOCIALPROFILE;TYPE=whatsapp:${waLink(d)}`, "END:VCARD"].filter(Boolean).join("\r\n");
      const url = URL.createObjectURL(new Blob([v], { type: "text/vcard" }));
      const link = Object.assign(document.createElement("a"), { href: url, download: `${(d.name || "contact").replace(/\s+/g, "_")}.vcf` });
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      say("Contact file ready");
    } else if (a === "share") {
      const url = cardURL(d);
      try {
        if (navigator.share) await navigator.share({ title: d.name, text: `${d.name} · ${d.title}`, url });
        else { await navigator.clipboard.writeText(url); say("Link copied"); }
      } catch {}
    } else if (a === "rotate") {
      S.manual = !S.land;
      S.gyroSide = 0;
      evaluate();
    } else if (a === "full") {
      setImmersive(!root.classList.contains("immersive"));
    } else if (a === "sound") {
      sound.setMuted(!sound.isMuted());
      say(sound.isMuted() ? "Sound off" : "Sound on");
    }
  });

  /* ---------- hint + entrance ---------- */
  const hint = Object.assign(document.createElement("div"), { className: "hint", textContent: isTouch ? "Swipe to flip · turn your phone" : "Drag to flip · hover to tilt" });
  document.body.appendChild(hint);
  function hideHint() { hint.classList.add("gone"); }
  setTimeout(hideHint, 4500);

  S.land = want().land;
  applyRot(want().rot);
  root.classList.toggle("land", S.land);
  lastBox = snapBox();
  const enter = (MORPHS[S.style] && MORPHS[S.style].enter) || MORPHS.default.enter;
  if (!reduce) {
    S.busy = true;
    enter(makeCtx(front, S.land)).catch((e) => console.error(e)).then(() => { S.busy = false; lastBox = snapBox(); evaluate(); });
  }

  return {
    destroy() {
      alive = false; live.destroy(); ro.disconnect(); offSound();
      removeEventListener("deviceorientation", onOrient); removeEventListener("resize", onResize);
      removeEventListener("pointerdown", onFirstTouch, true); removeEventListener("keydown", onFirstTouch, true);
      document.removeEventListener("fullscreenchange", onFs);
      toast.remove(); hint.remove(); delete stage.dataset.busy;
    },
    setLand: (v) => { S.manual = v; evaluate(); },
    state: S,
  };
}
