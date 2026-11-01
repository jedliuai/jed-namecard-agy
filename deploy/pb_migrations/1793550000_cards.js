/// <reference path="../pb_data/types.d.ts" />

// Each account's own card: what the styles show, plus its link name (slug.999368.xyz) and photo.
// One card per account for now. Only the owner can read or change it; exports read it server-side.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const text = (name, max, extra = {}) => ({ name, type: "text", max, ...extra });
  app.save(new Collection({
    type: "base",
    name: "cards",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: "@request.auth.id != '' && @request.auth.collectionName = 'users' && user = @request.auth.id",
    updateRule: "user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
    deleteRule: "user = @request.auth.id",
    fields: [
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      text("slug", 30, { required: true, min: 3, pattern: "^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$" }),
      text("style", 32),
      text("name", 60, { required: true }),
      text("sub", 80), text("title", 80), text("company", 80),
      text("phone", 40), text("wa", 40), text("email", 100),
      text("stat", 40), text("greet", 60), text("industry", 40), text("no", 20),
      { name: "avatar", type: "file", maxSelect: 1, maxSize: 3145728, mimeTypes: ["image/jpeg", "image/png", "image/webp"], thumbs: ["256x256"] },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_cards_user ON cards (user)", "CREATE UNIQUE INDEX idx_cards_slug ON cards (slug)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("cards")); } catch (_) {}
});
