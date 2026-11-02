/// <reference path="../pb_data/types.d.ts" />

// One row per sign-in code email sent, so the daily caps in auth.pb.js can count them (PocketBase
// deletes its own code records once they are used or expire). Superusers only; kept for 3 days.
migrate((app) => {
  app.save(new Collection({
    type: "base",
    name: "otp_sends",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "email", type: "text", max: 255 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_otp_sends_created ON otp_sends (created)", "CREATE INDEX idx_otp_sends_email ON otp_sends (email, created)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("otp_sends")); } catch (_) {}
});
