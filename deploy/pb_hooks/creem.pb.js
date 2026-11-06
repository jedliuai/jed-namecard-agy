/// <reference path="../pb_data/types.d.ts" />

// Creem payments: checkout links made on the server (Creem needs the secret API key for them), the
// customer portal (where buyers cancel or update their subscription), and the signed webhook that
// turns payments into entitlements. Paddle stays wired up beside it; PAYMENTS=creem picks Creem.
// (PocketBase runs each handler in its own context, so helpers live in _creem_lib.js or inside it.)

// Which payment provider the site uses, for the browser.
routerAdd("GET", "/api/billing/config", (e) => {
  e.response.header().set("Cache-Control", "no-store");
  const creem = require(`${__hooks}/_creem_lib.js`);
  return e.json(200, creem.enabled() ? { provider: "creem", mode: creem.mode() } : { provider: "paddle" });
});

// A Creem checkout for the signed-in user. The user ID travels in metadata and comes back on every
// webhook about this purchase.
routerAdd("POST", "/api/creem/checkout", (e) => {
  const creem = require(`${__hooks}/_creem_lib.js`);
  if (!creem.enabled()) throw new BadRequestError("Checkout isn't available right now.");
  const sku = String((e.requestInfo().body || {}).sku || "");
  if (sku !== "pro" && sku !== "share_pack") throw new BadRequestError("Unknown product.");
  const product = creem.product(sku);
  if (!product) throw new BadRequestError("Checkout isn't available right now.");
  const user = e.auth;
  if (sku === "pro") {
    let until = "";
    try { until = e.app.findFirstRecordByData("entitlements", "user", user.id).getString("pro_until"); } catch (_) {}
    if (until && new Date(until.replace(" ", "T")) > new Date()) throw new BadRequestError("You already have Pro.");
  }
  let res;
  try {
    res = creem.api("POST", "/v1/checkouts", {
      product_id: product,
      request_id: `${user.id}-${Date.now()}`,
      customer: { email: user.getString("email") },
      success_url: `https://1name.cards/?paid=${sku}`,
      metadata: { user_id: user.id, sku },
    });
  } catch (err) {
    e.app.logger().error("creem checkout failed", "error", String(err));
    throw new BadRequestError("Checkout couldn't open right now. Please try again in a moment.");
  }
  return e.json(200, { url: res.checkout_url });
}, $apis.requireAuth("users"));

// Creem's customer portal for the signed-in buyer: cancel, update the card, see invoices.
routerAdd("POST", "/api/creem/portal", (e) => {
  const creem = require(`${__hooks}/_creem_lib.js`);
  let customer = "";
  try { customer = e.app.findFirstRecordByData("entitlements", "user", e.auth.id).getString("creem_customer_id"); } catch (_) {}
  if (!creem.enabled() || !customer) throw new BadRequestError("No Creem purchases on this account yet.");
  let res;
  try {
    res = creem.api("POST", "/v1/customers/billing", { customer_id: customer });
  } catch (err) {
    e.app.logger().error("creem portal failed", "error", String(err));
    throw new BadRequestError("Couldn't open your billing page. Please try again in a moment.");
  }
  return e.json(200, { url: res.customer_portal_link });
}, $apis.requireAuth("users"));

