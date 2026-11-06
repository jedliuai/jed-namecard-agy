/// <reference path="../pb_data/types.d.ts" />

// The front page of every 1name.cards host. 1name.cards itself is the app (pb_public/index.html, the
// showroom and editor); name.1name.cards shows that account's saved card in its chosen style, with the
// card's data written into the page plus link-preview tags. A card link is live while its owner has
// Pro (the Pro plan includes "your own link").
routerAdd("GET", "/{$}", (e) => {
  const DOMAIN = "1name.cards";
  const LINK_NEEDS_PRO = true;
  const SHOWROOM = `https://${DOMAIN}/`;
  const STYLES = ["noir", "holo", "terminal", "swiss", "pop", "ink", "aurora", "blueprint", "helix"];

  const host = (e.request.host || "").split(":")[0].toLowerCase();
  if (host === DOMAIN) {
    e.response.header().set("Cache-Control", "no-cache");
    return e.html(200, toString($os.readFile(`${__hooks}/../pb_public/index.html`)));
  }
  if (host === "www." + DOMAIN) return e.redirect(301, SHOWROOM);
  if (!host.endsWith("." + DOMAIN)) throw new NotFoundError();
  const slug = host.slice(0, -(DOMAIN.length + 1));
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug) || slug === "api") throw new NotFoundError();

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const tpl = toString($os.readFile(`${__hooks}/card_page.html`));
  const page = (status, v) => {
    // One pass over the template: a value that itself contains "{{BODY}}" (a card name can) must not
    // be filled in again by a later placeholder.
    const html = tpl.replace(/\{\{([A-Z]+)\}\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(v, k) ? v[k] : m));
    e.response.header().set("Cache-Control", "no-store");
    return e.html(status, html);
  };
  const note = (status, title, text) => page(status, {
    TITLE: esc(title), DESC: esc(text), URL: esc(`https://${host}`), IMAGE: "",
    BODY: `<div class="note"><div><h1>${esc(title)}</h1><p>${esc(text)}</p><a href="${esc(SHOWROOM)}">Make your own card</a></div></div>`,
  });

  let rec;
  try { rec = e.app.findFirstRecordByData("cards", "slug", slug); } catch (_) {
    return note(404, "No card here yet", `${slug}.${DOMAIN} isn't anyone's card yet.`);
  }
  if (LINK_NEEDS_PRO) {
    let until = "";
    try { until = e.app.findFirstRecordByData("entitlements", "user", rec.getString("user")).getString("pro_until"); } catch (_) {}
    if (!until || new Date(until.replace(" ", "T")) <= new Date()) {
      return note(200, "This card isn't live yet", "Its owner can publish it with Super Namecard Pro.");
    }
  }

  const data = require(`${__hooks}/_cards_lib.js`).toData(e.app, rec);
  const style = STYLES.includes(rec.getString("style")) ? rec.getString("style") : "noir";
  const desc = [data.title, data.company].filter(Boolean).join(" · ") || data.sub || "Digital business card";
  // Safe inside <script type="application/json">: no "<" can close the tag early.
  const json = JSON.stringify({ style, data }).replace(/</g, "\\u003c");
  return page(200, {
    TITLE: esc(data.name),
    DESC: esc(desc),
    URL: esc(`https://${host}`),
    IMAGE: data.avatar ? `<meta property="og:image" content="${esc(data.avatar)}">` : "",
    BODY: `<main class="stage" id="stage"></main>
<a class="made" href="${esc(SHOWROOM)}" target="_blank" rel="noopener">Made with Super Namecard · get yours</a>
<script type="application/json" id="card-data">${json}</script>
<script type="module">
import { mountCard } from "/js/runtime.js";
const { style, data } = JSON.parse(document.getElementById("card-data").textContent);
document.documentElement.classList.add("st-" + style);
mountCard(document.getElementById("stage"), { style, data });
</script>`,
  });
});
