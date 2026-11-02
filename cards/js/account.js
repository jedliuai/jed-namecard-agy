// Account panel: email sign-in on PocketBase, plan status, Paddle checkout for Pro and share packs,
// and share-pack exports of the user's saved card (rendered on the server, downloaded from here).
// Also keeps that saved card for the editor (editor.js); "nc:account" fires whenever it or the sign-in changes.
// Payments are only trusted once Paddle's signed webhook has updated the user's entitlement on the server.
import { API, TURNSTILE } from "./config.js";
import { STYLES } from "./templates.js";

const STORE = "nc-auth";
const PRODUCTS = {
  pro: { label: "Go Pro · $9.90 / year", note: "Every style, your own link, unlimited video, GIF and JPG exports." },
  share_pack: { label: "Buy a share pack · $2.99", note: "One HD set of a style: MP4 video, GIF and JPG." },
};

let auth = read();
let ent = null;
let exportsList = [];
let fileToken = "";
let busy = "";
let error = "";
let dialog;
let current = () => null;   // the style on screen: { style }
let polling = null;
let card = null;            // the user's saved card record, if any

function read() {
  try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch { return null; }
}
function save(a) {
  auth = a;
  try { a ? localStorage.setItem(STORE, JSON.stringify(a)) : localStorage.removeItem(STORE); } catch {}
}

async function pb(path, { method = "GET", body } = {}) {
  const form = body instanceof FormData;
  const headers = form ? {} : { "content-type": "application/json" };
  if (auth) headers.authorization = auth.token;
  const r = await fetch(API + path, { method, headers, body: body && (form ? body : JSON.stringify(body)) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d.message || "Request failed");
    e.status = r.status;
    e.data = d.data || {};
    throw e;
  }
  return d;
}

// Sign-in is an emailed 6-digit code; a first code also creates the account (deploy/pb_hooks/auth.pb.js).
let codeFor = null;   // { email, otpId } once a code has been sent

// Cloudflare Turnstile: each code request carries a fresh token that the backend checks. Most people
// never see it; a suspicious browser gets a one-click challenge shown in the panel.
let tsBox = null;
let tsScript = null;
function humanToken() {
  if (!TURNSTILE) return Promise.resolve("");
  tsScript = tsScript || new Promise((res, rej) => {
    const sc = Object.assign(document.createElement("script"), { src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", async: true });
    sc.onload = () => res(window.turnstile);
    sc.onerror = () => { tsScript = null; rej(new Error("Turnstile failed to load")); };
    document.head.appendChild(sc);
  });
  return tsScript.then((ts) => new Promise((res, rej) => {
    const el = document.createElement("div");
    tsBox.replaceChildren(el);
    const id = ts.render(el, {
      sitekey: TURNSTILE, appearance: "interaction-only", theme: "dark",
      callback: (t) => { res(t); setTimeout(() => ts.remove(id), 0); },
      "error-callback": () => { rej(new Error("human check failed")); ts.remove(id); },
      "timeout-callback": () => { rej(new Error("human check timed out")); ts.remove(id); },
    });
  }));
}

async function sendCode(email) {
  const turnstile = await humanToken();
  const d = await pb("/api/collections/users/request-otp", { method: "POST", body: { email, turnstile } });
  codeFor = { email, otpId: d.otpId };
}

async function signInWithCode(code) {
  const d = await pb("/api/collections/users/auth-with-otp", { method: "POST", body: { otpId: codeFor.otpId, password: code } });
  save({ token: d.token, user: { id: d.record.id, email: d.record.email } });
  codeFor = null;
}

async function refresh() {
  if (!auth) return;
  try {
    const d = await pb("/api/collections/users/auth-refresh", { method: "POST" });
    save({ token: d.token, user: { id: d.record.id, email: d.record.email } });
  } catch (e) {
    // Expired token or deleted account; a token that just can't be renewed stays usable until it expires.
    if (e.status === 401 || e.status === 404) save(null);
  }
}

const emit = () => document.dispatchEvent(new Event("nc:account"));

async function loadCard() {
  card = null;
  if (auth) card = (await pb("/api/collections/cards/records?perPage=1")).items[0] || null;
  emit();
}

export const signedIn = () => !!auth;
export const hasPro = () => proActive();
export const savedCard = () => card;
export const openAccount = () => open();

// A saved card as the templates want it; the photo is served by the backend.
export function cardData(rec) {
  if (!rec) return null;
  const d = {};
  for (const k of ["name", "sub", "title", "company", "phone", "wa", "email", "slug", "stat", "greet", "industry", "no", "im", "wechat"]) if (rec[k]) d[k] = rec[k];
  if (!d.wa && d.phone && d.im !== "wechat") d.wa = d.phone;   // most people use one number for both
  const file = (name) => `${API}/api/files/${rec.collectionId}/${rec.id}/${encodeURIComponent(name)}`;
  if (rec.avatar) d.avatar = file(rec.avatar);
  if (rec.qr) d.qr = file(rec.qr);
  return d;
}

// fields: the card's text fields. photo, qr: a Blob to upload, false to remove it, undefined to keep it.
export async function saveCard(fields, photo, qr) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v ?? "");
  for (const [name, blob] of [["avatar", photo], ["qr", qr]]) {
    if (blob) body.append(name, blob, name + ".jpg");
    else if (blob === false) body.append(name, "");
  }
  if (card) card = await pb(`/api/collections/cards/records/${card.id}`, { method: "PATCH", body });
  else {
    body.append("user", auth.user.id);
    card = await pb("/api/collections/cards/records", { method: "POST", body });
  }
  emit();
  return card;
}

