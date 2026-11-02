/// <reference path="../pb_data/types.d.ts" />

// Each card shows one messenger: WhatsApp (QR made from the number, or the owner's own QR picture)
// or WeChat (the owner's own QR picture and, optionally, their WeChat ID).
migrate((app) => {
  const cards = app.findCollectionByNameOrId("cards");
  cards.fields.add(new TextField({ name: "im", max: 10, pattern: "^(wa|wechat)?$" }));
  cards.fields.add(new TextField({ name: "wechat", max: 40 }));
  cards.fields.add(new FileField({ name: "qr", maxSelect: 1, maxSize: 2097152, mimeTypes: ["image/jpeg", "image/png", "image/webp"] }));
  app.save(cards);
}, (app) => {
  const cards = app.findCollectionByNameOrId("cards");
  for (const f of ["im", "wechat", "qr"]) cards.fields.removeByName(f);
  app.save(cards);
});
