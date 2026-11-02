/// <reference path="../pb_data/types.d.ts" />

// Paddle webhook: verifies Paddle's HMAC signature, records each event once, and updates entitlements.
// Checkout passes customData { user_id } so every payment maps to a PocketBase user.
// (PocketBase runs each handler in its own context, so helpers live inside it.)
routerAdd("POST", "/api/paddle/webhook", (e) => {
  const secret = $os.getenv("PADDLE_WEBHOOK_SECRET").trim();
  if (!secret) throw new InternalServerError("webhook not configured");

  const raw = toString(e.request.body);
  const sig = {};
  for (const kv of (e.request.header.get("Paddle-Signature") || "").split(";")) {
    const i = kv.indexOf("=");
    if (i > 0) (sig[kv.slice(0, i).trim()] = sig[kv.slice(0, i).trim()] || []).push(kv.slice(i + 1).trim());
  }
  const ts = (sig.ts || [])[0];
  // Reject replays older than five minutes; Paddle signs every delivery and retry afresh.
  if (!ts || !/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) throw new UnauthorizedError("bad signature");
  const want = $security.hs256(ts + ":" + raw, secret);
  if (!(sig.h1 || []).some((h) => $security.equal(h, want))) throw new UnauthorizedError("bad signature");

  const ev = JSON.parse(raw);
  const data = ev.data || {};
  if (!ev.event_id || !ev.event_type) throw new BadRequestError("not a Paddle event");

  e.app.runInTransaction((tx) => {
    try {
      tx.findFirstRecordByData("paddle_events", "event_id", ev.event_id);
      return; // already handled
    } catch (_) {}

    const log = new Record(tx.findCollectionByNameOrId("paddle_events"));
    log.set("event_id", ev.event_id);
    log.set("event_type", ev.event_type);
    log.set("occurred_at", ev.occurred_at || "");
    log.set("payload", ev);

    const skusOf = (d) => (d.items || []).map((it) => ({ sku: ((it.price || {}).custom_data || {}).sku, qty: Number(it.quantity) || 1 }));
    const notes = [];
    let uid = String((data.custom_data || {}).user_id || "");
    let skus = skusOf(data);
    if (ev.event_type === "transaction.completed" && data.id) log.set("ref", "txn:" + data.id);

    // A refund or chargeback names only the payment it undoes; that payment's event says who paid
    // and for what. Only an approved one counts (refunds wait for approval in live mode).
    let undo = null;
    if (ev.event_type.startsWith("adjustment.") && (data.action === "refund" || data.action === "chargeback")) {
      let paid = null;
      try { paid = tx.findFirstRecordByData("paddle_events", "ref", "txn:" + data.transaction_id); } catch (_) {}
      let done = false;
      try { tx.findFirstRecordByData("paddle_events", "ref", "adj:" + data.id); done = true; } catch (_) {}
      const full = data.type === "full" || (data.items || []).length > 0 && (data.items || []).every((it) => it.type === "full");
      if (!paid) notes.push(data.action + " for unknown payment " + data.transaction_id);
      else if (done) notes.push(data.action + " " + data.id + " already applied");
      else if (data.status !== "approved") notes.push(data.action + " " + data.status + ", waiting for approval");
      else if (!full) notes.push("partial " + data.action + " for " + data.transaction_id + ", review by hand");
      else {
        const p = JSON.parse(toString(paid.get("payload"))).data || {};
        uid = paid.getString("user");
        skus = skusOf(p);
        undo = { periodEnd: (p.billing_period || {}).ends_at || "" };
        log.set("ref", "adj:" + data.id);
      }
    }

    let user = null;
    if (/^[a-z0-9]{15}$/.test(uid)) {
      try { user = tx.findRecordById("users", uid); } catch (_) {}
    }

    if (!user) {
      notes.push(uid ? "unknown user " + uid : "no user_id in custom_data");
    } else {
      log.set("user", user.id);
      let ent;
      try {
        ent = tx.findFirstRecordByData("entitlements", "user", user.id);
      } catch (_) {
        ent = new Record(tx.findCollectionByNameOrId("entitlements"));
        ent.set("user", user.id);
        ent.set("export_credits", 0);
      }
      if (data.customer_id) ent.set("paddle_customer_id", data.customer_id);

      if (undo) {
        for (const s of skus) {
          if (s.sku === "share_pack") {
            // Packs already used become a debt that the next pack bought pays off.
            const have = ent.getInt("export_credits"), back = Math.min(have, s.qty);
            ent.set("export_credits", have - back);
            ent.set("credits_owed", ent.getInt("credits_owed") + s.qty - back);
            notes.push(data.action + ": -" + s.qty + " share pack" + (s.qty > back ? " (" + (s.qty - back) + " owed)" : ""));
          } else if (s.sku === "pro") {
            // The refunded period ends now and can never grant Pro again, whatever arrives later.
            const end = undo.periodEnd || ent.getString("pro_until");
            if (end && (!ent.getString("pro_void_until") || ent.getString("pro_void_until") < end)) ent.set("pro_void_until", end);
            ent.set("pro_until", new Date().toISOString().replace("T", " "));
            ent.set("pro_status", data.action === "chargeback" ? "chargeback" : "refunded");
            notes.push(data.action + ": pro ended");
          }
        }
      } else if (ev.event_type === "transaction.completed") {
        for (const s of skus) {
          if (s.sku === "share_pack") {
            const owed = Math.min(ent.getInt("credits_owed"), s.qty);
            ent.set("credits_owed", ent.getInt("credits_owed") - owed);
            ent.set("export_credits", ent.getInt("export_credits") + s.qty - owed);
            notes.push("+" + s.qty + " share pack" + (owed ? " (" + owed + " paid what was owed)" : ""));
          }
        }
      } else if (ev.event_type.startsWith("subscription.") && skus.some((s) => s.sku === "pro")) {
        // Deliveries can arrive out of order; only a newer event may change the subscription state.
        const last = ent.getString("sub_event_at");
        if (last && ev.occurred_at && ev.occurred_at < last) {
          notes.push("stale, newer state already applied");
        } else {
          const st = data.status;
          ent.set("pro_status", st);
          ent.set("paddle_subscription_id", data.id);
          ent.set("sub_event_at", ev.occurred_at || "");
          const voidUntil = ent.getString("pro_void_until");
          const voided = (t) => voidUntil && new Date(t) <= new Date(voidUntil.replace(" ", "T"));
          if (st === "active" || st === "trialing" || st === "past_due") {
            const end = (data.current_billing_period || {}).ends_at;
            if (end && voided(end)) notes.push("period was refunded");
            else if (end) ent.set("pro_until", end);
          } else if ((st === "canceled" || st === "paused") && (data.canceled_at || data.paused_at)) {
            // Ending can only shorten Pro: a refund may already have ended it earlier.
            const at = data.canceled_at || data.paused_at, cur = ent.getString("pro_until");
            if (!cur || new Date(at) < new Date(cur.replace(" ", "T"))) ent.set("pro_until", at);
          }
          notes.push("pro " + st);
        }
      }
      tx.save(ent);
    }
    log.set("note", notes.join("; ").slice(0, 500));
    tx.save(log);
  });

  return e.json(200, { ok: true });
});
