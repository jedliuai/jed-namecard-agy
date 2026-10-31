// Portrait ↔ landscape choreography for each style. Every morph gets a ctx from runtime.js:
//   ctx.switch()  measure → change layout → pin elements at their new spots → card back at old size
//   ctx.resize()  animate the card to its new size        ctx.flip()  move one element old → new
//   ctx.done()    release the pinned elements
import { play, wait } from "./util.js";

const EASE = "cubic-bezier(.2,.8,.2,1)";
const SPRING = "cubic-bezier(.3,1.45,.55,1)";
const SNAP = "cubic-bezier(.75,0,.25,1)";
const rand = (a, b) => a + Math.random() * (b - a);
const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

// Default: plain FLIP with a gentle stagger.
async function basic(ctx, o = {}) {
  const m = ctx.switch();
  ctx.resize(m, { duration: o.duration || 650, easing: o.easing || EASE });
  await Promise.all(m.pairs.map((p, i) => ctx.flip(p, { duration: o.duration || 650, easing: o.easing || EASE, delay: i * (o.stagger ?? 14) })));
  ctx.done(m);
}

// Generic entrance: the card rises and settles.
async function rise(ctx) {
  await play(ctx.wrap, [
    { transform: "translateY(18%) rotateX(38deg) scale(.86)", opacity: 0 },
    { transform: "none", opacity: 1 },
  ], { duration: 1000, easing: SPRING });
}

/* ---------- 1 OBSIDIAN: a heavy metal plate swings round, then the foil is re-engraved ---------- */
async function obsidian(ctx) {
  const m = ctx.switch();
  ctx.resize(m, { duration: 950, easing: SPRING });
  play(ctx.wrap, [{ transform: "rotateZ(0)" }, { transform: `rotateZ(${ctx.land ? -6 : 6}deg)`, offset: .3 }, { transform: `rotateZ(${ctx.land ? 2 : -2}deg)`, offset: .68 }, { transform: "rotateZ(0)" }], { duration: 1100, easing: "ease-out" });
  await Promise.all(m.pairs.map((p, i) => ctx.flip(p, { duration: 950, easing: SPRING, delay: i * 22 })));
  ctx.done(m);
  engrave(ctx.face);
}
function engrave(face) {
  const n = face.querySelector(".o-name");
  if (!n) return;
  n.classList.remove("engrave");
  void n.offsetWidth;
  n.classList.add("engrave");
}

/* ---------- 2 HOLO: a rainbow band sweeps through while the text splits into RGB ---------- */
async function holo(ctx) {
  const band = ctx.face.querySelector(".h-band");
  const foil = ctx.face.querySelector(".h-foil");
  const m = ctx.switch();
  ctx.resize(m, { duration: 800, easing: EASE });
  if (band) play(band, [{ opacity: 0, transform: "translateX(-70%) skewX(-12deg)" }, { opacity: 1, offset: .25 }, { opacity: 1, offset: .7 }, { opacity: 0, transform: "translateX(70%) skewX(-12deg)" }], { duration: 1000, easing: "ease-in-out" });
  if (foil) play(foil, [{ filter: "hue-rotate(0deg) saturate(1)" }, { filter: "hue-rotate(200deg) saturate(1.8)", offset: .5 }, { filter: "hue-rotate(360deg) saturate(1)" }], { duration: 1000, easing: "ease-in-out" });
  const split = { from: { textShadow: "-1.2cqmin 0 rgba(255,0,110,.85), 1.2cqmin 0 rgba(0,225,255,.85)", filter: "blur(.25cqmin)" }, to: { textShadow: "0 0 rgba(255,0,110,0), 0 0 rgba(0,225,255,0)", filter: "blur(0)" } };
  await Promise.all(m.pairs.map((p, i) => ctx.flip(p, { duration: 800, easing: EASE, delay: i * 30, extra: split })));
  ctx.done(m);
}

