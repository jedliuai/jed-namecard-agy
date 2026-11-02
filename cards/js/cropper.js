// Crop frame for photos and QR codes: drag to move, pinch / scroll / slider to zoom, then the square
// inside the frame is saved as a JPEG. For QR codes it starts zoomed onto the code and says so if the
// result can't be read: the browser's BarcodeDetector where there is one, else jsQR, loaded on first use.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const JSQR = { src: "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js", sri: "sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx" };
let jsqr;
const loadJsQR = () => jsqr || (jsqr = new Promise((res, rej) => {
  const sc = Object.assign(document.createElement("script"), { src: JSQR.src, integrity: JSQR.sri, crossOrigin: "anonymous" });
  sc.onload = () => (window.jsQR ? res(window.jsQR) : rej(new Error("jsQR missing")));
  sc.onerror = () => { jsqr = null; rej(new Error("jsQR failed to load")); };
  document.head.appendChild(sc);
}));

// The QR code's box in the source's own pixels, or null. Never throws.
async function findQR(source, w, h) {
  try {
    if ("BarcodeDetector" in window) {
      const [hit] = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(source);
      return hit ? hit.boundingBox : null;
    }
    const read = await loadJsQR();
    const k = Math.min(1, 1000 / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
    const c = Object.assign(document.createElement("canvas"), { width: cw, height: ch });
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(source, 0, 0, cw, ch);
    const hit = read(g.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: "attemptBoth" });
    if (!hit) return null;
    const p = hit.location, xs = [p.topLeftCorner, p.topRightCorner, p.bottomLeftCorner, p.bottomRightCorner];
    const x0 = Math.min(...xs.map((q) => q.x)), x1 = Math.max(...xs.map((q) => q.x));
    const y0 = Math.min(...xs.map((q) => q.y)), y1 = Math.max(...xs.map((q) => q.y));
    return { x: x0 / k, y: y0 / k, width: (x1 - x0) / k, height: (y1 - y0) / k };
  } catch { return null; }
}

function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That file isn't a picture we can read. Try a JPG or PNG.")); };
    img.src = url;
  });
}

// Resolves to { blob, readable } (readable: false when a QR crop could not be read, null if unknown),
// or null when the person cancels.
export async function cropImage(file, { title = "Crop", round = false, qr = false, size = 640, quality = 0.88 } = {}) {
  const { img, url } = await loadImage(file);
  const W = img.naturalWidth, H = img.naturalHeight;
  const el = document.createElement("div");
  el.className = "crop";
  el.innerHTML = `
    <div class="crop-box" role="dialog" aria-modal="true" aria-label="${title}">
      <h3>${title}</h3>
      <div class="crop-view${round ? " round" : ""}"><img src="${url}" alt="" draggable="false"><i class="crop-frame"></i></div>
      <input class="crop-zoom" type="range" min="0" max="1" step="0.001" value="0" aria-label="Zoom">
      <p class="crop-hint">${qr ? "Fit the whole code inside the frame." : "Drag to move."} Pinch, scroll or slide to zoom.</p>
      <div class="crop-btns"><button type="button" class="ed-link" data-no>Cancel</button><button type="button" class="ed-btn" data-ok>Use this</button></div>
    </div>`;
  document.body.appendChild(el);
  const view = el.querySelector(".crop-view"), pic = view.querySelector("img"), zoom = el.querySelector(".crop-zoom");

  let V = view.clientWidth;
  const sMin = () => V / Math.min(W, H);                  // the picture always covers the frame
  const sMax = () => sMin() * 8;
  let s = sMin(), tx = (V - W * s) / 2, ty = (V - H * s) / 2;
  function apply() {
    s = clamp(s, sMin(), sMax());
    tx = clamp(tx, V - W * s, 0);
    ty = clamp(ty, V - H * s, 0);
    pic.style.width = W * s + "px";
    pic.style.transform = `translate(${tx}px,${ty}px)`;
    zoom.value = Math.log(s / sMin()) / Math.log(sMax() / sMin());
  }
  // Zoom to `ns`, keeping the picture point under (cx, cy) in place.
  function zoomAt(ns, cx, cy) {
    ns = clamp(ns, sMin(), sMax());
    tx = cx - ((cx - tx) * ns) / s;
    ty = cy - ((cy - ty) * ns) / s;
    s = ns;
    apply();
  }
  apply();
  if (qr) {
    const box = await findQR(img, W, H);
    if (box) {
      const side = Math.max(box.width, box.height) * 1.16;
      s = V / side;
      tx = -(box.x + box.width / 2) * s + V / 2;
      ty = -(box.y + box.height / 2) * s + V / 2;
      apply();
    }
  }

  const pts = new Map();
  let pinch = null;
  view.addEventListener("pointerdown", (e) => {
    view.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s };
    }
  });
  view.addEventListener("pointermove", (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const r = view.getBoundingClientRect();
    if (pts.size === 1) {
      tx += e.clientX - p.x;
      ty += e.clientY - p.y;
      apply();
    }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      zoomAt(pinch.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  view.addEventListener("pointerup", up);
  view.addEventListener("pointercancel", up);
  view.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = view.getBoundingClientRect();
    zoomAt(s * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  zoom.addEventListener("input", () => zoomAt(sMin() * Math.pow(sMax() / sMin(), Number(zoom.value)), V / 2, V / 2));
  const onResize = () => {
    const nV = view.clientWidth;
    if (!nV || nV === V) return;
    const k = nV / V;
    V = nV; s *= k; tx *= k; ty *= k;
    apply();
  };
  addEventListener("resize", onResize);

  const answer = await new Promise((res) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-ok]")) res(true);
      else if (e.target.closest("[data-no]") || e.target === el) res(false);
    });
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") res(false); });
    el.querySelector("[data-ok]").focus();
  });
  removeEventListener("resize", onResize);
  el.remove();
  if (!answer) { URL.revokeObjectURL(url); return null; }

  const side = V / s, out = Math.round(Math.min(size, side));
  const c = Object.assign(document.createElement("canvas"), { width: out, height: out });
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, out, out);
  g.drawImage(img, -tx / s, -ty / s, side, side, 0, 0, out, out);
  URL.revokeObjectURL(url);
  const readable = qr ? !!(await findQR(c, out, out)) : null;
  const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", quality));
  return { blob, readable };
}
