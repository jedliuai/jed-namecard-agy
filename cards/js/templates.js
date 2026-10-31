// Card markup for every style. Pure string functions so the same code can render in the browser
// and, later, inside the Cloudflare Worker. Every visible block carries `data-m` so the morph
// engine can move it between the portrait and landscape layouts.

export const STYLES = [
  { id: "obsidian", name: "Obsidian", fit: "Finance · Law · Luxury" },
  { id: "holo", name: "Holo", fit: "Creators · Brands" },
  { id: "terminal", name: "Terminal", fit: "Developers · AI" },
  { id: "swiss", name: "Swiss", fit: "Design · Architecture" },
  { id: "pop", name: "Pop", fit: "Food · Retail · Education" },
  { id: "ink", name: "Ink", fit: "Tea · Culture · Wellness" },
  { id: "aurora", name: "Aurora", fit: "Beauty · Therapy · Yoga" },
  { id: "blueprint", name: "Blueprint", fit: "Manufacturing · Engineering" },
];

export const DOMAIN = "999368.xyz";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const isCJK = (s) => /[㐀-鿿]/.test(String(s ?? ""));

export function initials(n) {
  n = String(n || "").trim();
  if (!n) return "?";
  if (isCJK(n)) return n.slice(-1);
  return n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const host = (d) => `${esc(d.slug || "you")}.${DOMAIN}`;
const avatar = (d) => (d.avatar ? `<img src="${esc(d.avatar)}" alt="">` : esc(initials(d.name)));
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean);
const parts = (s) => String(s || "").split(/\s*[·|]\s*/).filter(Boolean);

function monoWidth(s) {
  let w = 0;
  for (const c of s) w += isCJK(c) ? 2 : 1;
  return w;
}

function seal(name) {
  const n = String(name || "").trim();
  if (isCJK(n)) {
    const core = n.length >= 3 ? n.slice(-2) : n;
    return { txt: core.length === 2 ? core + "之印" : core, one: core.length < 2 };
  }
  return { txt: initials(n), one: true };
}

const NFC_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 7c2.5 3 2.5 7 0 10M12 5c3.5 4 3.5 10 0 14M16 3c4.5 5 4.5 13 0 18"/></svg>`;

