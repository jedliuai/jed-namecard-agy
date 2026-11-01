// Shared by cards.pb.js and exports.pb.js (PocketBase runs each handler in its own context).

const RESERVED = ["api", "www", "app", "admin", "mail", "email", "send", "smtp", "preview", "test", "dev", "staging",
  "card", "cards", "help", "support", "status", "docs", "blog", "shop", "pay", "billing", "login", "account", "you"];
const FIELDS = ["name", "sub", "title", "company", "phone", "wa", "email", "slug", "stat", "greet", "industry", "no"];

module.exports = {
  checkSlug(e) {
    const slug = e.record.getString("slug").trim().toLowerCase();
    e.record.set("slug", slug);
    if (RESERVED.includes(slug)) throw new BadRequestError("That link name is reserved.");
  },

  // A saved card as the card templates want it, with its photo as a public URL.
  toData(app, rec) {
    const d = {};
    for (const k of FIELDS) {
      const v = rec.getString(k);
      if (v) d[k] = v;
    }
    if (!d.wa && d.phone) d.wa = d.phone;   // most people use one number for both
    const photo = rec.getString("avatar");
    if (photo) d.avatar = `${app.settings().meta.appURL}/api/files/${rec.collection().id}/${rec.id}/${encodeURIComponent(photo)}`;
    return d;
  },
};