async function loadEntitlement() {
  ent = null;
  if (!auth) return;
  const d = await pb("/api/collections/entitlements/records?perPage=1");
  ent = d.items[0] || null;
  syncPaddleCustomer();
}

async function loadExports() {
  exportsList = [];
  if (!auth) return;
  exportsList = (await pb("/api/collections/exports/records?sort=-created&perPage=4")).items;
  // Export files are private; a short-lived file token makes the download links work.
  if (exportsList.some((x) => x.status === "done")) fileToken = (await pb("/api/files/token", { method: "POST" })).token;
}

const pending = () => exportsList.some((x) => x.status === "queued" || x.status === "rendering");

// While an export is being made, check every few seconds (only while the panel is open).
function watch() {
  clearTimeout(polling);
  if (!pending() || !dialog.open) return;
  polling = setTimeout(async () => {
    const was = pending();
    try { await loadExports(); } catch {}
    if (was && !pending()) try { await loadEntitlement(); } catch {}
    render();
    watch();
  }, 5000);
}

async function orderExport() {
  const c = current();
  if (!c) return;
  error = "";
  busy = "Starting your export…";
  render();
  try {
    await pb("/api/exports", { method: "POST", body: { style: c.style } });
    await Promise.all([loadExports(), loadEntitlement()]);
  } catch (e) {
    error = e.status === 401 ? "Please sign in again." : e.message;
  }
  busy = "";
  render();
  watch();
}

const proActive = () => !!ent && !!ent.pro_until && new Date(ent.pro_until.replace(" ", "T")) > new Date();
const credits = () => (ent && ent.export_credits) || 0;

// Which Paddle account (sandbox or live), its client token and price IDs come from the server
// (deploy/paddle.env.example), so going live is a server setting, not a code change.
let paddleCfg;
const paddleConfig = () => (paddleCfg ||= pb("/api/paddle/config").catch((e) => { paddleCfg = null; throw e; }));
// Paddle Retain needs the signed-in buyer's Paddle customer ID (ctm_…), never our own user ID or email.
const pwCustomer = () => (ent && ent.paddle_customer_id ? { id: ent.paddle_customer_id } : {});

