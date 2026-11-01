// "My card" editor: a side panel (a bottom sheet on phones) whose fields update the card on screen as
// you type. Saving needs an account; until then the text stays in this browser as a draft.
import { DOMAIN, initials } from "./templates.js";
import { signedIn, savedCard, cardData, saveCard, openAccount } from "./account.js";

const DRAFT = "nc-draft";
const MAIN = [
  ["name", "Name", "Alex Morgan", 60],
  ["sub", "Tagline", "One line about you", 80],
  ["title", "Job title", "Founder · Product designer", 80],
  ["company", "Company", "Morgan Studio", 80],
  ["phone", "Phone", "+1 212 555 0123", 40, "tel"],
  ["wa", "WhatsApp", "Same as phone if left empty", 40, "tel"],
  ["email", "Email", "alex@example.com", 100, "email"],
];
const EXTRA = [
  ["stat", "Badge · Holo", "120K followers", 40],
  ["greet", "Greeting · Pop", "Hungry? Burgers on me!", 60],
  ["industry", "Industry · Swiss", "Architecture", 40],
  ["no", "Card number", "0001", 20],
];
const KEYS = [...MAIN, ...EXTRA].map((f) => f[0]).concat("slug");

let panel;
let onChange = () => {};
let draft = {};
let photo;            // { blob, url } new photo · false removed · undefined unchanged
let dirty = false;
let pendingSave = false;
let saving = false;
let status = "";
let error = "";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const slugify = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/, "");

function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT)) || null; } catch { return null; }
}
function keepDraft() {
  try { localStorage.setItem(DRAFT, JSON.stringify(draft)); } catch {}
}
function dropDraft() {
  try { localStorage.removeItem(DRAFT); } catch {}
}

export const isEditing = () => !!panel && panel.classList.contains("open");

// The card as it should look right now: the draft while editing, else the saved card.
export function myData() {
  if (!isEditing()) return cardData(savedCard());
  const d = { ...draft };
  if (!d.name) d.name = "Your Name";
  if (!d.slug) d.slug = slugify(d.name) || "you";
  if (!d.wa && d.phone) d.wa = d.phone;
  const saved = cardData(savedCard());
  if (photo) d.avatar = photo.url;
  else if (photo === undefined && saved && saved.avatar) d.avatar = saved.avatar;
  else delete d.avatar;
  return d;
}

function startDraft() {
  const rec = savedCard();
  draft = {};
  if (rec) for (const k of KEYS) draft[k] = rec[k] || "";
  else Object.assign(draft, readDraft() || {});
  photo = undefined;
  dirty = false;
}

// A square, at most 640 px JPEG, cut from the middle of whatever photo was picked.
async function squarePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("That file isn't a photo we can read. Try a JPG or PNG."));
      i.src = url;
    });
    const s = Math.min(img.naturalWidth, img.naturalHeight), size = Math.min(640, s);
    const c = Object.assign(document.createElement("canvas"), { width: size, height: size });
    c.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

const field = ([k, label, ph, max, type = "text"]) => `
  <label class="ed-f"><span>${label}</span>
    <input name="${k}" type="${type}" maxlength="${max}" placeholder="${esc(ph)}" value="${esc(draft[k])}"${k === "name" ? " required" : ""}${type === "email" ? ' autocomplete="email"' : type === "tel" ? ' autocomplete="tel"' : ""}>
  </label>`;

function build() {
  panel.innerHTML = `
    <header class="ed-head"><h2>My card</h2><button type="button" class="ed-x" data-close aria-label="Close">×</button></header>
    <form class="ed-body" novalidate>
      <div class="ed-photo">
        <span class="ed-av"></span>
        <div class="ed-photo-btns">
          <label class="ed-btn">Upload photo<input type="file" accept="image/*" hidden></label>
          <button type="button" class="ed-link" data-rmphoto>Remove</button>
        </div>
      </div>
      ${MAIN.map(field).join("")}
      <label class="ed-f"><span>Card link</span>
        <div class="ed-slug"><input name="slug" maxlength="30" placeholder="${esc(slugify(draft.name) || "your-name")}" value="${esc(draft.slug)}" autocapitalize="off" spellcheck="false"><em>.${DOMAIN}</em></div>
      </label>
      <details class="ed-more"><summary>More, for some styles</summary>${EXTRA.map(field).join("")}</details>
    </form>
    <footer class="ed-foot"><p class="ed-msg"></p><button type="button" class="ed-save" data-save>Save my card</button></footer>`;
  paint();
}

