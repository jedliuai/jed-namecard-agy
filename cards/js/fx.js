// Live drawings that CSS cannot do: the blueprint's rotating 3D tower and the helix style's DNA.
// Each drawing gets a controller on its element (el._fx) so morphs can poke it.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TAU = Math.PI * 2;
const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));
const f1 = (n) => n.toFixed(1);

/* ---------- Blueprint: a twisting super-tall tower (Shanghai Tower massing), hidden lines dashed ---------- */
function tower(svg) {
  const front = svg.querySelector(".t-front"), back = svg.querySelector(".t-back");
  const RINGS = 26, SEG = 42, MULL = 6, TOP = 0.86, TWIST = (120 * Math.PI) / 180;
  const pitch = (22 * Math.PI) / 180, cp = Math.cos(pitch), sp = Math.sin(pitch);
  const S = 74, CX = 46, GY = 90;
  const radius = (h) => 0.19 * (1 - 0.44 * Math.min(h, TOP));
  const plan = (t) => 1 + 0.12 * Math.cos(3 * t);       // rounded triangle
  let yaw = 0.6, build = 1, b0 = 0, bDur = 0;

  function project(x, y, z) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const xr = x * c + z * s, zr = -x * s + z * c;
    return [CX + xr * S, GY - (y * cp - zr * sp) * S];
  }
  // Is the outward direction at plan angle `psi` facing the camera?
  const faces = (psi) => -Math.sin(yaw) * Math.cos(psi) + Math.cos(yaw) * Math.sin(psi) > -0.08;

  function shellPoint(h, t) {
    const psi = t + h * TWIST, r = radius(h) * plan(t);
    return { p: project(Math.cos(psi) * r, h, Math.sin(psi) * r), psi };
  }

  function draw(now) {
    if (bDur) { build = ease((now - b0) / bDur); if (build >= 1) bDur = 0; }
    const lim = build * 1.04;
    let F = "", B = "";
    const seg = (a, b, vis) => { const s = `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`; vis ? (F += s) : (B += s); };

    // Ground: plaza square and axes.
    const g = 0.44, sq = [[-g, -g], [g, -g], [g, g], [-g, g]].map(([x, z]) => project(x, 0, z));
    for (let i = 0; i < 4; i++) seg(sq[i], sq[(i + 1) % 4], true);
    // Podium: a low drum.
    const pr = 0.3, ph = 0.045;
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * TAU, a1 = ((i + 1) / SEG) * TAU, vis = faces((a0 + a1) / 2);
      for (const y of [0, ph]) if (build > 0 || y === 0) seg(project(Math.cos(a0) * pr, y, Math.sin(a0) * pr), project(Math.cos(a1) * pr, y, Math.sin(a1) * pr), vis || y === ph);
      if (i % 6 === 0 && build > 0.02) seg(project(Math.cos(a0) * pr, 0, Math.sin(a0) * pr), project(Math.cos(a0) * pr, ph, Math.sin(a0) * pr), faces(a0));
    }
    // Floor plates.
    for (let k = 0; k < RINGS; k++) {
      const h = ph + (k / (RINGS - 1)) * (TOP - ph);
      if (h > lim) break;
      let prev = shellPoint(h, 0);
      for (let i = 1; i <= SEG; i++) {
        const cur = shellPoint(h, (i / SEG) * TAU);
        seg(prev.p, cur.p, faces((prev.psi + cur.psi) / 2) || k === RINGS - 1);
        prev = cur;
      }
    }
    // Mullions that follow the twist.
    for (let m = 0; m < MULL; m++) {
      const t = (m / MULL) * TAU + Math.PI / MULL;
      let prev = shellPoint(ph, t);
      for (let k = 1; k <= 40; k++) {
        const h = ph + (k / 40) * (TOP - ph);
        if (h > lim) break;
        const cur = shellPoint(h, t);
        seg(prev.p, cur.p, faces(cur.psi));
        prev = cur;
      }
    }
    // Crown and spire.
    if (lim > TOP) {
      const rc = radius(TOP) * 0.92, tops = [TOP + 0.03, TOP + 0.07];
      for (const y of tops) for (let i = 0; i < SEG; i += 2) {
        const a0 = (i / SEG) * TAU, a1 = ((i + 2) / SEG) * TAU;
        if (y <= lim) seg(project(Math.cos(a0) * rc, y, Math.sin(a0) * rc), project(Math.cos(a1) * rc, y, Math.sin(a1) * rc), faces((a0 + a1) / 2));
      }
      if (lim > 0.97) seg(project(0, TOP + 0.07, 0), project(0, 1, 0), true);
    }
    front.setAttribute("d", F);
    back.setAttribute("d", B);
  }
  return {
    step(now, dt) { yaw += dt * (reduce ? 0 : 0.00028); draw(now); },
    build(ms = 1500) { b0 = performance.now(); bDur = ms; build = 0; },
  };
}