/* ---------- 3 TERMINAL: CRT switches off to a line, reboots in the new shape, retypes the name ---------- */
async function terminal(ctx) {
  const line = ctx.face.querySelector(".t-line");
  const H = ctx.H();
  let els = ctx.els();
  await Promise.all(els.map((el) => {
    const r = ctx.rel(el);
    return play(el, [{ transform: "none", filter: "brightness(1)" }, { transform: `translateY(${H / 2 - (r.y + r.h / 2)}px) scaleY(.03)`, filter: "brightness(2.6)" }], { duration: 230, easing: "cubic-bezier(.6,0,1,1)", fill: "forwards" });
  }));
  if (line) await play(line, [{ opacity: 1, transform: "scaleX(1)" }, { opacity: 1, transform: "scaleX(0)" }], { duration: 170, easing: "ease-in", fill: "forwards" });
  els.forEach((el) => { el.style.opacity = "0"; el.getAnimations().forEach((a) => a.cancel()); });
  const m = ctx.switch();
  m.pairs.forEach(({ el }) => (el.style.opacity = "0"));
  await ctx.resize(m, { duration: 320, easing: SNAP });
  if (line) { line.getAnimations().forEach((a) => a.cancel()); await play(line, [{ opacity: 1, transform: "scaleX(0)" }, { opacity: 1, transform: "scaleX(1)" }, { opacity: 0, transform: "scaleX(1)" }], { duration: 260, easing: "ease-out" }); }
  const H1 = ctx.H();
  await Promise.all(m.pairs.map(({ el, l }, i) => {
    el.style.opacity = "";
    return play(el, [
      { transform: `translateY(${H1 / 2 - (l.y + l.h / 2)}px) scaleY(.03)`, opacity: 0, filter: "brightness(3)" },
      { transform: "none", opacity: 1, filter: "brightness(1.6)", offset: .7 },
      { transform: "none", opacity: 1, filter: "brightness(1)" },
    ], { duration: 360, easing: "cubic-bezier(.2,.9,.3,1)", delay: i * 40, fill: "backwards" });
  }));
  ctx.done(m);
  const t = ctx.face.querySelector(".t-type");
  if (t) { t.classList.remove("go"); void t.offsetWidth; t.classList.add("go"); }
}

/* ---------- 4 SWISS: the grid flashes, blocks snap into their new cells, the red disc rolls ---------- */
async function swiss(ctx) {
  const grid = ctx.face.querySelector(".w-gridlines");
  const m = ctx.switch();
  ctx.resize(m, { duration: 700, easing: SNAP });
  if (grid) play(grid, [{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: 1100 });
  const order = [...m.pairs].sort((a, b) => a.l.y - b.l.y || a.l.x - b.l.x);
  await Promise.all(order.map((p, i) => {
    if (p.el.classList.contains("w-dot")) {
      const d = Math.hypot(p.f.x - p.l.x, p.f.y - p.l.y);
      const turn = (d / (p.l.w / 2)) * (180 / Math.PI) * (p.f.x > p.l.x ? -1 : 1);
      return ctx.flip(p, { duration: 1100, easing: "cubic-bezier(.45,0,.2,1)", from: `rotate(${turn}deg)`, to: "rotate(0deg)", uniform: false });
    }
    return ctx.flip(p, { duration: 620, easing: SNAP, delay: 80 + i * 45 });
  }));
  ctx.done(m);
}

/* ---------- 5 POP: everything falls, crashes into a pile, then stacks itself back up ---------- */
let matterP = null;
function loadMatter() {
  if (window.Matter) return Promise.resolve(window.Matter);
  return (matterP ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js";
    s.onload = () => res(window.Matter);
    s.onerror = rej;
    document.head.appendChild(s);
  }));
}

