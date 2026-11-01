// Account panel: email sign-in on PocketBase, plan status, and Paddle checkout for Pro and share packs.
// Payments are only trusted once Paddle's signed webhook has updated the user's entitlement on the server.
import { API, PADDLE } from "./config.js";

const STORE = "nc-auth";
const PRODUCTS = {
  pro: { label: "Go Pro · $5.99 / year", note: "Every style, your own link, unlimited video, GIF and JPG exports." },
  share_pack: { label: "Buy a share pack · $2.99", note: "One HD set of a style: MP4 video, GIF and JPG." },
};

let auth = read();
let ent = null;
let busy = "";
let error = "";
let dialog;

function read() {
  try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch { return null; }
}
function save(a) {
  auth = a;
  try { a ? localStorage.setItem(STORE, JSON.stringify(a)) : localStorage.removeItem(STORE); } catch {}
}

async function pb(path, { method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  if (auth) headers.authorization = auth.token;
  const r = await fetch(API + path, { method, headers, body: body && JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d.message || "Request failed");
    e.status = r.status;
    e.data = d.data || {};
    throw e;
  }
  return d;
}

async function signIn(email, password) {
  const d = await pb("/api/collections/users/auth-with-password", { method: "POST", body: { identity: email, password } });
  save({ token: d.token, user: { id: d.record.id, email: d.record.email } });
}

async function signUp(email, password) {
  await pb("/api/collections/users/records", { method: "POST", body: { email, password, passwordConfirm: password } });
  await signIn(email, password);
}

async function refresh() {
  if (!auth) return;
  try {
    const d = await pb("/api/collections/users/auth-refresh", { method: "POST" });
    save({ token: d.token, user: { id: d.record.id, email: d.record.email } });
  } catch (e) {
    if (e.status === 401 || e.status === 403 || e.status === 404) save(null);
  }
}

async function loadEntitlement() {
  ent = null;
  if (!auth) return;
  const d = await pb("/api/collections/entitlements/records?perPage=1");
  ent = d.items[0] || null;
}

const proActive = () => !!ent && !!ent.pro_until && new Date(ent.pro_until.replace(" ", "T")) > new Date();
const credits = () => (ent && ent.export_credits) || 0;

let paddleReady;
function paddle() {
  paddleReady ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.onload = () => {
      if (PADDLE.env === "sandbox") window.Paddle.Environment.set("sandbox");
      window.Paddle.Initialize({ token: PADDLE.token, eventCallback: onPaddle });
      resolve(window.Paddle);
    };
    s.onerror = () => { paddleReady = null; reject(new Error("Could not load checkout")); };
    document.head.appendChild(s);
  });
  return paddleReady;
}

async function buy(sku) {
  error = "";
  busy = "Opening checkout…";
  render();
  try {
    const P = await paddle();
    // A modal dialog sits in the browser's top layer, above Paddle's overlay, so step aside.
    dialog.close();
    paying = false;
    P.Checkout.open({
      items: [{ priceId: PADDLE.prices[sku], quantity: 1 }],
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

function render() {
  if (!dialog) return;
  // Keep what was typed when the panel redraws for a status line.
  const typed = dialog.querySelector(".acct-form");
  const kept = typed && { email: typed.email.value, password: typed.password.value };
  let body;
  if (!auth) {
    body = `
      <h2>Your account</h2>
      <p class="acct-sub">Sign in to get Pro or buy share packs.</p>
      <form class="acct-form">
        <input name="email" type="email" autocomplete="email" placeholder="Email" required>
        <input name="password" type="password" autocomplete="current-password" placeholder="Password (8+ characters)" minlength="8" required>
        <div class="acct-row">
          <button class="acct-go" value="in">Sign in</button>
          <button class="acct-alt" value="up">Create account</button>
        </div>
      </form>`;
  } else {
    const pro = proActive();
    const plan = pro ? `Pro · until ${day(ent.pro_until)}` : ent && ent.pro_status === "canceled" ? "Pro ended" : "Free plan";
    const buys = Object.entries(PRODUCTS)
      .filter(([sku]) => !(sku === "pro" && pro))
      .map(([sku, p]) => `<button class="acct-go" data-buy="${sku}">${p.label}</button><p class="acct-note">${p.note}</p>`)
      .join("");
    body = `
      <h2>Account</h2>
      <p class="acct-sub">${esc(auth.user.email)}</p>
      <div class="acct-plan"><b>${plan}</b><span>Share packs: ${credits()}</span></div>
      ${buys}
      <p class="acct-fine">Payments are handled by Paddle, our merchant of record.</p>
      <button class="acct-alt" data-out>Sign out</button>`;
  }
  dialog.innerHTML = `
    <button class="acct-x" data-close aria-label="Close">×</button>
    ${body}
    ${busy ? `<p class="acct-busy">${esc(busy)}</p>` : ""}
    ${error ? `<p class="acct-err">${esc(error)}</p>` : ""}`;
  const form = dialog.querySelector(".acct-form");
  if (form && kept) {
    form.email.value = kept.email;
    form.password.value = kept.password;
  }
  dialog.querySelectorAll("button:not([data-close])").forEach((b) => (b.disabled = !!busy));
}

async function submit(form, mode) {
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!form.reportValidity()) return;
  error = "";
  busy = mode === "up" ? "Creating your account…" : "Signing in…";
  render();
  try {
    await (mode === "up" ? signUp(email, password) : signIn(email, password));
    await loadEntitlement();
  } catch (e) {
    if (e.status === 429) error = "Too many tries. Wait a few seconds.";
    else if (mode === "up" && e.data.email) error = e.data.email.code === "validation_not_unique" ? "That email already has an account. Sign in instead." : "Please check the email address.";
    else if (mode === "up" && e.data.password) error = "Password needs at least 8 characters.";
    else error = mode === "up" ? "Could not create the account." : "Wrong email or password.";
  }
  busy = "";
  render();
}

async function open() {
  render();
  if (!dialog.open) dialog.showModal();
  if (auth) {
    await refresh();
    try { await loadEntitlement(); } catch {}
    render();
  }
}

export function mountAccount(bar) {
  dialog = document.createElement("dialog");
  dialog.className = "acct";
  document.body.appendChild(dialog);
  dialog.addEventListener("click", (e) => {
    const r = dialog.getBoundingClientRect();
    const outside = e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
    if (outside || e.target.closest("[data-close]")) return dialog.close();
    const b = e.target.closest("button");
    if (!b) return;
    if (b.form) { e.preventDefault(); return submit(b.form, b.value); }
    if (b.dataset.buy) return buy(b.dataset.buy);
    if ("out" in b.dataset) { save(null); ent = null; error = ""; render(); }
  });
  dialog.addEventListener("submit", (e) => { e.preventDefault(); submit(e.target, "in"); });

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "acct-btn";
  btn.textContent = "Account";
  btn.addEventListener("click", open);
  bar.appendChild(btn);

  // Paddle's hosted payment links return here with ?_ptxn=…; loading Paddle.js resumes that checkout.
  if (new URLSearchParams(location.search).has("_ptxn")) paddle();
}
