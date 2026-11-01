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

    const uid = String((data.custom_data || {}).user_id || "");
    let user = null;
    if (/^[a-z0-9]{15}$/.test(uid)) {
      try { user = tx.findRecordById("users", uid); } catch (_) {}
    }
    const skus = (data.items || []).map((it) => ({ sku: ((it.price || {}).custom_data || {}).sku, qty: Number(it.quantity) || 1 }));
    const notes = [];

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

      if (ev.event_type === "transaction.completed") {
        for (const s of skus) {
          if (s.sku === "share_pack") {
            ent.set("export_credits", ent.getInt("export_credits") + s.qty);
            notes.push("+" + s.qty + " share pack");
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
          if (st === "active" || st === "trialing" || st === "past_due") {
            const end = (data.current_billing_period || {}).ends_at;
            if (end) ent.set("pro_until", end);
          } else if (st === "canceled" && data.canceled_at) {
            ent.set("pro_until", data.canceled_at);
          } else if (st === "paused" && data.paused_at) {
            ent.set("pro_until", data.paused_at);
          }
          notes.push("pro " + st);
        }
      } else if (ev.event_type.startsWith("adjustment.")) {
        // Refunds and chargebacks are kept for review; credits are not clawed back automatically yet.
        notes.push(data.action + " " + data.status + " for " + data.transaction_id);
      }
      tx.save(ent);
    }
    log.set("note", notes.join("; ").slice(0, 500));
    tx.save(log);
  });

  return e.json(200, { ok: true });
});