const POWS = ["POW!", "BAM!", "WHAM!", "BOOM!", "ZAP!"];
function pow(ctx, x, y) {
  const el = document.createElement("div");
  el.className = "pow";
  el.textContent = POWS[(Math.random() * POWS.length) | 0];
  el.style.left = x + "px";
  el.style.top = y + "px";
  ctx.face.appendChild(el);
  const r = rand(-18, 18);
  play(el, [
    { transform: `translate(-50%,-50%) rotate(${r}deg) scale(0)`, opacity: 1 },
    { transform: `translate(-50%,-50%) rotate(${r}deg) scale(1.25)`, opacity: 1, offset: .25 },
    { transform: `translate(-50%,-50%) rotate(${r}deg) scale(1)`, opacity: 1, offset: .7 },
    { transform: `translate(-50%,-50%) rotate(${r}deg) scale(.9)`, opacity: 0 },
  ], { duration: 700, easing: "ease-out" }).then(() => el.remove());
}
function shake(ctx, power = 1) {
  play(ctx.wrap, [
    { transform: "translate(0,0)" }, { transform: `translate(${-5 * power}px,${3 * power}px)` }, { transform: `translate(${4 * power}px,${-4 * power}px)` },
    { transform: `translate(${-2 * power}px,${2 * power}px)` }, { transform: "translate(0,0)" },
  ], { duration: 190, easing: "linear" });
}

async function physics(ctx, m, { dropFromTop = false } = {}) {
  const M = await loadMatter();
  const { Engine, Bodies, Composite, Body, Events } = M;
  const W = m.W1, H = m.H1, T = 200;
  const engine = Engine.create({ gravity: { x: 0, y: 1.9 } });
  Composite.add(engine.world, [
    Bodies.rectangle(W / 2, H + T / 2, W * 3, T, { isStatic: true, friction: .9 }),
    Bodies.rectangle(-T / 2, H / 2 - H, T, H * 4, { isStatic: true }),
    Bodies.rectangle(W + T / 2, H / 2 - H, T, H * 4, { isStatic: true }),
  ]);
  const items = m.pairs.map((p) => {
    const w = Math.max(6, p.l.w), h = Math.max(6, p.l.h);
    let cx = p.f.x + p.f.w / 2, cy = p.f.y + p.f.h / 2;
    if (dropFromTop) cy = cy - H - rand(0, H * .6);
    cx = Math.min(W - w / 2, Math.max(w / 2, cx));
    const round = p.el.classList.contains("p-av") || p.el.classList.contains("p-star");
    const opts = { restitution: .38, friction: .35, frictionAir: .012, density: .0018 };
    const body = round ? Bodies.circle(cx, cy, Math.min(w, h) / 2, opts) : Bodies.rectangle(cx, cy, w, h, { ...opts, chamfer: { radius: Math.min(w, h) * .12 } });
    Body.setAngularVelocity(body, rand(-.12, .12));
    Body.setVelocity(body, { x: rand(-3, 3), y: dropFromTop ? rand(0, 4) : rand(-6, -1) });
    return { p, body, lx: p.l.x + p.l.w / 2, ly: p.l.y + p.l.h / 2 };
  });
  Composite.add(engine.world, items.map((i) => i.body));

  let pows = 0, lastPow = 0;
  Events.on(engine, "collisionStart", (ev) => {
    const now = performance.now();
    for (const pr of ev.pairs) {
      const a = pr.bodyA, b = pr.bodyB;
      const sp = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (sp > 9 && pows < 4 && now - lastPow > 140) {
        const s = pr.collision.supports[0] || a.position;
        pow(ctx, s.x, s.y);
        shake(ctx, Math.min(1.6, sp / 12));
        buzz(14);
        pows++; lastPow = now;
      }
    }
  });

  const draw = () => items.forEach(({ p, body, lx, ly }) => {
    p.el.style.transform = `translate(${body.position.x - lx}px,${body.position.y - ly}px) rotate(${body.angle}rad)`;
  });
  draw();
  const t0 = performance.now();
  let tp = t0;
  await new Promise((res) => {
    (function step(now) {
      let n = Math.min(4, Math.round((now - tp) / (1000 / 60)) || 1);
      while (n--) Engine.update(engine, 1000 / 60);
      tp = now;
      draw();
      if (now - t0 < 1250) requestAnimationFrame(step); else res();
    })(t0);
  });

  // Stack back up from the bottom of the layout to the top.
  const order = [...items].sort((a, b) => (b.p.l.y + b.p.l.h) - (a.p.l.y + a.p.l.h));
  await Promise.all(order.map(({ p, body, lx, ly }, i) => {
    const from = `translate(${body.position.x - lx}px,${body.position.y - ly}px) rotate(${body.angle}rad)`;
    p.el.style.transform = "";
    return wait(i * 55).then(() => play(p.el, [
      { transform: from },
      { transform: "translate(0,-14%) rotate(0rad) scale(1.08,.92)", offset: .75 },
      { transform: "translate(0,0) rotate(0rad) scale(1,1)" },
    ], { duration: 520, easing: "cubic-bezier(.35,1.2,.5,1)", fill: "backwards" })).then(() => { if (i % 3 === 0) buzz(6); });
  }));
  Composite.clear(engine.world, false);
  Engine.clear(engine);
}

