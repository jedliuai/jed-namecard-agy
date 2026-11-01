/// <reference path="../pb_data/types.d.ts" />

// What each user has paid for, written only by the Paddle webhook hook; users can read their own row.
// paddle_events is the webhook log and idempotency key, visible to superusers only.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  app.save(new Collection({
    type: "base",
    name: "entitlements",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "pro_until", type: "date" },
      { name: "pro_status", type: "text", max: 32 },
      { name: "export_credits", type: "number", onlyInt: true, min: 0 },
      { name: "paddle_customer_id", type: "text", max: 64 },
      { name: "paddle_subscription_id", type: "text", max: 64 },
      { name: "sub_event_at", type: "text", max: 40 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_entitlements_user ON entitlements (user)"],
  }));

  app.save(new Collection({
    type: "base",
    name: "paddle_events",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "event_id", type: "text", required: true, max: 64 },
      { name: "event_type", type: "text", max: 64 },
      { name: "occurred_at", type: "text", max: 40 },
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "note", type: "text", max: 500 },
      { name: "payload", type: "json", maxSize: 262144 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_paddle_events_event ON paddle_events (event_id)"],
  }));
}, (app) => {
  for (const name of ["paddle_events", "entitlements"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
