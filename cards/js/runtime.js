// Card runtime: light that follows tilt (pointer or gyroscope), swipe-to-flip with inertia,
// and portrait ↔ landscape morphs that also work when the phone has rotation lock on.
import { renderCard, waLink, cardURL, esc } from "./templates.js";
import { MORPHS } from "./morphs.js";
import { play } from "./util.js";

const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = matchMedia("(pointer: coarse)").matches;

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


// Position of `el` inside `face`, ignoring every transform on the way (offsets are layout-only).
function rel(el, face) {
  let x = 0, y = 0, n = el;
  while (n && n !== face) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

const FREEZE_PROPS = ["position", "left", "top", "right", "bottom", "width", "height", "margin", "transformOrigin", "opacity", "transform", "zIndex"];

export function mountCard(stage, { style, data }) {
  const S = {
    style, data,
    land: false,          // current layout
    rot: 0,               // stage counter-rotation (deg) when the OS did not rotate
    manual: false,        // landscape forced by the rotate button
    gyroSide: 0,          // -90 / 0 / 90 from the gyroscope
    flip: 0, flipV: 0, dragging: false,
    busy: false, queued: null,
    tilt: { x: 0, y: 0, tx: 0, ty: 0, src: "idle" },
  };

  stage.innerHTML = `
    <div class="scene"><div class="enter"><div class="tilt"><div class="flipper">${renderCard(style, data, { qr: qrSVG })}</div></div></div></div>
    <nav class="actions" aria-label="Card actions">
      <button class="act" data-a="save" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>Save contact</button>
      ${waLink(data) ? `<a class="act" data-a="wa" href="${esc(waLink(data))}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>WhatsApp</a>` : ""}
      <button class="act" data-a="share" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>Share</button>
      <button class="act icon" data-a="rotate" type="button" aria-label="Switch portrait / landscape"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="7" y="2" width="10" height="16" rx="2"/><path d="M21 14a8 8 0 0 1-8 8M21 14l-2.5 1M21 14l1 2.5"/></svg></button>
    </nav>`;

  const scene = stage.querySelector(".scene");
  const enterEl = stage.querySelector(".enter");
  const tiltEl = stage.querySelector(".tilt");
  const flipper = stage.querySelector(".flipper");
  const front = stage.querySelector(".face.front");
  const back = stage.querySelector(".face.back");
  const visibleFace = () => (Math.cos((S.flip * Math.PI) / 180) >= 0 ? front : back);

  /* ---------- morph context ---------- */
  function makeCtx(face, land) {
    const ctx = {
      face, flipper, wrap: enterEl, land, style: S.style,
      W: () => flipper.offsetWidth, H: () => flipper.offsetHeight,
      els: () => [...face.querySelectorAll("[data-m]")],
      rel: (el) => rel(el, face),
      // Measure, switch layout, measure again, then pin every element at its final spot
      // and put the card back at its old size so the style can animate from there.
      switch() {
        const els = ctx.els();
        const W0 = flipper.offsetWidth, H0 = flipper.offsetHeight;
        const first = els.map((el) => rel(el, face));
        root.classList.toggle("land", land);
        const W1 = flipper.offsetWidth, H1 = flipper.offsetHeight;
        const last = els.map((el) => rel(el, face));
        els.forEach((el, i) => {
          const l = last[i];
          Object.assign(el.style, { position: "absolute", left: l.x + "px", top: l.y + "px", right: "auto", bottom: "auto", width: l.w + "px", height: l.h + "px", margin: "0", transformOrigin: "50% 50%" });
        });
        flipper.style.width = W0 + "px";
        flipper.style.height = H0 + "px";
        return { pairs: els.map((el, i) => ({ el, f: first[i], l: last[i] })), W0, H0, W1, H1 };
      },
      // Pin the current layout without switching (used by entrance animations).
      freeze() {
        const els = ctx.els();
        const W = flipper.offsetWidth, H = flipper.offsetHeight;
        const last = els.map((el) => rel(el, face));
        els.forEach((el, i) => {
          const l = last[i];
          Object.assign(el.style, { position: "absolute", left: l.x + "px", top: l.y + "px", right: "auto", bottom: "auto", width: l.w + "px", height: l.h + "px", margin: "0", transformOrigin: "50% 50%" });
        });
        return { pairs: els.map((el, i) => ({ el, f: last[i], l: last[i] })), W0: W, H0: H, W1: W, H1: H };
      },
      resize(m, o) {
        const a = flipper.animate([{ width: m.W0 + "px", height: m.H0 + "px" }, { width: m.W1 + "px", height: m.H1 + "px" }], { fill: "both", ...o });
        return a.finished.catch(() => {}).then(() => { flipper.style.width = m.W1 + "px"; flipper.style.height = m.H1 + "px"; a.cancel(); });
      },
      // FLIP one element from its first box (plus optional extra transform) to its last box.
      flip(p, { duration = 650, easing = "cubic-bezier(.2,.8,.2,1)", delay = 0, from = "", to = "", uniform = true, extra = {} } = {}) {
        const { f, l } = p;
        const dx = f.x + f.w / 2 - (l.x + l.w / 2), dy = f.y + f.h / 2 - (l.y + l.h / 2);
        let sx = l.w ? f.w / l.w : 1, sy = l.h ? f.h / l.h : 1;
        if (uniform) sx = sy = Math.sqrt(Math.max(sx, .05) * Math.max(sy, .05));
        return play(p.el, [
          { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy}) ${from}`, ...(extra.from || {}) },
          { transform: `translate(0,0) scale(1,1) ${to}`, ...(extra.to || {}) },
        ], { duration: reduce ? 1 : duration, easing, delay: reduce ? 0 : delay, fill: "backwards" });
      },
      done(m) {
        m.pairs.forEach(({ el }) => {
          el.getAnimations().forEach((a) => a.cancel());
          FREEZE_PROPS.forEach((k) => (el.style[k] = ""));
        });
        flipper.style.width = flipper.style.height = "";
      },
    };
    return ctx;
  }

  async function setLayout(land) {
    if (land === S.land && !S.busy) return;
    if (S.busy) { S.queued = land; return; }
    S.busy = true;
    stage.dataset.busy = "1";
    S.land = land;
    const face = visibleFace();
    const run = (MORPHS[S.style] && MORPHS[S.style].morph) || MORPHS.default.morph;
    try {
      await (reduce ? MORPHS.default.morph(makeCtx(face, land)) : run(makeCtx(face, land)));
    } catch (e) {
      console.error(e);
      root.classList.toggle("land", land);
    }
    S.busy = false;
    delete stage.dataset.busy;
    if (S.queued !== null && S.queued !== S.land) { const q = S.queued; S.queued = null; setLayout(q); }
    else S.queued = null;
  }

  /* ---------- orientation: real viewport, gyroscope (rotation lock), or the button ---------- */
  function evaluate() {
    const viewLand = innerWidth > innerHeight;
    let land = viewLand, rot = 0;
    if (!viewLand) {
      if (S.gyroSide) { land = true; rot = -S.gyroSide; }
      else if (S.manual) { land = true; }
    }
    if (rot !== S.rot) {
      S.rot = rot;
      stage.classList.toggle("virtual", rot !== 0);
      stage.style.setProperty("--stage-rot", rot + "deg");
    }
    if (land !== S.land) setLayout(land);
  }
  const onResize = () => requestAnimationFrame(evaluate);
  addEventListener("resize", onResize);
  let alive = true;

  /* ---------- gyroscope ---------- */
  let gyroOn = false, sideTimer = 0, base = null;
  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    const b = (e.beta * Math.PI) / 180, g = (e.gamma * Math.PI) / 180;
    // Gravity direction in the screen plane: (0,1) = held upright, (±1,0) = on its side.
    const X = Math.cos(b) * Math.sin(g), Y = Math.sin(b), Z = Math.cos(b) * Math.cos(g);
    const mag = Math.hypot(X, Y);
    const theta = (Math.atan2(X, Y) * 180) / Math.PI;
    if (mag > 0.45) {
      let side = S.gyroSide;
      if (Math.abs(theta) > 58 && Math.abs(theta) < 122) side = theta > 0 ? 90 : -90;
      else if (Math.abs(theta) < 32) side = 0;
      if (side !== S.gyroSide) {
        clearTimeout(sideTimer);
        const want = side;
        // Wait a moment: if the OS is about to rotate the viewport itself, let it.
        sideTimer = setTimeout(() => { S.gyroSide = innerWidth > innerHeight ? 0 : want; evaluate(); }, 380);
      }
    }
    // Light: deviation of the gravity vector from a slowly drifting baseline.
    const r = ((S.rot ? -S.rot : (screen.orientation ? screen.orientation.angle : 0)) * Math.PI) / 180;
    const ux = X * Math.cos(r) + Y * Math.sin(r);
    if (!base) base = { ux, z: Z };
    base.ux += (ux - base.ux) * 0.015;
    base.z += (Z - base.z) * 0.015;
    S.tilt.tx = Math.max(-1, Math.min(1, (ux - base.ux) * 3.2));
    S.tilt.ty = Math.max(-1, Math.min(1, (Z - base.z) * -3.2));
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
    } else {
      S.flipV = drag.v;
      S.flipTarget = null;
    }
    drag = null;
    S.dragging = false;
  };
  scene.addEventListener("pointerup", endDrag);
  scene.addEventListener("pointercancel", endDrag);
  scene.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !drag) S.tilt.src = "idle"; });

  /* ---------- animation loop ---------- */
  let lastT = performance.now();
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
    tiltEl.style.setProperty("--ry", (T.x * 14).toFixed(2) + "deg");
    tiltEl.style.setProperty("--rx", (-T.y * 10).toFixed(2) + "deg");
    // The light moves opposite to the flip so the back face is lit correctly too.
    const px = 50 + T.x * 48, py = 42 + T.y * 45;
    front.style.setProperty("--px", px.toFixed(1) + "%");
    front.style.setProperty("--py", py.toFixed(1) + "%");
    back.style.setProperty("--px", (100 - px).toFixed(1) + "%");
    back.style.setProperty("--py", py.toFixed(1) + "%");
    flipper.style.setProperty("--flip", S.flip.toFixed(2) + "deg");
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- actions ---------- */
  const toast = Object.assign(document.createElement("div"), { className: "toast" });
  document.body.appendChild(toast);
  let toastT = 0;
  const say = (msg) => { toast.textContent = msg; toast.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove("show"), 1800); };

  stage.querySelector(".actions").addEventListener("click", async (e) => {
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
      S.manual = !S.manual;
      if (S.gyroSide) S.gyroSide = 0;
      evaluate();
    }
  });

  /* ---------- hint + entrance ---------- */
  const hint = Object.assign(document.createElement("div"), { className: "hint", textContent: isTouch ? "Swipe to flip · turn your phone" : "Drag to flip · hover to tilt" });
  document.body.appendChild(hint);
  function hideHint() { hint.classList.add("gone"); }
  setTimeout(hideHint, 4500);

  root.classList.toggle("land", innerWidth > innerHeight);
  S.land = innerWidth > innerHeight;
  evaluate();
  const enter = (MORPHS[S.style] && MORPHS[S.style].enter) || MORPHS.default.enter;
  if (!reduce) enter(makeCtx(front, S.land)).catch((e) => console.error(e));

  return {
    destroy() { alive = false; removeEventListener("deviceorientation", onOrient); removeEventListener("resize", onResize); clearTimeout(sideTimer); toast.remove(); hint.remove(); },
    setLand: (v) => { S.manual = v; evaluate(); },
    state: S,
  };
}
