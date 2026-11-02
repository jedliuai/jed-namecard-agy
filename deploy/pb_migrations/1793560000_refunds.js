/// <reference path="../pb_data/types.d.ts" />

// Refunds and chargebacks take back what was paid for.
// paddle_events.ref: "txn:<id>" on a completed payment, "adj:<id>" once a refund has been applied,
// so each payment can be found from its refund and each refund is applied only once.
// entitlements.credits_owed: share packs refunded after they were used; the next pack pays them off.
// entitlements.pro_void_until: the end of a refunded Pro period; that period never grants Pro again.
migrate((app) => {
  const ev = app.findCollectionByNameOrId("paddle_events");
  ev.fields.add(new TextField({ name: "ref", max: 80 }));
  ev.addIndex("idx_paddle_events_ref", false, "ref", "");
  app.save(ev);

  const ent = app.findCollectionByNameOrId("entitlements");
  ent.fields.add(new NumberField({ name: "credits_owed", onlyInt: true, min: 0 }));
  ent.fields.add(new DateField({ name: "pro_void_until" }));
  app.save(ent);
}, (app) => {
  const ev = app.findCollectionByNameOrId("paddle_events");
  ev.removeIndex("idx_paddle_events_ref");
  ev.fields.removeByName("ref");
  app.save(ev);
  const ent = app.findCollectionByNameOrId("entitlements");
  ent.fields.removeByName("credits_owed");
  ent.fields.removeByName("pro_void_until");
  app.save(ent);
});
