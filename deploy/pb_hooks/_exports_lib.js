// Shared by exports.pb.js (PocketBase runs each handler in its own context, so it require()s this).

module.exports = {
  STYLES: ["noir", "holo", "terminal", "swiss", "pop", "ink", "aurora", "blueprint", "helix"],
  PRO_PER_DAY: 20,

  // Only the render worker knows this token (RENDER_WORKER_TOKEN, set from a root-only file).
  worker(e) {
    const want = ($os.getenv("RENDER_WORKER_TOKEN") || "").trim();
    const got = e.request.header.get("X-Worker-Token") || "";
    if (!want || !got || !$security.equal(got, want)) throw new UnauthorizedError("Not the render worker.");
  },

  // Marks an export failed and gives back the share pack it used, if any.
  failAndRefund(tx, rec, msg) {
    rec.set("status", "failed");
    rec.set("error", String(msg || "Render failed").slice(0, 500));
    tx.save(rec);
    if (rec.getString("paid_with") !== "credit") return;
    try {
      const ent = tx.findFirstRecordByData("entitlements", "user", rec.getString("user"));
      ent.set("export_credits", ent.getInt("export_credits") + 1);
      tx.save(ent);
    } catch (_) {}
  },

  ago(ms) {
    return new Date(Date.now() - ms).toISOString().replace("T", " ");
  },
};