// Creem webhook: HMAC-SHA256 of the raw body with the webhook secret, hex, in creem-signature.
// Creem retries a delivery that doesn't get a 2xx (same event id), so every event is applied once.
routerAdd("POST", "/api/creem/webhook", (e) => {
  const secret = $os.getenv("CREEM_WEBHOOK_SECRET").trim();
  if (!secret) throw new InternalServerError("webhook not configured");
  const raw = toString(e.request.body);
  const sig = (e.request.header.get("creem-signature") || "").trim().toLowerCase();
  if (!sig || !$security.equal(sig, $security.hs256(raw, secret))) throw new UnauthorizedError("bad signature");

  const ev = JSON.parse(raw);
  const obj = ev.object || {};
  if (!ev.id || !ev.eventType) throw new BadRequestError("not a Creem event");
  const type = ev.eventType;
  const at = new Date(Number(ev.created_at) || Date.now()).toISOString().replace("T", " ");
  const idOf = (v) => (v && typeof v === "object" ? v.id || "" : v || "");
  const later = (a, b) => new Date(String(a).replace(" ", "T")) > new Date(String(b).replace(" ", "T"));

  e.app.runInTransaction((tx) => {
    try {
      tx.findFirstRecordByData("creem_events", "event_id", ev.id);
      return; // already handled
    } catch (_) {}
    const log = new Record(tx.findCollectionByNameOrId("creem_events"));
    log.set("event_id", ev.id);
    log.set("event_type", type);
    log.set("payload", ev);
    const notes = [];

    const isSub = type.startsWith("subscription.");
    const meta = obj.metadata || {};
    let uid = String(meta.user_id || "");
    const customer = idOf(obj.customer);
    const subId = isSub ? obj.id : idOf(obj.subscription);

    // A refund or dispute names the transaction it undoes; the payment logged under that
    // transaction says who paid and for what.
    let undo = null;
    if (type === "refund.created" || type === "dispute.created") {
      const tran = obj.transaction || {};
      const tranId = idOf(tran);
      let paid = null;
      try { paid = tx.findFirstRecordByData("creem_events", "ref", "tran:" + tranId); } catch (_) {}
      let done = false;
      try { tx.findFirstRecordByData("creem_events", "ref", "refund:" + tranId); done = true; } catch (_) {}
      // The transaction in a live refund event is a snapshot from before the refund (status still
      // "paid", nothing refunded yet), so compare the amounts too.
      const paidAmt = Number(tran.amount_paid != null ? tran.amount_paid : tran.amount) || 0;
      const full = type === "dispute.created" || tran.status === "refunded" ||
        (paidAmt > 0 && Number(obj.refund_amount) + (Number(tran.refunded_amount) || 0) >= paidAmt);
      if (!paid) notes.push(type + " for unknown payment " + tranId);
      else if (done) notes.push("payment " + tranId + " already refunded");
      else if (!full) notes.push("partial refund of " + tranId + ", review by hand");
      else {
        const p = JSON.parse(toString(paid.get("payload")));
        const po = p.object || {};
        uid = paid.getString("user");
        if (p.eventType === "checkout.completed" && (po.order || {}).type === "onetime") undo = { sku: "share_pack", units: Number(po.units) || 1 };
        else undo = { sku: "pro", end: po.current_period_end_date || (po.subscription || {}).current_period_end_date || "" };
        log.set("ref", "refund:" + tranId);
      }
    }

    let ent = null;
    if (/^[a-z0-9]{15}$/.test(uid)) {
      try { tx.findRecordById("users", uid); } catch (_) { uid = ""; }
    } else uid = "";
    if (uid) {
      try { ent = tx.findFirstRecordByData("entitlements", "user", uid); } catch (_) {}
    } else {
      // Later subscription events may come without our metadata: find the buyer by Creem's IDs.
      for (const [f, v] of [["creem_subscription_id", subId], ["creem_customer_id", customer]]) {
        if (!ent && v) { try { ent = tx.findFirstRecordByData("entitlements", f, v); } catch (_) {} }
      }
      if (ent) uid = ent.getString("user");
    }

    if (!uid) {
      notes.push("no user for this event");
    } else {
      log.set("user", uid);
      if (!ent) {
        ent = new Record(tx.findCollectionByNameOrId("entitlements"));
        ent.set("user", uid);
        ent.set("export_credits", 0);
      }
      if (customer && !undo) ent.set("creem_customer_id", customer);
      const voidUntil = ent.getString("pro_void_until");
      const voided = (t) => voidUntil && !later(t, voidUntil);
      const shorten = (t) => { const cur = ent.getString("pro_until"); if (!cur || later(cur, t)) ent.set("pro_until", t); };

      if (undo) {
        if (undo.sku === "share_pack") {
          // Packs already used become a debt that the next pack bought pays off.
          const have = ent.getInt("export_credits"), back = Math.min(have, undo.units);
          ent.set("export_credits", have - back);
          ent.set("credits_owed", ent.getInt("credits_owed") + undo.units - back);
          notes.push(type + ": -" + undo.units + " share pack" + (undo.units > back ? " (" + (undo.units - back) + " owed)" : ""));
        } else {
          // The refunded period ends now and can never grant Pro again, whatever arrives later.
          const end = undo.end || ent.getString("pro_until");
          if (end && (!voidUntil || later(end, voidUntil))) ent.set("pro_void_until", end);
          ent.set("pro_until", at);
          ent.set("pro_status", type === "dispute.created" ? "chargeback" : "refunded");
          notes.push(type + ": pro ended");
        }
      } else if (type === "checkout.completed") {
        const order = obj.order || {};
        if (order.transaction) log.set("ref", "tran:" + idOf(order.transaction));
        const sku = meta.sku || (order.type === "onetime" ? "share_pack" : "pro");
        if (sku === "share_pack") {
          const units = Number(obj.units) || 1;
          const owed = Math.min(ent.getInt("credits_owed"), units);
          ent.set("credits_owed", ent.getInt("credits_owed") - owed);
          ent.set("export_credits", ent.getInt("export_credits") + units - owed);
          notes.push("+" + units + " share pack" + (owed ? " (" + owed + " paid what was owed)" : ""));
        } else {
          const sub = obj.subscription && typeof obj.subscription === "object" ? obj.subscription : {};
          if (subId) ent.set("creem_subscription_id", subId);
          const end = sub.current_period_end_date;
          if (end && !voided(end)) { ent.set("pro_until", end); ent.set("pro_status", "active"); }
          notes.push("pro checkout" + (end ? " until " + end : ""));
        }
      } else if (isSub) {
        // Deliveries can arrive out of order; only a newer event may change the subscription.
        const last = ent.getString("sub_event_at");
        if (last && later(last, at)) {
          notes.push("stale, newer state already applied");
        } else {
          const st = obj.status || "";
          const end = obj.current_period_end_date || "";
          ent.set("creem_subscription_id", subId);
          ent.set("sub_event_at", at);
          if (type === "subscription.paid") {
            const tranId = obj.last_transaction_id || idOf(obj.last_transaction);
            if (tranId) log.set("ref", "tran:" + tranId);
          }
          if (type === "subscription.canceled") {
            // Cancelling stops renewal; the year already paid for stays (our refund policy). Creem's
            // portal cancels at once, so keep Pro to the period end. A refund ends it right away.
            shorten(end || at);
            ent.set("pro_status", "canceled");
          } else if (type === "subscription.paused") {
            shorten(at);
            ent.set("pro_status", "paused");
          } else if (type === "subscription.expired") {
            shorten(end || at);
            ent.set("pro_status", "expired");
          } else if (["active", "trialing", "scheduled_cancel", "past_due", "unpaid"].includes(st) && end) {
            if (voided(end)) notes.push("period was refunded");
            else ent.set("pro_until", end);
            ent.set("pro_status", st);
          }
          notes.push(type + " " + st + (end ? " until " + end : ""));
        }
      } else if (!notes.length) {
        notes.push("ignored " + type);
      }
      tx.save(ent);
    }
    log.set("note", notes.join("; ").slice(0, 500));
    tx.save(log);
  });

  return e.json(200, { ok: true });
}, $apis.bodyLimit(1 << 20)); // the body is read whole before the signature can be checked; real events are a few KB