let paddleReady;
function paddle() {
  paddleReady ||= paddleConfig().then((cfg) => new Promise((resolve, reject) => {
    if (!cfg.token) return reject(new Error("Checkout isn't available right now."));
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.onload = () => {
      // Live is Paddle.js's default; only the sandbox needs saying.
      if (cfg.env === "sandbox") window.Paddle.Environment.set("sandbox");
      window.Paddle.Initialize({ token: cfg.token, pwCustomer: pwCustomer(), eventCallback: onPaddle });
      resolve(window.Paddle);
    };
    s.onerror = () => { paddleReady = null; reject(new Error("Could not load checkout")); };
    document.head.appendChild(s);
  })).catch((e) => { paddleReady = null; throw e; });
  return paddleReady;
}

// Once the buyer's Paddle customer ID is known (after their first purchase), tell Paddle.js, and on
// live load it for signed-in customers so Retain can reach them about failed renewals.
async function syncPaddleCustomer() {
  if (!ent || !ent.paddle_customer_id) return;
  try {
    const cfg = await paddleConfig();
    if (window.Paddle && paddleReady) window.Paddle.Update({ pwCustomer: pwCustomer() });
    else if (cfg.env === "live") await paddle();
  } catch {}
}

async function buy(sku) {
  error = "";
  busy = "Opening checkout…";
  render();
  try {
    const [P, cfg] = await Promise.all([paddle(), paddleConfig()]);
    // A modal dialog sits in the browser's top layer, above Paddle's overlay, so step aside.
    dialog.close();
    paying = false;
    P.Checkout.open({
      items: [{ priceId: cfg.prices[sku], quantity: 1 }],
      customer: { email: auth.user.email },
      customData: { user_id: auth.user.id },
      settings: { displayMode: "overlay", theme: "dark", allowLogout: false },
    });
    busy = "";
  } catch (e) {
    busy = "";
    error = e.message;
  }
  render();
}

// Paddle reports the payment in the browser first; the plan changes only when the webhook lands.
let paying = false;
async function onPaddle(ev) {
  if (ev.name === "checkout.closed" && !paying) return open();
  if (ev.name === "checkout.error") {
    console.warn("Paddle checkout error", ev.error || ev.data);
    try { window.Paddle.Checkout.close(); } catch {}
    error = "Checkout couldn't open right now. Please try again in a moment.";
    return open();
  }
  if (ev.name !== "checkout.completed") return;
  paying = true;
  const before = JSON.stringify([proActive(), credits()]);
  busy = "Payment received. Unlocking…";
  open();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try { await loadEntitlement(); } catch {}
    if (JSON.stringify([proActive(), credits()]) !== before) break;
  }
  busy = "";
  if (JSON.stringify([proActive(), credits()]) === before) error = "Payment is still being confirmed. Check back in a minute.";
  try { window.Paddle.Checkout.close(); } catch {}
  open();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const day = (s) => new Date(s.replace(" ", "T")).toLocaleDateString(document.documentElement.lang || undefined, { year: "numeric", month: "short", day: "numeric" });

const styleName = (id) => (STYLES.find((s) => s.id === id) || { name: id }).name;
const FILE_LABELS = [[/\.mp4$/, "Video"], [/\.gif$/, "GIF"], [/_front_/, "Front"], [/_back_/, "Back"], [/_landscape_/, "Landscape"]];

