/// <reference path="../pb_data/types.d.ts" />

// Accounts are created only by the sign-in hook (pb_hooks/auth.pb.js, which saves the record on the
// server and so ignores API rules). PocketBase's default lets anyone POST /api/collections/users/records,
// which skipped Turnstile and the daily code caps and let strangers fill the database and storage.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.createRule = null;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.createRule = "";
  app.save(users);
});