async function pop(ctx) {
  const m = ctx.switch();
  await ctx.resize(m, { duration: 300, easing: SPRING });
  try { await physics(ctx, m); }
  catch { await Promise.all(m.pairs.map((p, i) => ctx.flip(p, { duration: 700, easing: SPRING, delay: i * 25 }))); }
  ctx.done(m);
}
async function popEnter(ctx) {
  const m = ctx.freeze();
  m.pairs.forEach(({ el }) => (el.style.transform = "translateY(-200vh)"));
  try { await physics(ctx, m, { dropFromTop: true }); }
  catch { m.pairs.forEach(({ el }) => (el.style.transform = "")); }
  ctx.done(m);
}

/* ---------- 6 INK: characters bleed out like ink in water, re-form, and the seal stamps down ---------- */
async function ink(ctx) {
  let els = ctx.els();
  await Promise.all(els.map((el, i) => play(el, [
    { filter: "blur(0)", opacity: 1, transform: "scale(1)" },
    { filter: "blur(2.4cqmin)", opacity: 0, transform: "scale(1.22)" },
  ], { duration: 560, easing: "cubic-bezier(.4,0,.6,1)", delay: i * 70, fill: "forwards" })));
  els.forEach((el) => { el.style.opacity = "0"; el.getAnimations().forEach((a) => a.cancel()); });
  const m = ctx.switch();
  m.pairs.forEach(({ el }) => (el.style.opacity = "0"));
  ctx.resize(m, { duration: 700, easing: EASE });
  await wait(200);
  const seal = m.pairs.find((p) => p.el.classList.contains("i-seal"));
  await Promise.all(m.pairs.filter((p) => p !== seal).map(({ el }, i) => {
    el.style.opacity = "";
    return play(el, [
      { filter: "blur(2.8cqmin)", opacity: 0, transform: "scale(.82)" },
      { filter: "blur(.6cqmin)", opacity: .8, offset: .6 },
      { filter: "blur(0)", opacity: 1, transform: "none" },
    ], { duration: 820, easing: "cubic-bezier(.2,.7,.2,1)", delay: i * 110, fill: "backwards" });
  }));
  if (seal) {
    seal.el.style.opacity = "";
    await play(seal.el, [
      { transform: "scale(2.6) rotate(-14deg)", opacity: 0 },
      { transform: "scale(.9) rotate(3deg)", opacity: 1, offset: .62 },
      { transform: "scale(1.04) rotate(-1deg)", opacity: 1, offset: .82 },
      { transform: "none", opacity: 1 },
    ], { duration: 460, easing: "cubic-bezier(.5,0,.6,1)", fill: "backwards" });
    shake(ctx, .8);
    buzz(18);
    const rip = ctx.face.querySelector(".i-ripple");
    if (rip) {
      const r = ctx.rel(seal.el);
      rip.style.left = r.x + r.w / 2 - rip.offsetWidth / 2 + "px";
      rip.style.top = r.y + r.h / 2 - rip.offsetHeight / 2 + "px";
      play(rip, [{ transform: "scale(.3)", opacity: .7 }, { transform: "scale(2.2)", opacity: 0 }], { duration: 900, easing: "ease-out" });
    }
  }
  ctx.done(m);
}