function exportSection(pro) {
  const c = current();
  let action = "";
  if (c && !card) {
    action = `
      <div class="acct-export">
        <b>Make your own card</b>
        <p>Add your name, contacts and photo, then export it as a video, GIF and images.</p>
        <button class="acct-go" data-edit>Create my card</button>
      </div>`;
  } else if (c) {
    const can = pro || credits() > 0;
    const what = pro ? "included in Pro" : credits() > 0 ? "uses 1 share pack" : "";
    action = `
      <div class="acct-export">
        <b>Export your card in ${esc(styleName(c.style))} style</b>
        <p>An HD vertical video with music, a looping GIF and 3 images of your saved card, made on our server in about 3 minutes.</p>
        ${can ? `<button class="acct-go" data-export ${pending() ? "data-wait" : ""}>Export · ${what}</button>` : `<p class="acct-note">Get Pro or a share pack below to export.</p>`}
      </div>`;
  }
  const rows = exportsList.map((x) => {
    let state;
    if (x.status === "done") {
      const rank = (f) => FILE_LABELS.findIndex(([re]) => re.test(f));
      state = [...(x.files || [])].sort((a, b) => rank(a) - rank(b)).map((f) => {
        const label = (FILE_LABELS.find(([re]) => re.test(f)) || [, "File"])[1];
        const url = `${API}/api/files/${x.collectionId}/${x.id}/${encodeURIComponent(f)}?token=${fileToken}&download=1`;
        return `<a href="${esc(url)}">${label}</a>`;
      }).join("");
    } else if (x.status === "failed") {
      state = `<em>Didn't work${x.paid_with === "credit" ? " · share pack refunded" : ""}</em>`;
    } else {
      state = `<em class="acct-spin">${x.status === "queued" ? "Waiting in line…" : "Rendering… about 3 min"}</em>`;
    }
    return `<li><span>${esc(styleName(x.style))} · ${day(x.created)}</span><div>${state}</div></li>`;
  }).join("");
  return action + (rows ? `<ul class="acct-exports">${rows}</ul>` : "");
}

function render() {
  if (!dialog) return;
  // Keep what was typed when the panel redraws for a status line.
  const typed = dialog.querySelector(".acct-form input");
  const kept = typed && typed.value;
  let body;
  if (!auth && !codeFor) {
    body = `
      <h2>Your account</h2>
      <p class="acct-sub">Sign in or create an account with your email. We'll send you a 6-digit code, no password needed.</p>
      <form class="acct-form" data-step="email">
        <input name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
        <button class="acct-go">Email me a code</button>
      </form>`;
  } else if (!auth) {
    body = `
      <h2>Check your email</h2>
      <p class="acct-sub">We sent a 6-digit code to <b>${esc(codeFor.email)}</b>. It works for 10 minutes.</p>
      <form class="acct-form" data-step="code">
        <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="123456" required>
        <button class="acct-go">Sign in</button>
        <div class="acct-row">
          <button type="button" class="acct-alt" data-resend>Send a new code</button>
          <button type="button" class="acct-alt" data-other>Use another email</button>
        </div>
      </form>`;
  } else {
    const pro = proActive();
    const ended = { canceled: "Pro ended", refunded: "Pro refunded", chargeback: "Pro ended" };
    const plan = pro ? `Pro · until ${day(ent.pro_until)}` : (ent && ended[ent.pro_status]) || "Free plan";
    // Pro already includes every export, so nothing is for sale while it lasts.
    const buys = pro ? "" : Object.entries(PRODUCTS)
      .map(([sku, p]) => `<button class="acct-go" data-buy="${sku}">${p.label}</button><p class="acct-note">${p.note}</p>`)
      .join("");
    const packs = pro && !credits() ? "Exports included" : `Share packs: ${credits()}`;
    body = `
      <h2>Account</h2>
      <p class="acct-sub">${esc(auth.user.email)}</p>
      <div class="acct-plan"><b>${plan}</b><span>${packs}</span></div>
      ${exportSection(pro)}
      ${buys}
      <p class="acct-fine">Payments are handled by Paddle, our merchant of record.</p>
      <button class="acct-alt" data-out>Sign out</button>`;
  }
  // The Turnstile box sits outside the redrawn part: moving its iframe would restart the check.
  dialog.firstElementChild.innerHTML = `
    <button class="acct-x" data-close aria-label="Close">×</button>
    ${body}
    ${busy ? `<p class="acct-busy">${esc(busy)}</p>` : ""}
    ${error ? `<p class="acct-err">${esc(error)}</p>` : ""}`;
  const input = dialog.querySelector(".acct-form input");
  if (input && kept && input.name === typed.name) input.value = kept;
  dialog.querySelectorAll("button:not([data-close])").forEach((b) => (b.disabled = !!busy || "wait" in b.dataset));
}

