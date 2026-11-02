// "My card" editor: a side panel (a bottom sheet on phones) whose fields update the card on screen as
// you type. Saving needs an account; until then the text stays in this browser as a draft.
import { DOMAIN, initials } from "./templates.js";
import { signedIn, hasPro, savedCard, cardData, saveCard, openAccount } from "./account.js";
import { cropImage } from "./cropper.js";

const DRAFT = "nc-draft";
const MAIN = [
  ["name", "Name", "Alex Morgan", 60],
  ["sub", "Tagline", "One line about you", 80],
  ["title", "Job title", "Founder · Product designer", 80],
  ["company", "Company", "Morgan Studio", 80],
  ["phone", "Phone", "+1 212 555 0123", 40, "tel"],
  ["email", "Email", "alex@example.com", 100, "email"],
];
const IM = {
  wa: ["wa", "WhatsApp number", "Same as phone if left empty", 40, "tel"],
  wechat: ["wechat", "WeChat ID (optional)", "e.g. alexmorgan88", 40],
};
const EXTRA = [
  ["stat", "Badge · Holo", "120K followers", 40],
  ["greet", "Greeting · Pop", "Hungry? Burgers on me!", 60],
  ["industry", "Industry · Swiss", "Architecture", 40],
  ["no", "Card number", "0001", 20],
];
const KEYS = [...MAIN, ...EXTRA].map((f) => f[0]).concat("slug", "im", "wa", "wechat");

let panel;
let onChange = () => {};
let getStyle = () => "";
let draft = {};
let photo;            // { blob, url } new photo · false removed · undefined unchanged
let qrPic;            // the same for the messenger QR picture
let qrWarn = "";
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
  if (d.im !== "wechat") d.im = "wa";
  const saved = cardData(savedCard());
  for (const [key, pic] of [["avatar", photo], ["qr", qrPic]]) {
    if (pic) d[key] = pic.url;
    else if (pic === undefined && saved && saved[key]) d[key] = saved[key];
    else delete d[key];
  }
  return d;
}