const FRONT = {
  obsidian: (d) => `
    <div class="fx o-frame"></div>
    <span class="o-mono" data-m>${esc(initials(d.name))}</span>
    <span class="o-nfc" data-m>${NFC_ICON}</span>
    <i class="o-chip" data-m></i>
    ${d.avatar ? `<img class="o-av" data-m src="${esc(d.avatar)}" alt="">` : ""}
    <div class="o-name foil" data-m data-t="${esc(d.name)}">${esc(d.name)}</div>
    <div class="o-sub" data-m>${esc(d.sub)}</div>
    <i class="o-rule" data-m></i>
    <div class="o-title" data-m>${esc(d.title)}</div>
    <div class="o-rows" data-m><span>${esc(d.phone)}</span><span>${esc(d.email)}</span></div>`,

  holo: (d) => `
    <div class="fx h-foil"></div><div class="fx h-lines"></div><div class="fx h-band"></div>
    <div class="h-av" data-m>${avatar(d)}</div>
    <span class="h-badge" data-m>${esc(d.stat || "No. " + (d.no || "0001"))}</span>
    <div class="h-name" data-m>${words(d.name).map(esc).join("<br>")}</div>
    <div class="h-sub" data-m>${esc(d.sub)}</div>
    <div class="h-tags">${parts(d.title).map((t) => `<span class="h-tag" data-m>${esc(t)}</span>`).join("")}</div>
    <div class="h-foot" data-m><span>${host(d)}</span><span>WA ${esc(d.wa)}</span></div>`,

  terminal: (d) => {
    const name = String(d.name || "");
    return `
    <div class="fx t-scan"></div><div class="fx t-line"></div>
    <div class="t-bar" data-m>tty1 — ${esc(d.slug || "you")}@${DOMAIN}:~</div>
    <p class="t-cmd c1" data-m>$ whoami</p>
    <p class="t-name" data-m><span class="t-type go" style="--n:${monoWidth(name)};--k:${Math.max(1, [...name].length)}">${esc(name)}</span><i class="t-cur"></i></p>
    <p class="t-cmd c2" data-m>$ cat role.txt</p>
    <p class="t-out t-role" data-m>${esc(d.title)}<br>@ ${esc(d.company)}</p>
    <p class="t-cmd c3" data-m>$ ls ./contact</p>
    <p class="t-out t-ls" data-m><span>whatsapp/</span><span>phone/</span><span>email/</span></p>
    <p class="t-out t-dim" data-m>${esc(d.phone)}<br>${esc(d.email)}</p>
    <p class="t-prompt" data-m>$ <i class="t-cur"></i></p>`;
  },

  swiss: (d) => {
    const w = isCJK(d.name) ? [String(d.name)] : words(d.name);
    const n0 = w.length > 1 ? w.slice(0, -1).join(" ") : w[0] || "";
    const n1 = w.length > 1 ? w[w.length - 1] : "";
    return `
    <div class="fx w-gridlines"></div>
    <div class="w-dot" data-m><i></i></div>
    <span class="w-no" data-m>N° ${esc(d.no || "0001")}</span>
    <span class="w-ind" data-m>${esc(d.industry || d.company)}</span>
    <span class="w-side" data-m>${host(d)}</span>
    <div class="w-n w-n0" data-m>${esc(n0)}</div>
    ${n1 ? `<div class="w-n w-n1" data-m>${esc(n1)}</div>` : ""}
    <i class="w-rule" data-m></i>
    <div class="w-c w-c1" data-m><b>Role</b>${esc(d.title)}</div>
    <div class="w-c w-c2" data-m><b>Company</b>${esc(d.company)}</div>
    <div class="w-c w-c3" data-m><b>Phone</b>${esc(d.phone)}</div>
    <div class="w-c w-c4" data-m><b>WhatsApp</b>${esc(d.wa)}</div>`;
  },

  pop: (d) => `
    <div class="fx p-dots"></div>
    <div class="p-star" data-m><span>HI!</span></div>
    <div class="p-av" data-m>${avatar(d)}</div>
    <div class="p-bubble" data-m>${esc(d.greet || "Hey! I'm " + (d.name || ""))}</div>
    <div class="p-name">${[...String(d.name || "")].map((c) => (c === " " ? `<span class="p-sp"></span>` : `<span class="p-ch" data-m>${esc(c)}</span>`)).join("")}</div>
    <div class="p-tags"><span class="p-tag" data-m>${esc(d.title)}</span><span class="p-tag t2" data-m>${esc(d.company)}</span></div>
    <div class="p-phone" data-m>TEL ${esc(d.phone)}</div>`,

  ink: (d) => {
    const s = seal(d.name);
    return `
    <div class="fx i-paper"></div><div class="fx i-sun"></div><div class="fx i-mtn"></div><div class="fx i-mist"></div><div class="fx i-ripple"></div>
    <div class="i-name${isCJK(d.name) ? "" : " lat"}" data-m>${esc(d.name)}</div>
    <div class="i-title" data-m>${esc(d.title)}</div>
    <div class="i-seal${s.one ? " one" : ""}" data-m>${[...s.txt].map((c) => `<span>${esc(c)}</span>`).join("")}</div>
    <div class="i-foot" data-m>${esc(d.company)}<br>WhatsApp ${esc(d.wa)}</div>`;
  },

  aurora: (d) => `
    <div class="fx a-blob b1"></div><div class="fx a-blob b2"></div><div class="fx a-blob b3"></div><div class="fx a-grain"></div>
    <div class="a-av" data-m>${avatar(d)}</div>
    <div class="a-glass" data-m>
      <div class="a-name">${esc(d.name)}</div>
      <div class="a-sub">${esc(d.sub)}</div>
      <div class="a-title">${esc(d.title)} · ${esc(d.company)}</div>
      <div class="a-rows"><span>${esc(d.phone)}</span><span>WA ${esc(d.wa)}</span></div>
    </div>`,

  blueprint: (d) => `
    <div class="fx bp-frame"></div>
    <div class="bp-dim" data-m><span class="p">54.0 mm</span><span class="l">85.6 mm</span></div>
    <div class="bp-part" data-m>
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width=".7" aria-hidden="true">
        <line class="ln" pathLength="1" x1="0" y1="50" x2="100" y2="50" stroke-dasharray="6 2 1 2" opacity=".6"/>
        <line class="ln" pathLength="1" x1="50" y1="0" x2="50" y2="100" opacity=".6"/>
        <g class="spin">
          <circle class="ln" pathLength="1" cx="50" cy="50" r="38"/><circle cx="50" cy="50" r="30" stroke-dasharray="2 2"/><circle class="ln" pathLength="1" cx="50" cy="50" r="12"/>
          <circle cx="50" cy="22" r="3.5"/><circle cx="78" cy="50" r="3.5"/><circle cx="50" cy="78" r="3.5"/><circle cx="22" cy="50" r="3.5"/>
          <path d="M46 12h8v-4h-8zM88 46v8h4v-8zM46 88h8v4h-8zM12 46v8H8v-8z"/>
        </g>
        <path class="ln" pathLength="1" d="M74 20l12-12h12" opacity=".8"/>
        <text x="87" y="6.5" font-size="5" fill="currentColor" stroke="none" font-family="IBM Plex Mono, monospace">Ø76</text>
      </svg>
    </div>
    <div class="bp-name" data-m>${esc(d.name)}</div>
    <div class="bp-sub" data-m>${esc(d.sub)}</div>
    <table class="bp-tb" data-m>
      <tr><td>ROLE</td><td>${esc(d.title)}</td><td>DWG</td><td>${esc(d.no || "0001")}</td></tr>
      <tr><td>CO.</td><td colspan="3">${esc(d.company)}</td></tr>
      <tr><td>TEL</td><td>${esc(d.phone)}</td><td>SCALE</td><td>1:1</td></tr>
    </table>`,
};