async function submit(form) {
  if (!form.reportValidity()) return;
  const step = form.dataset.step;
  error = "";
  busy = step !== "email" ? "Signing in…" : TURNSTILE ? "One moment… if a box appears below, tick it." : "Sending your code…";
  render();
  try {
    if (step === "email") await sendCode(form.email.value.trim());
    else {
      await signInWithCode(form.code.value.trim());
      await Promise.all([loadEntitlement(), loadExports(), loadCard()]);
    }
  } catch (e) {
    // Our own limits explain themselves; PocketBase's per-IP limit just says "Too Many Requests."
    if (e.status === 429) error = /^too many requests/i.test(e.message) ? "Too many tries. Wait a minute and try again." : e.message;
    else if (/human/i.test(e.message)) error = "We couldn't confirm you're a person. Please try again.";
    else if (step === "email") error = e.data && e.data.email ? "Please check the email address." : "Couldn't send the code. Please try again.";
    else error = "That code is wrong or has expired.";
  }
  busy = "";
  render();
  dialog.querySelector(".acct-form input")?.focus();
}

async function resendCode() {
  error = "";
  busy = TURNSTILE ? "One moment… if a box appears below, tick it." : "Sending a new code…";
  render();
  try { await sendCode(codeFor.email); } catch (e) {
    error = e.status === 429 && !/^too many requests/i.test(e.message) ? e.message : /human/i.test(e.message) ? "We couldn't confirm you're a person. Please try again." : "Couldn't send the code. Please try again.";
  }
  busy = "";
  render();
}

async function open() {
  render();
  if (!dialog.open) dialog.showModal();
  if (auth) {
    await refresh();
    try { await Promise.all([loadEntitlement(), loadExports(), loadCard()]); } catch {}
    render();
    watch();
  }
}

// bar: where the Account button goes. getCurrent: returns the style on screen as { style }.
export function mountAccount(bar, getCurrent) {
  if (getCurrent) current = getCurrent;
  dialog = document.createElement("dialog");
  dialog.className = "acct";
  dialog.innerHTML = `<div></div><div class="acct-ts"></div>`;
  tsBox = dialog.lastElementChild;
  document.body.appendChild(dialog);
  dialog.addEventListener("click", (e) => {
    const r = dialog.getBoundingClientRect();
    const outside = e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
    if (outside || e.target.closest("[data-close]")) return dialog.close();
    const b = e.target.closest("button");
    if (!b) return;
    if ("resend" in b.dataset) return resendCode();
    if ("other" in b.dataset) { codeFor = null; error = ""; return render(); }
    if (b.form) { e.preventDefault(); return submit(b.form); }
    if (b.dataset.buy) return buy(b.dataset.buy);
    if ("export" in b.dataset) return orderExport();
    if ("edit" in b.dataset) { dialog.close(); return document.dispatchEvent(new Event("nc:edit")); }
    if ("out" in b.dataset) { save(null); ent = null; exportsList = []; card = null; error = ""; render(); emit(); }
  });
  dialog.addEventListener("submit", (e) => { e.preventDefault(); submit(e.target); });

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "acct-btn";
  btn.textContent = "Account";
  btn.addEventListener("click", open);
  bar.appendChild(btn);

  // Paddle's hosted payment links return here with ?_ptxn=…; loading Paddle.js resumes that checkout.
  if (new URLSearchParams(location.search).has("_ptxn")) paddle();
  // A returning visitor sees their own card without opening anything.
  if (auth) refresh().then(loadEntitlement).then(loadCard).catch(() => {});
}