/* ---------- Helix: a DNA double helix that turns; it can unzip during a morph ---------- */
function helix(el) {
  const svg = el.querySelector("svg");
  const P = Object.fromEntries(["ab", "bb", "af", "bf", "rungs", "nodes"].map((k) => [k, svg.querySelector(".hx-" + k)]));
  const PAIRS = [["#ff6b6b", "#ffb648"], ["#12b5a5", "#7a6cf0"], ["#ffb648", "#ff6b6b"], ["#7a6cf0", "#12b5a5"]];
  const R = 22, TURNS = 2.4;
  const rungs = [], nodes = [];
  const NS = "http://www.w3.org/2000/svg";
  for (let k = 0; k < R; k++) {
    const pair = PAIRS[(k * 7 + (k >> 1)) % 4];
    const a = document.createElementNS(NS, "line"), b = document.createElementNS(NS, "line");
    a.setAttribute("stroke", pair[0]); b.setAttribute("stroke", pair[1]);
    P.rungs.append(a, b);
    rungs.push([a, b]);
    const na = document.createElementNS(NS, "circle"), nb = document.createElementNS(NS, "circle");
    na.setAttribute("fill", "#0b2545"); nb.setAttribute("fill", "#12b5a5");
    P.nodes.append(na, nb);
    nodes.push([na, nb]);
  }
  let phase = 0, z0 = 0, zDur = 0, w = 0, h = 0;

  function step(now, dt) {
    const W = el.offsetWidth, H = el.offsetHeight;
    if (!W || !H) return;
    if (W !== w || H !== h) { w = W; h = H; svg.setAttribute("viewBox", `0 0 ${w} ${h}`); }
    const vert = h >= w, L = vert ? h : w, T = vert ? w : h;
    let zip = 0;
    if (zDur) { const t = (now - z0) / zDur; if (t >= 1) zDur = 0; else zip = Math.sin(Math.PI * t); }
    phase += dt * (reduce ? 0 : 0.0011 * (1 + zip * 5));
    const A = T * 0.34 * (1 + zip * 0.45), pad = T * 0.25, sw = Math.max(1.2, T * 0.05);
    const at = (u, off) => {
      const th = u * TURNS * TAU + phase + off, s = A * Math.sin(th), d = Math.cos(th);
      const along = pad + u * (L - 2 * pad);
      return { x: vert ? T / 2 + s : along, y: vert ? along : T / 2 + s, d };
    };
    const N = 90, paths = { af: "", ab: "", bf: "", bb: "" };
    for (const [key, off] of [["a", 0], ["b", Math.PI]]) {
      let prev = at(0, off);
      for (let i = 1; i <= N; i++) {
        const cur = at(i / N, off), k = key + (prev.d + cur.d > 0 ? "f" : "b");
        paths[k] += `M${f1(prev.x)} ${f1(prev.y)}L${f1(cur.x)} ${f1(cur.y)}`;
        prev = cur;
      }
    }
    for (const k in paths) { P[k].setAttribute("d", paths[k]); P[k].setAttribute("stroke-width", sw); }
    rungs.forEach(([la, lb], k) => {
      const u = (k + 0.5) / R, a = at(u, 0), b = at(u, Math.PI);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, op = (0.35 + 0.55 * Math.abs(Math.sin(u * TURNS * TAU + phase))) * (1 - zip);
      for (const [l, p] of [[la, a], [lb, b]]) {
        l.setAttribute("x1", f1(p.x)); l.setAttribute("y1", f1(p.y)); l.setAttribute("x2", f1(mx)); l.setAttribute("y2", f1(my));
        l.setAttribute("stroke-width", f1(sw * 0.7)); l.setAttribute("opacity", op.toFixed(2));
      }
      const [na, nb] = nodes[k];
      for (const [n, p] of [[na, a], [nb, b]]) {
        n.setAttribute("cx", f1(p.x)); n.setAttribute("cy", f1(p.y));
        n.setAttribute("r", f1(sw * (0.75 + 0.35 * p.d)));
        n.setAttribute("opacity", (0.45 + 0.55 * (p.d + 1) / 2).toFixed(2));
      }
    });
  }
  return { step, unzip(ms = 1200) { z0 = performance.now(); zDur = ms; } };
}

export function mountLive(style, faces) {
  const items = [];
  for (const face of faces) {
    face.querySelectorAll(".bp-3d").forEach((svg) => { svg._fx = tower(svg); items.push(svg._fx); });
    face.querySelectorAll(".x-helix").forEach((el) => { el._fx = helix(el); items.push(el._fx); });
  }
  let alive = items.length > 0, last = performance.now();
  function loop(now) {
    if (!alive) return;
    const dt = Math.min(64, now - last);
    last = now;
    items.forEach((it) => it.step(now, dt));
    requestAnimationFrame(loop);
  }
  if (alive) requestAnimationFrame(loop);
  return { destroy() { alive = false; } };
}
