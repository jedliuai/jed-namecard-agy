/// <reference path="../pb_data/types.d.ts" />

// Creem as the payment provider, next to Paddle. entitlements gets Creem's customer and subscription
// IDs (the customer portal needs the customer ID); creem_events is the Creem webhook log and
// idempotency key, like paddle_events. ref: "tran:<id>" on a payment, "refund:<id>" once a refund or
// dispute has been applied, so a refund finds what it pays back and is applied only once.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const ent = app.findCollectionByNameOrId("entitlements");
  ent.fields.add(new TextField({ name: "creem_customer_id", max: 64 }));
  ent.fields.add(new TextField({ name: "creem_subscription_id", max: 64 }));
  app.save(ent);

  app.save(new Collection({
    type: "base",
    name: "creem_events",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "event_id", type: "text", required: true, max: 64 },
      { name: "event_type", type: "text", max: 64 },
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "ref", type: "text", max: 80 },
      { name: "note", type: "text", max: 500 },
      { name: "payload", type: "json", maxSize: 262144 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_creem_events_event ON creem_events (event_id)", "CREATE INDEX idx_creem_events_ref ON creem_events (ref)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("creem_events")); } catch (_) {}
  const ent = app.findCollectionByNameOrId("entitlements");
  ent.fields.removeByName("creem_customer_id");
  ent.fields.removeByName("creem_subscription_id");
  app.save(ent);
});