function startDraft() {
  const rec = savedCard();
  draft = {};
  if (rec) for (const k of KEYS) draft[k] = rec[k] || "";
  else Object.assign(draft, readDraft() || {});
  photo = qrPic = undefined;
  qrWarn = "";
  dirty = false;
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
          <label class="ed-btn">Upload photo<input type="file" accept="image/*" data-pic="photo" hidden></label>
          <button type="button" class="ed-link" data-rm="photo">Remove</button>
        </div>
      </div>
      ${MAIN.map(field).join("")}
      <fieldset class="ed-im"><legend>Messenger on your card</legend>
        <div class="ed-seg" role="radiogroup">
          <label><input type="radio" name="im" value="wa"${draft.im !== "wechat" ? " checked" : ""}>WhatsApp</label>
          <label><input type="radio" name="im" value="wechat"${draft.im === "wechat" ? " checked" : ""}>WeChat</label>
        </div>
        ${field(IM[draft.im === "wechat" ? "wechat" : "wa"])}
        <div class="ed-qr">
          <span class="ed-qrpic"></span>
          <div class="ed-photo-btns">
            <label class="ed-btn">Upload QR code<input type="file" accept="image/*" data-pic="qr" hidden></label>
            <button type="button" class="ed-link" data-rm="qr">Remove</button>
          </div>
        </div>
        <p class="ed-hint ed-qrhint"></p>
      </fieldset>
      <label class="ed-f"><span>Card link</span>
        <div class="ed-slug"><input name="slug" maxlength="30" placeholder="${esc(slugify(draft.name) || "your-name")}" value="${esc(draft.slug)}" autocapitalize="off" spellcheck="false"><em>.${DOMAIN}</em></div>
      </label>
      <p class="ed-live"></p>
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
  const rm = panel.querySelector('[data-rm="photo"]');
  if (rm) rm.hidden = !d.avatar;
  // The QR: the owner's own picture, else (WhatsApp) one made from the number.
  const wechat = d.im === "wechat";
  const qp = panel.querySelector(".ed-qrpic");
  if (qp) qp.innerHTML = d.qr ? `<img src="${esc(d.qr)}" alt="">` : wechat ? "No QR yet" : "Made from<br>number";
  const rq = panel.querySelector('[data-rm="qr"]');
  if (rq) rq.hidden = !d.qr;
  const qh = panel.querySelector(".ed-qrhint");
  if (qh) qh.textContent = qrWarn || (wechat
    ? (d.qr ? "People scan this to add you on WeChat." : "Upload your WeChat QR code. In WeChat: Me → tap your name → My QR Code → ⋯ → Save Image. Until then the card's QR opens your card link.")
    : (d.qr ? "Your own WhatsApp QR code is used. Remove it to use one made from your number." : "We make the QR from your WhatsApp number. You can upload your own instead."));
  // Where the card can be seen: live with Pro, once saved.
  const live = panel.querySelector(".ed-live");
  const rec = savedCard();
  if (live) {
    const url = rec && `https://${rec.slug}.${DOMAIN}`;
    live.innerHTML = !rec ? "Save your card to get this link."
      : hasPro() ? `Live at <a href="${esc(url)}" target="_blank" rel="noopener">${esc(rec.slug)}.${DOMAIN}</a> in ${esc(rec.style || "noir")} style.`
      : "Your link goes live with Pro.";
  }
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
  fields.im = fields.im === "wechat" ? "wechat" : "wa";
  fields.style = getStyle();   // the style on screen is the one the public link shows
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
    await saveCard(fields, photo ? photo.blob : photo, qrPic ? qrPic.blob : qrPic);
    for (const p of [photo, qrPic]) if (p) URL.revokeObjectURL(p.url);
    photo = qrPic = undefined;
    draft.slug = fields.slug;
    panel.querySelector('[name="slug"]').value = fields.slug;
    dirty = false;
    dropDraft();
    status = "Saved.";
  } catch (e) {
    status = "";
    const slugErr = e.data && e.data.slug;
    if (slugErr) error = slugErr.code === "validation_not_unique" ? "That card link is taken. Try another." : "Card link: 3–30 letters, numbers or dashes.";
    else if (/reserved/i.test(e.message)) error = "That card link is reserved. Try another.";
    else if (e.data && e.data.avatar) error = "That photo couldn't be used. Try a smaller JPG or PNG.";
    else if (e.data && e.data.qr) error = "That QR picture couldn't be used. Try a smaller JPG or PNG.";
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
// getStyle(): the style on screen, saved with the card for its public link.
export function mountEditor({ onPreview, style }) {
  onChange = onPreview;
  if (style) getStyle = style;
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
    // Switching messenger swaps the ID field. A QR picture belongs to one messenger: a new one is
    // dropped, and a saved one is removed on save unless the saved card already uses this messenger.
    if (k === "im") {
      if (qrPic) URL.revokeObjectURL(qrPic.url);
      const saved = savedCard();
      qrPic = saved && saved.qr && (saved.im || "wa") !== draft.im ? false : undefined;
      qrWarn = "";
      const top = panel.querySelector(".ed-body").scrollTop;
      build();
      panel.querySelector(".ed-body").scrollTop = top;
    }
    if (k === "name") panel.querySelector('[name="slug"]').placeholder = slugify(draft.name) || "your-name";
    if (!signedIn()) keepDraft();
    paint();
    onChange();
  });
  panel.addEventListener("change", async (e) => {
    if (e.target.type !== "file" || !e.target.files[0]) return;
    const isQR = e.target.dataset.pic === "qr", file = e.target.files[0];
    e.target.value = "";
    error = "";
    try {
      const got = await cropImage(file, isQR
        ? { title: draft.im === "wechat" ? "Crop your WeChat QR code" : "Crop your WhatsApp QR code", qr: true, size: 720, quality: 0.92 }
        : { title: "Crop your photo", round: true });
      if (!got) return;
      const pic = { blob: got.blob, url: URL.createObjectURL(got.blob) };
      if (isQR) {
        if (qrPic) URL.revokeObjectURL(qrPic.url);
        qrPic = pic;
        qrWarn = got.readable === false ? "We couldn't read a QR code in that crop. Check it scans before you share your card." : "";
      } else {
        if (photo) URL.revokeObjectURL(photo.url);
        photo = pic;
      }
      dirty = true;
      const what = isQR ? "QR code" : "Photo";
      status = signedIn() ? `${what} ready. Save to keep it.` : `${what} ready. It's kept once you sign in and save.`;
    } catch (err) {
      status = "";
      error = err.message;
    }
    paint();
    onChange();
  });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if ("close" in b.dataset) return closeEditor();
    if ("save" in b.dataset) return save();
    if (b.dataset.rm) {
      const [key, cur] = b.dataset.rm === "qr" ? ["qr", qrPic] : ["avatar", photo];
      if (cur) URL.revokeObjectURL(cur.url);
      const next = savedCard() && savedCard()[key] ? false : undefined;
      if (key === "qr") { qrPic = next; qrWarn = ""; } else photo = next;
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