// Updates only what changes outside the inputs, so typing never loses focus.
function paint() {
  if (!panel) return;
  const d = myData() || {};
  const av = panel.querySelector(".ed-av");
  if (av) av.innerHTML = d.avatar ? `<img src="${esc(d.avatar)}" alt="">` : esc(initials(d.name));
  const rm = panel.querySelector("[data-rmphoto]");
  if (rm) rm.hidden = !d.avatar;
  const msg = panel.querySelector(".ed-msg");
  if (msg) {
    msg.textContent = error || status || (signedIn() ? "" : "You can try it out now. Saving asks you to sign in.");
    msg.classList.toggle("err", !!error);
  }
  const btn = panel.querySelector("[data-save]");
  if (btn) {
    btn.disabled = saving;
    btn.textContent = signedIn() ? "Save my card" : "Sign in & save";
  }
}

async function save() {
  error = "";
  if (!String(draft.name || "").trim()) {
    error = "Add your name first.";
    panel.querySelector('[name="name"]').focus();
    return paint();
  }
  const fields = {};
  for (const k of KEYS) fields[k] = String(draft[k] || "").trim();
  fields.slug = slugify(fields.slug || fields.name);
  // Names in Chinese and other scripts have no Latin letters to build a link from.
  if (fields.slug.length < 3) fields.slug = `card-${Math.random().toString(36).slice(2, 7)}`;
  if (!signedIn()) {
    pendingSave = true;
    keepDraft();
    status = "Sign in to save your card.";
    paint();
    return openAccount();
  }
  saving = true;
  status = "Saving…";
  paint();
  try {
    await saveCard(fields, photo ? photo.blob : photo);
    if (photo) URL.revokeObjectURL(photo.url);
    photo = undefined;
    draft.slug = fields.slug;
    panel.querySelector('[name="slug"]').value = fields.slug;
    dirty = false;
    dropDraft();
    status = "Saved. This is now your card in every style.";
  } catch (e) {
    status = "";
    const slugErr = e.data && e.data.slug;
    if (slugErr) error = slugErr.code === "validation_not_unique" ? "That card link is taken. Try another." : "Card link: 3–30 letters, numbers or dashes.";
    else if (/reserved/i.test(e.message)) error = "That card link is reserved. Try another.";
    else if (e.data && e.data.avatar) error = "That photo couldn't be used. Try a smaller JPG or PNG.";
    else if (e.status === 401 || e.status === 403) error = "Please sign in again.";
    else error = "Couldn't save. Please try again.";
  }
  saving = false;
  paint();
  onChange();
}

export function openEditor() {
  if (!isEditing()) {
    startDraft();
    status = error = "";
    build();
    panel.classList.add("open");
    document.documentElement.classList.add("editing");
  }
  onChange();
  panel.querySelector('[name="name"]').focus({ preventScroll: true });
}

export function closeEditor() {
  if (!isEditing()) return;
  if (!signedIn() && dirty) keepDraft();
  panel.classList.remove("open");
  document.documentElement.classList.remove("editing");
  onChange();
}

// onPreview(): called whenever the card on screen should be redrawn (typing, photo, save, close).
export function mountEditor({ onPreview }) {
  onChange = onPreview;
  panel = document.createElement("aside");
  panel.className = "ed";
  panel.setAttribute("aria-label", "Edit my card");
  document.body.appendChild(panel);

  panel.addEventListener("input", (e) => {
    const k = e.target.name;
    if (!k || !KEYS.includes(k)) return;
    draft[k] = e.target.value;
    dirty = true;
    status = error = "";
    if (k === "name") panel.querySelector('[name="slug"]').placeholder = slugify(draft.name) || "your-name";
    if (!signedIn()) keepDraft();
    paint();
    onChange();
  });
  panel.addEventListener("change", async (e) => {
    if (e.target.type !== "file" || !e.target.files[0]) return;
    error = "";
    status = "Preparing your photo…";
    paint();
    try {
      const blob = await squarePhoto(e.target.files[0]);
      if (photo) URL.revokeObjectURL(photo.url);
      photo = { blob, url: URL.createObjectURL(blob) };
      dirty = true;
      status = signedIn() ? "Photo ready. Save to keep it." : "Photo ready. It's kept once you sign in and save.";
    } catch (err) {
      status = "";
      error = err.message;
    }
    e.target.value = "";
    paint();
    onChange();
  });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if ("close" in b.dataset) return closeEditor();
    if ("save" in b.dataset) return save();
    if ("rmphoto" in b.dataset) {
      if (photo) URL.revokeObjectURL(photo.url);
      photo = savedCard() && savedCard().avatar ? false : undefined;
      dirty = true;
      paint();
      onChange();
    }
  });
  panel.addEventListener("submit", (e) => { e.preventDefault(); save(); });

  // Signing in (or out) while the editor is open: finish a save that was waiting for it, or show
  // the account's saved card if nothing has been typed yet.
  document.addEventListener("nc:account", () => {
    if (!isEditing()) return;
    if (pendingSave && signedIn()) {
      pendingSave = false;
      return save();
    }
    if (!dirty) {
      startDraft();
      build();
      onChange();
    } else paint();
  });
}