/* ---------- 7 AURORA: light pools flow like liquid; the glass panel stretches and springs back ---------- */
async function aurora(ctx) {
  const m = ctx.switch();
  ctx.resize(m, { duration: 1100, easing: "cubic-bezier(.34,1.25,.5,1)" });
  await Promise.all(m.pairs.map((p) => {
    const { f, l } = p;
    const dx = f.x + f.w / 2 - (l.x + l.w / 2), dy = f.y + f.h / 2 - (l.y + l.h / 2);
    const sx = f.w / l.w, sy = f.h / l.h;
    if (p.el.classList.contains("a-glass")) {
      return play(p.el, [
        { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` },
        { transform: "translate(0,0) scale(1.07,.93)", offset: .55 },
        { transform: "translate(0,0) scale(.98,1.025)", offset: .78 },
        { transform: "translate(0,0) scale(1,1)" },
      ], { duration: 1150, easing: "cubic-bezier(.45,0,.3,1)", fill: "backwards" });
    }
    return ctx.flip(p, { duration: 1000, easing: "cubic-bezier(.34,1.4,.5,1)", delay: 120 });
  }));
  ctx.done(m);
}

/* ---------- 8 BLUEPRINT: exploded view — parts fly apart, then reassemble on the new drawing ---------- */
async function blueprint(ctx) {
  const W = ctx.W(), H = ctx.H();
  const els = ctx.els();
  const kick = new Map();
  await Promise.all(els.map((el) => {
    const r = ctx.rel(el);
    const vx = r.x + r.w / 2 - W / 2, vy = r.y + r.h / 2 - H / 2;
    const len = Math.hypot(vx, vy) || 1;
    const k = { x: (vx / len) * Math.max(W, H) * .32, y: (vy / len) * Math.max(W, H) * .32, r: rand(-22, 22) };
    kick.set(el, k);
    return play(el, [{ transform: "none", opacity: 1 }, { transform: `translate(${k.x}px,${k.y}px) rotate(${k.r}deg) scale(.9)`, opacity: .55 }], { duration: 430, easing: "cubic-bezier(.3,0,.7,.4)", fill: "forwards" });
  }));
  els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
  const m = ctx.switch();
  ctx.resize(m, { duration: 520, easing: SNAP });
  const dim = ctx.face.querySelector(".bp-dim");
  await Promise.all(m.pairs.map((p, i) => {
    const k = kick.get(p.el) || { x: 0, y: 0, r: 0 };
    const { f, l } = p;
    const dx = f.x + f.w / 2 - (l.x + l.w / 2) + k.x, dy = f.y + f.h / 2 - (l.y + l.h / 2) + k.y;
    if (p.el === dim) { p.el.style.opacity = "0"; return Promise.resolve(); }
    return play(p.el, [
      { transform: `translate(${dx}px,${dy}px) rotate(${k.r}deg) scale(.9)`, opacity: .55 },
      { transform: "none", opacity: 1 },
    ], { duration: 700, easing: "cubic-bezier(.2,.9,.2,1)", delay: 60 + i * 75, fill: "backwards" });
  }));
  if (dim) dim.style.opacity = "";
  if (dim) await play(dim, [{ transform: "scaleX(0)", opacity: 1 }, { transform: "scaleX(1)", opacity: 1 }], { duration: 420, easing: "ease-out", fill: "backwards" });
  ctx.done(m);
  const part = ctx.face.querySelector(".bp-part");
  if (part) { part.classList.remove("draw"); void part.offsetWidth; part.classList.add("draw"); }
}

export const MORPHS = {
  default: { morph: (ctx) => basic(ctx), enter: rise },
  obsidian: { morph: obsidian, enter: async (ctx) => { await rise(ctx); engrave(ctx.face); } },
  holo: { morph: holo, enter: rise },
  terminal: { morph: terminal, enter: rise },
  swiss: { morph: swiss, enter: rise },
  pop: { morph: pop, enter: popEnter },
  ink: { morph: ink, enter: rise },
  aurora: { morph: aurora, enter: rise },
  blueprint: { morph: blueprint, enter: async (ctx) => { const p = ctx.face.querySelector(".bp-part"); p && p.classList.add("draw"); await rise(ctx); } },
};
