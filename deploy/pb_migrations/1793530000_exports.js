/// <reference path="../pb_data/types.d.ts" />

// Share-pack exports. Created only by POST /api/exports (pb_hooks/exports.pb.js), which checks what
// the user paid for; the render worker fills in the files. Owners can read their own exports.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  app.save(new Collection({
    type: "base",
    name: "exports",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "style", type: "text", required: true, max: 32 },
      { name: "card", type: "json", maxSize: 8192 },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["queued", "rendering", "done", "failed"] },
      { name: "paid_with", type: "select", maxSelect: 1, values: ["pro", "credit"] },
      { name: "attempts", type: "number", onlyInt: true, min: 0 },
      { name: "error", type: "text", max: 500 },
      { name: "files", type: "file", maxSelect: 8, maxSize: 31457280, protected: true,
        mimeTypes: ["video/mp4", "image/gif", "image/jpeg"] },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_exports_status ON exports (status, created)", "CREATE INDEX idx_exports_user ON exports (user, created)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("exports")); } catch (_) {}
});
