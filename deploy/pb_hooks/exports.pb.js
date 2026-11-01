/// <reference path="../pb_data/types.d.ts" />

// Paid exports: users order one here; the render worker (render/worker.mjs) claims it, renders it
// and uploads the MP4, GIF and JPGs. Pro includes exports; otherwise each one spends a share pack.

routerAdd("POST", "/api/exports", (e) => {
  const lib = require(`${__hooks}/_exports_lib.js`);
  const body = e.requestInfo().body || {};
  const style = String(body.style || "");
  if (!lib.STYLES.includes(style)) throw new BadRequestError("Unknown style.");
  const card = lib.cleanCard(body.card);
  if (!card.name) throw new BadRequestError("The card needs a name.");
  const uid = e.auth.id;

  let created = null;
  e.app.runInTransaction((tx) => {
    const open = tx.findRecordsByFilter("exports", "user = {:u} && (status = 'queued' || status = 'rendering')", "", 1, 0, { u: uid });
    if (open.length) throw new TooManyRequestsError("Your last export is still being made. Try again when it's done.");

    let ent = null;
    try { ent = tx.findFirstRecordByData("entitlements", "user", uid); } catch (_) {}
    const until = ent ? ent.getString("pro_until") : "";
    const pro = !!until && new Date(until.replace(" ", "T")) > new Date();
    let paid;
    if (pro) {
      const today = tx.findRecordsByFilter("exports", "user = {:u} && created >= {:t}", "", lib.PRO_PER_DAY, 0, { u: uid, t: lib.ago(864e5) });
      if (today.length >= lib.PRO_PER_DAY) throw new TooManyRequestsError("That's today's export limit. Try again tomorrow.");
      paid = "pro";
    } else if (ent && ent.getInt("export_credits") > 0) {
      ent.set("export_credits", ent.getInt("export_credits") - 1);
      tx.save(ent);
      paid = "credit";
    } else {
      throw new ApiError(402, "Get Pro or a share pack to export.");
    }

    const rec = new Record(tx.findCollectionByNameOrId("exports"));
    rec.set("user", uid);
    rec.set("style", style);
    rec.set("card", card);
    rec.set("status", "queued");
    rec.set("paid_with", paid);
    rec.set("attempts", 0);
    tx.save(rec);
    created = rec;
  });
  return e.json(200, { id: created.id, status: "queued" });
}, $apis.requireAuth("users"));

// Worker: takes the oldest queued export. Jobs left "rendering" by a worker that died go back in the
// queue, and after two tries they fail and refund.
routerAdd("POST", "/api/worker/claim", (e) => {
  const lib = require(`${__hooks}/_exports_lib.js`);
  lib.worker(e);
  let job = null;
  e.app.runInTransaction((tx) => {
    for (const r of tx.findRecordsByFilter("exports", "status = 'rendering' && updated < {:t}", "", 20, 0, { t: lib.ago(20 * 60e3) })) {
      if (r.getInt("attempts") >= 2) lib.failAndRefund(tx, r, "Render timed out");
      else { r.set("status", "queued"); tx.save(r); }
    }
    const next = tx.findRecordsByFilter("exports", "status = 'queued'", "created", 1, 0);
    if (!next.length) return;
    const r = next[0];
    r.set("status", "rendering");
    r.set("attempts", r.getInt("attempts") + 1);
    tx.save(r);
    job = { id: r.id, style: r.getString("style"), card: JSON.parse(r.getString("card") || "{}") };
  });
  return e.json(200, { job });
});

routerAdd("POST", "/api/worker/finish/{id}", (e) => {
  const lib = require(`${__hooks}/_exports_lib.js`);
  lib.worker(e);
  const rec = e.app.findRecordById("exports", e.request.pathValue("id"));
  if (rec.getString("status") !== "rendering") throw new BadRequestError("This export isn't rendering.");
  const files = e.findUploadedFiles("files");
  if (!files || !files.length) throw new BadRequestError("No files.");
  rec.set("files", files);
  rec.set("status", "done");
  rec.set("error", "");
  e.app.save(rec);
  return e.json(200, { ok: true });
});

routerAdd("POST", "/api/worker/fail/{id}", (e) => {
  const lib = require(`${__hooks}/_exports_lib.js`);
  lib.worker(e);
  const id = e.request.pathValue("id");
  const msg = (e.requestInfo().body || {}).error;
  e.app.runInTransaction((tx) => {
    const rec = tx.findRecordById("exports", id);
    if (rec.getString("status") === "rendering") lib.failAndRefund(tx, rec, msg);
  });
  return e.json(200, { ok: true });
});

// Exports and their files are kept for 30 days.
cronAdd("exports-cleanup", "17 3 * * *", () => {
  const lib = require(`${__hooks}/_exports_lib.js`);
  for (const r of $app.findRecordsByFilter("exports", "created < {:t}", "", 500, 0, { t: lib.ago(30 * 864e5) })) $app.delete(r);
});
