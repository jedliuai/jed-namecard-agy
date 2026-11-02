// Card markup for every style. Pure string functions so the same code can render in the browser
// and, later, inside the Cloudflare Worker. Every visible block carries `data-m` so the morph
// engine can move it between the portrait and landscape layouts.

export const STYLES = [
  { id: "noir", name: "Noir", fit: "Finance · Law · Luxury" },
  { id: "holo", name: "Holo", fit: "Creators · Brands" },
  { id: "terminal", name: "Terminal", fit: "Developers · AI" },
  { id: "swiss", name: "Swiss", fit: "Design · Architecture" },
  { id: "pop", name: "Pop", fit: "Food · Retail · Education" },
  { id: "ink", name: "Ink", fit: "Tea · Culture · Wellness" },
  { id: "aurora", name: "Aurora", fit: "Beauty · Therapy · Yoga" },
  { id: "blueprint", name: "Blueprint", fit: "Construction · Engineering" },
  { id: "helix", name: "Helix", fit: "Pharma · Biotech · Health" },
];
export const ALIASES = { obsidian: "noir" };

export const DOMAIN = "1name.cards";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const isCJK = (s) => /[㐀-鿿]/.test(String(s ?? ""));

export function initials(n) {
  n = String(n || "").trim();
  if (!n) return "?";
  if (isCJK(n)) return n.slice(-1);
  return n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const host = (d) => `${esc(d.slug || "you")}.${DOMAIN}`;
// Messenger: WhatsApp (QR made from the number, or the owner's own picture) or WeChat (the owner's
// own QR picture; WeChat has no link to build one from). Without either, the QR opens the card link.
export const isWeChat = (d) => d.im === "wechat";
const imName = (d) => (isWeChat(d) ? "WeChat" : "WhatsApp");
const imTag = (d) => (isWeChat(d) ? "WeChat" : "WA");
const imId = (d) => (isWeChat(d) ? d.wechat || "" : d.wa || d.phone || "");
const imLine = (d, tag = imTag(d)) => (imId(d) ? `${tag} ${esc(imId(d))}` : "");
const scanTo = (d) => (d.qr || (!isWeChat(d) && waLink(d)) ? imName(d) : "My card");
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
// Ink sets Chinese names in vertical columns. Latin letters turned sideways read wrong, so a Latin
// name is set upright, one word per line, sized to its longest word; the title follows below it.
const latVars = (d) => {
  const w = words(d.name);
  return `--nl:${Math.min(3, w.length) || 1};--L:${Math.max(4, ...w.map((x) => x.length))}`;
};
const inkName = (d, p) => isCJK(d.name)
  ? `<div class="${p}-name" style="--n:${[...String(d.name || "")].length || 1}" data-m>${esc(d.name)}</div>`
  : `<div class="${p}-name lat" style="${latVars(d)}" data-m>${words(d.name).slice(0, 3).map(esc).join("<br>")}${words(d.name).length > 3 ? " " + words(d.name).slice(3).map(esc).join(" ") : ""}</div>`;
const sealHTML = (d, cls = "") => {
  const s = seal(d.name);
  return `<div class="i-seal${s.one ? " one" : ""} ${cls}"${isCJK(d.name) ? "" : ` style="${latVars(d)}"`} data-m>${[...s.txt].map((c) => `<span>${esc(c)}</span>`).join("")}</div>`;
};

const NFC_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 7c2.5 3 2.5 7 0 10M12 5c3.5 4 3.5 10 0 14M16 3c4.5 5 4.5 13 0 18"/></svg>`;
const ICON = {
  tel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  web: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
};

// A red-crowned crane in flight, drawn like an ink-wash sketch. Wings flap via CSS.
const CRANE = `<svg viewBox="0 0 200 110" aria-hidden="true">
  <g class="cr-wing far"><path d="M104 49C100 33 90 17 70 4C88 7 108 17 124 33C121 40 117 46 113 50Z" fill="rgba(28,27,24,.2)"/><path d="M70 4C78 5 88 9 98 15L92 19C84 13 76 9 68 7Z" fill="rgba(28,27,24,.85)"/></g>
  <path d="M80 50C70 48 62 52 56 58C66 57 74 56 82 54Z" fill="#1c1b18"/>
  <path d="M84 53L36 57M84 55L38 61" stroke="#1c1b18" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M76 52C88 44 112 43 126 48C120 56 98 60 76 52Z" fill="#f6f1e6" stroke="#1c1b18" stroke-width=".8"/>
  <path d="M122 47C136 43 150 39 165 39" stroke="#1c1b18" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <circle cx="167" cy="39" r="3.4" fill="#1c1b18"/><circle cx="167" cy="36.8" r="1.7" fill="#c8442f"/>
  <path d="M170 38.5L186 41L170 41.5Z" fill="#1c1b18"/>
  <g class="cr-wing near"><path d="M100 54C96 70 86 86 64 100C84 98 104 86 118 58Z" fill="rgba(28,27,24,.3)"/><path d="M64 100C72 99 80 95 88 89L84 85C78 91 70 96 62 98Z" fill="rgba(28,27,24,.9)"/></g>
</svg>`;

// Guilloché rosette for the black card back.
const GUIL = `<svg viewBox="-50 -50 100 100" aria-hidden="true"><g fill="none" stroke="#e8cf8c" stroke-width=".16">${
  Array.from({ length: 24 }, (_, i) => `<ellipse rx="47" ry="15" transform="rotate(${i * 7.5})"/>`).join("")}${
  Array.from({ length: 18 }, (_, i) => `<ellipse rx="27" ry="8" transform="rotate(${i * 10 + 5})"/>`).join("")}</g></svg>`;

// Flowing guilloché waves across the black card front.
const WAVE = `<svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#e8cf8c" stroke-width=".35" vector-effect="non-scaling-stroke">${
  Array.from({ length: 16 }, (_, i) => { const y = 20 + i * 4, a = 10 + i * 0.6, p = i * 9; return `<path d="M-200 ${y} ${Array.from({ length: 16 }, (_, k) => `Q${-200 + k * 25 + 12.5} ${y + (k % 2 ? -a : a) * Math.cos((p + k * 25) / 40)} ${-175 + k * 25} ${y}`).join(" ")}"/>`; }).join("")}</g></svg>`;

// Plan view of the twisting tower: floor plates stacked from above.
const PLAN = `<svg viewBox="-50 -50 100 100" fill="none" stroke="currentColor" aria-hidden="true">${
  Array.from({ length: 9 }, (_, k) => { const h = k / 8, r = 40 * (1 - 0.44 * h), rot = h * 2.094; return `<path stroke-width="${k % 4 ? 0.35 : 0.7}" d="${Array.from({ length: 49 }, (_, i) => { const t = (i / 48) * Math.PI * 2, rr = r * (1 + 0.12 * Math.cos(3 * t)); return `${i ? "L" : "M"}${(Math.cos(t + rot) * rr).toFixed(1)} ${(Math.sin(t + rot) * rr).toFixed(1)}`; }).join("")}Z"/>`; }).join("")}
  <path d="M-48 0H48M0-48V48" stroke-width=".3" stroke-dasharray="4 2 1 2"/><circle r="3" stroke-width=".4"/></svg>`;

// A small aromatic molecule (three fused rings with -OH and -NH2) for the pharma card.
const hex = (cx, cy, r = 12) => Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + (k * Math.PI) / 3; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(" ");
const MOL = `<svg viewBox="0 0 120 120" fill="none" stroke="#0b2545" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true">
  <polygon points="${hex(40, 40)}"/><polygon points="${hex(60.8, 40)}"/><polygon points="${hex(50.4, 58)}"/>
  <circle cx="40" cy="40" r="6.5" stroke-width=".8"/><circle cx="60.8" cy="40" r="6.5" stroke-width=".8"/><circle cx="50.4" cy="58" r="6.5" stroke-width=".8"/>
  <path d="M71.2 34L82 28M50.4 70v12M29.6 34L19 28"/>
  <text x="84" y="28" font-size="7" fill="#0b2545" stroke="none" font-family="Inter Tight, sans-serif">OH</text>
  <text x="44" y="92" font-size="7" fill="#0b2545" stroke="none" font-family="Inter Tight, sans-serif">NH₂</text>
  <circle cx="19" cy="28" r="2.2" fill="#12b5a5" stroke="none"/></svg>`;

const FRONT = {
  noir: (d) => `
    <div class="fx n-frame"></div><div class="fx n-wave">${WAVE}</div><div class="fx n-glint"></div>
    <span class="n-mono" data-m>${esc(initials(d.name).split("").join(" "))}</span>
    <span class="n-nfc" data-m>${NFC_ICON}</span>
    ${d.avatar ? `<div class="n-av" data-m><img src="${esc(d.avatar)}" alt=""></div>` : ""}
    <span class="n-since" data-m>MEMBER N° ${esc(d.no || "0001")} · EST. 2026</span>
    <div class="n-name foil" data-m data-t="${esc(d.name)}">${esc(d.name)}</div>
    <div class="n-sub" data-m>${esc(d.sub)}</div>
    <i class="n-rule" data-m></i>
    ${d.company ? `<div class="n-co" data-m>${esc(d.company)}</div>` : ""}
    <div class="n-title" data-m>${esc(d.title)}</div>
    <div class="n-rows" data-m><span>${esc(d.phone)}</span><span>${esc(d.email)}</span></div>`,

  holo: (d) => `
    <div class="fx h-foil"></div><div class="fx h-lines"></div><div class="fx h-band"></div>
    <div class="h-av" data-m>${avatar(d)}</div>
    <span class="h-badge" data-m>${esc(d.stat || "No. " + (d.no || "0001"))}</span>
    <div class="h-name" data-m>${words(d.name).map(esc).join("<br>")}</div>
    <div class="h-sub" data-m>${esc(d.sub)}</div>
    ${d.company ? `<div class="h-co" data-m>${esc(d.company)}</div>` : ""}
    <div class="h-tags">${parts(d.title).map((t) => `<span class="h-tag" data-m>${esc(t)}</span>`).join("")}</div>
    <div class="h-foot" data-m><span>${host(d)}</span><span>${imLine(d)}</span></div>`,

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
    <p class="t-out t-ls" data-m><span>${imName(d).toLowerCase()}/</span><span>phone/</span><span>email/</span></p>
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
    <div class="w-c w-c4" data-m>${imId(d) ? `<b>${imName(d)}</b>${esc(imId(d))}` : `<b>Email</b>${esc(d.email)}`}</div>`;
  },

  pop: (d) => `
    <div class="fx p-dots"></div>
    <div class="p-star" data-m><span>HI!</span></div>
    <div class="p-av" data-m>${avatar(d)}</div>
    <div class="p-bubble" data-m>${esc(d.greet || "Hey! I'm " + (d.name || ""))}</div>
    <div class="p-name">${[...String(d.name || "")].map((c) => (c === " " ? `<span class="p-sp"></span>` : `<span class="p-ch" data-m>${esc(c)}</span>`)).join("")}</div>
    <div class="p-tags"><span class="p-tag" data-m>${esc(d.title)}</span><span class="p-tag t2" data-m>${esc(d.company)}</span></div>
    <div class="p-phone" data-m>TEL ${esc(d.phone)}</div>`,

  ink: (d) => `
    <div class="fx i-paper"></div><div class="fx i-sun"></div><div class="fx i-mtn"></div><div class="fx i-mist"></div>
    <div class="fx i-crane c1"><div class="cr-bob">${CRANE}</div></div><div class="fx i-crane c2"><div class="cr-bob">${CRANE}</div></div>
    <div class="fx i-mist m2"></div><div class="fx i-qi"><i></i><i></i><i></i><i></i><i></i></div><div class="fx i-ripple"></div>
    ${inkName(d, "i")}
    <div class="i-title${isCJK(d.title) ? "" : " lat"}" style="${latVars(d)}" data-m>${esc(d.title)}</div>
    ${sealHTML(d)}
    <div class="i-foot" data-m>${esc(d.company)}<br>${imLine(d, isWeChat(d) ? "微信" : "WhatsApp")}</div>`,

  aurora: (d) => `
    <div class="fx a-blob b1"></div><div class="fx a-blob b2"></div><div class="fx a-blob b3"></div>
    <div class="fx a-curtain"><i></i><i></i><i></i></div><div class="fx a-grain"></div>
    <div class="fx a-spark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="a-av" data-m><span class="a-ring"></span><span class="a-pic">${avatar(d)}</span></div>
    <div class="a-glass" data-m>
      <div class="a-name">${esc(d.name)}</div>
      <div class="a-sub">${esc(d.sub)}</div>
      <div class="a-title">${esc(d.title)} · ${esc(d.company)}</div>
      <div class="a-rows"><span>${esc(d.phone)}</span><span>${imLine(d)}</span></div>
    </div>`,

  blueprint: (d) => `
    <div class="fx bp-frame"></div>
    <div class="bp-dim" data-m><span class="p">54.0 mm</span><span class="l">85.6 mm</span></div>
    <div class="bp-part" data-m>
      <svg class="bp-3d" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">
        <path class="t-back" stroke-width=".3" stroke-dasharray="1.1 1.3" opacity=".42"/>
        <path class="t-front" stroke-width=".5"/>
        <g class="t-dim" stroke-width=".35"><path d="M88 90h7M88 16h7M93 16v74M91.6 19l1.4-3 1.4 3M91.6 87l1.4 3 1.4-3"/>
        <text x="-53" y="97.4" transform="rotate(-90)" font-size="4" fill="currentColor" stroke="none" text-anchor="middle" font-family="IBM Plex Mono, monospace">632.0</text>
        <text x="3" y="97" font-size="3.6" fill="currentColor" stroke="none" font-family="IBM Plex Mono, monospace">±0.000</text></g>
      </svg>
    </div>
    <div class="bp-cap" data-m>SHANGHAI TOWER · AXO · 1:5000</div>
    <div class="bp-name" data-m>${esc(d.name)}</div>
    <div class="bp-sub" data-m>${esc(d.sub)}</div>
    <table class="bp-tb" data-m>
      <tr><td>ROLE</td><td>${esc(d.title)}</td><td>DWG</td><td>${esc(d.no || "0001")}</td></tr>
      <tr><td>CO.</td><td colspan="3">${esc(d.company)}</td></tr>
      <tr><td>TEL</td><td>${esc(d.phone)}</td><td>SCALE</td><td>1:1</td></tr>
    </table>`,

  helix: (d) => `
    <div class="fx x-hex">${MOL}</div><div class="fx x-glow"></div>
    <div class="x-logo" data-m><i class="x-cross"></i>${esc(d.company)}</div>
    <div class="x-helix" data-m><svg aria-hidden="true" fill="none" stroke-linecap="round">
      <path class="hx-ab" stroke="#0b2545" opacity=".28"/><path class="hx-bb" stroke="#12b5a5" opacity=".3"/>
      <g class="hx-rungs"></g><g class="hx-nodes"></g>
      <path class="hx-af" stroke="#0b2545"/><path class="hx-bf" stroke="#12b5a5"/>
    </svg></div>
    ${d.avatar ? `<div class="x-av" data-m><img src="${esc(d.avatar)}" alt=""></div>` : ""}
    <div class="x-cap" data-m><b><i class="ca"></i><i class="cb"></i></b></div>
    <div class="x-name" data-m>${esc(d.name)}</div>
    <div class="x-title" data-m>${esc(d.title)}</div>
    <div class="x-sub" data-m>${esc(d.sub)}</div>
    <div class="x-rows" data-m>
      <span>${ICON.tel}${esc(d.phone)}</span>
      <span>${ICON.mail}${esc(d.email)}</span>
      <span>${ICON.web}${host(d)}</span>
    </div>`,
};

/* ---------- backs: each style gets its own composition around the WhatsApp QR ---------- */
const BACK = {
  noir: (d, q) => `
    <div class="fx n-guil">${GUIL}</div><div class="fx n-frame"></div>
    <span class="n-top" data-m>${esc(initials(d.name).split("").join(" "))} <em>NOIR</em></span>
    <div class="b-qr n-qr" data-m>${q}<i class="tl"></i><i class="br"></i></div>
    <div class="n-cap" data-m>Scan · ${scanTo(d)}</div>
    <div class="n-sig" data-m><small>Authorized signature</small><span>${esc(d.name)}</span></div>
    <div class="n-list" data-m><span>${esc(d.phone)}</span><span>${esc(d.email)}</span><span>${host(d)}</span></div>
    <p class="n-fine" data-m>This card remains the property of its holder. If found, please return via ${imName(d)}.</p>`,

  holo: (d, q) => `
    <div class="fx h-foil"></div><div class="fx h-lines"></div>
    <div class="fx h-marq">${[0, 1, 2, 3, 4, 5].map((i) => `<span class="${i % 2 ? "r" : ""}">${(esc(words(d.name)[0] || d.name) + " ✦ ").repeat(6)}</span>`).join("")}</div>
    <div class="h-qr" data-m><div class="b-qr">${q}</div></div>
    <span class="h-scan" data-m>SCAN ME</span>
    <div class="h-bname" data-m>${esc(d.name)}</div>
    <div class="h-chips">
      ${imId(d) ? `<span class="h-chip" data-m>${imLine(d)}</span>` : ""}
      ${d.email ? `<span class="h-chip" data-m>${esc(d.email)}</span>` : ""}
      <span class="h-chip" data-m>${host(d)}</span>
    </div>`,

  terminal: (d, q, wa) => `
    <div class="fx t-scan"></div>
    <div class="t-bar tb" data-m>tty2 — qrencode</div>
    <p class="t-cmd tq" data-m>${d.qr ? `$ display ./${imName(d).toLowerCase()}-qr.png` : `$ qrencode -t UTF8 ${esc((wa || cardURL(d)).replace("https://", ""))}`}</p>
    <div class="b-qr t-qr" data-m>${q}</div>
    <p class="t-cmd tv" data-m>$ cat contact.vcf</p>
    <pre class="t-vcf" data-m>BEGIN:VCARD
FN:${esc(d.name)}
TEL:${esc(d.phone)}
EMAIL:${esc(d.email)}
URL:${host(d)}
END:VCARD</pre>
    <p class="t-prompt tp" data-m>$ <i class="t-cur"></i></p>`,

  swiss: (d, q) => `
    <div class="fx w-gridlines on"></div>
    <div class="w-disc" data-m><i class="w-blob"></i></div>
    <span class="w-no" data-m>02 / Contact</span>
    <span class="w-ind w-scan" data-m>Scan · ${scanTo(d)}</span>
    <div class="b-qr w-qr" data-m>${q}</div>
    <i class="w-rule" data-m></i>
    <div class="w-c w-c1" data-m><b>Phone</b>${esc(d.phone)}</div>
    <div class="w-c w-c2" data-m><b>Email</b>${esc(d.email)}</div>`,

  pop: (d, q) => `
    <div class="fx p-half"></div><div class="fx p-burst"></div>
    <div class="p-say" data-m>SCAN ME!</div>
    <div class="p-qr" data-m><div class="b-qr">${q}</div></div>
    <div class="p-call" data-m><span>CALL<br>ME!</span></div>
    <div class="p-bn" data-m>${esc(d.name)}</div>
    <div class="p-tel" data-m>${esc(d.phone)}</div>
    <div class="p-mail" data-m>${esc(d.email || host(d))}</div>`,

  ink: (d, q) => `
    <div class="fx i-paper"></div><div class="fx i-moon"></div><div class="fx i-far"></div><div class="fx i-mist"></div>
    <div class="fx i-crane c3"><div class="cr-bob">${CRANE}</div></div>
    <div class="ib-qr" data-m><div class="b-qr">${q}</div></div>
    <div class="ib-cap" data-m>扫码 · ${scanTo(d) === "WeChat" ? "微信" : scanTo(d) === "My card" ? "名片" : "WhatsApp"}</div>
    ${inkName(d, "ib")}
    <div class="ib-lines" data-m><span>${esc(d.company)}</span><span>${esc(d.phone)}</span><span>${esc(d.email)}</span></div>
    ${sealHTML(d, "small")}`,

  aurora: (d, q) => `
    <div class="fx a-blob b1"></div><div class="fx a-blob b2"></div><div class="fx a-blob b3"></div>
    <div class="fx a-curtain"><i></i><i></i><i></i></div><div class="fx a-grain"></div>
    <div class="ab-orb" data-m>
      <svg class="ab-ring" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="ab-c" d="M50 50m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0"/></defs>
      <text font-size="6" fill="currentColor" textLength="272" lengthAdjust="spacing"><textPath href="#ab-c" textLength="272" lengthAdjust="spacing">${`SCAN TO SAY HELLO · ${scanTo(d).toUpperCase()} · `.repeat(2)}</textPath></text></svg>
      <div class="b-qr">${q}</div>
    </div>
    <div class="ab-name" data-m>${esc(d.name)}</div>
    <div class="ab-rows" data-m><span>${esc(d.phone)}</span><span>${esc(d.email)}</span><span>${host(d)}</span></div>`,

  blueprint: (d, q) => `
    <div class="fx bp-frame"></div>
    <div class="bb-det" data-m>
      <span class="bb-d bb-dw">40</span><span class="bb-d bb-dh">40</span>
      <div class="b-qr">${q}</div>
      <span class="bb-call">A</span>
    </div>
    <div class="bb-lbl" data-m>DETAIL A — SCAN · ${scanTo(d).toUpperCase()}</div>
    <ol class="bb-notes" data-m>
      <li>TEL ${esc(d.phone)}</li>
      <li>MAIL ${esc(d.email)}</li>
      <li>WEB ${host(d)}</li>
    </ol>
    <div class="bb-plan" data-m>${PLAN}<span>PLAN · L1–L128</span></div>
    <svg class="bb-n" data-m viewBox="0 0 24 34" fill="none" stroke="currentColor" stroke-width=".8" stroke-linejoin="round" aria-hidden="true"><text x="12" y="7" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-family="IBM Plex Mono, monospace">N</text><circle cx="12" cy="22" r="10"/><path d="M2 22h3M19 22h3M12 32v-2"/><path d="M12 10.5 7.6 29.5 12 26z"/><path d="M12 10.5 16.4 29.5 12 26z" fill="currentColor"/></svg>
    <table class="bp-tb bb-tb" data-m>
      <tr><td>NAME</td><td colspan="3">${esc(d.name)}</td></tr>
      <tr><td>SHEET</td><td>2 / 2</td><td>REV</td><td>B</td></tr>
    </table>`,

  helix: (d, q) => `
    <div class="fx x-hex">${MOL}</div>
    <div class="x-qr" data-m><div class="b-qr">${q}</div><span class="x-rx">℞</span></div>
    <div class="x-facts" data-m>
      <h3>Contact Facts</h3>
      <div class="xf-row xf-big"><b>Active ingredient</b><span>${esc(d.name)}</span></div>
      <div class="xf-row"><b>Purpose</b><span>${esc(d.title)}</span></div>
      <div class="xf-row"><b>Uses</b><span>${esc(d.sub || d.company)}</span></div>
      <div class="xf-row"><b>Directions</b><span>${scanTo(d) === "My card" ? "Scan the code to open my card." : `Scan the code to chat on ${scanTo(d)}.`} Repeat as needed.</span></div>
      <div class="xf-row xf-mono"><b>Contact</b><span>${esc(d.phone)}<br>${esc(d.email)}<br>${host(d)}</span></div>
      <p class="xf-warn">Keep within reach of your network.</p>
    </div>`,
};

export function waLink(d) {
  if (isWeChat(d)) return "";
  const digits = String(d.wa || d.phone || "").replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

export function cardURL(d) {
  return `https://${d.slug || "you"}.${DOMAIN}`;
}

// Decoration layers (class "fx", no nested <div>s) sit directly in the face. Content goes in
// .box > .lay: .box is the size container for the content, .lay carries the grid and padding.
const FX = /<div class="fx [^"]*">(?:(?!<div)[\s\S])*?<\/div>/g;
function layered(html) {
  // Ink cranes nest one div; lift those whole first.
  const nested = html.match(/<div class="fx i-crane[^"]*"><div class="cr-bob">[\s\S]*?<\/svg><\/div><\/div>/g) || [];
  html = html.replace(/<div class="fx i-crane[^"]*"><div class="cr-bob">[\s\S]*?<\/svg><\/div><\/div>/g, "");
  const fx = html.match(FX) || [];
  const body = html.replace(FX, "");
  return `${fx.join("")}${nested.join("")}<div class="box"><div class="lay">${body}</div></div>`;
}

// `qr(text)` returns an SVG string; the caller provides it so this module stays dependency-free.
export function renderCard(style, d, { qr = () => "" } = {}) {
  style = ALIASES[style] || style;
  const front = (FRONT[style] || FRONT.noir)(d);
  const wa = isWeChat(d) ? "" : waLink(d);
  const code = d.qr ? `<img class="qr-img" src="${esc(d.qr)}" alt="${imName(d)} QR code">` : qr(wa || cardURL(d));
  const back = (BACK[style] || BACK.noir)(d, code, wa);
  return `<div class="face front c-${style}">${layered(front)}</div><div class="face back c-${style}">${layered(back)}</div>`;
}