const BACK_FX = {
  holo: `<div class="fx h-foil"></div><div class="fx h-lines"></div>`,
  terminal: `<div class="fx t-scan"></div>`,
  pop: `<div class="fx p-dots"></div>`,
  ink: `<div class="fx i-paper"></div>`,
  aurora: `<div class="fx a-blob b1"></div><div class="fx a-blob b2"></div><div class="fx a-blob b3"></div><div class="fx a-grain"></div>`,
  blueprint: `<div class="fx bp-frame"></div>`,
  obsidian: `<div class="fx o-frame"></div>`,
};

export function waLink(d) {
  const digits = String(d.wa || d.phone || "").replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

export function cardURL(d) {
  return `https://${d.slug || "you"}.${DOMAIN}`;
}

// Decoration layers sit directly in the face; content goes in .lay, which carries the grid and
// padding (so padding in cqmin is measured against the card, not the page).
function layered(html) {
  const fx = html.match(/<div class="fx [^"]*"><\/div>/g) || [];
  const body = html.replace(/<div class="fx [^"]*"><\/div>/g, "");
  return `${fx.join("")}<div class="lay">${body}</div>`;
}

// `qr(text)` returns an SVG string; the caller provides it so this module stays dependency-free.
export function renderCard(style, d, { qr = () => "" } = {}) {
  const front = (FRONT[style] || FRONT.obsidian)(d);
  const wa = waLink(d);
  const back = `
    ${BACK_FX[style] || ""}
    <div class="b-qr" data-m>${qr(wa || cardURL(d))}</div>
    <div class="b-cap" data-m>${wa ? "Scan to chat on WhatsApp" : "Scan to open my card"}</div>
    <div class="b-name" data-m>${esc(d.name)}</div>
    <div class="b-list" data-m>
      ${d.phone ? `<span>${esc(d.phone)}</span>` : ""}
      ${d.email ? `<span>${esc(d.email)}</span>` : ""}
      <span>${host(d)}</span>
    </div>`;
  return `<div class="face front c-${style}">${layered(front)}</div><div class="face back c-${style}">${layered(back)}</div>`;
}
