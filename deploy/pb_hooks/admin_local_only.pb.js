/// <reference path="../pb_data/types.d.ts" />

// The admin UI, superuser auth and the management API answer only on the server itself
// (reach them over an SSH tunnel). Everything from the internet comes through Cloudflare,
// which always adds a Cf-Ray header, and gets a plain 404 for those paths.
routerUse((e) => {
  if (!e.request.header.get("Cf-Ray")) return e.next();
  const path = e.request.url.path;
  if (path === "/_" || path.startsWith("/_/")) throw new NotFoundError();
  if (/^\/api\/(settings|backups|logs|crons)(\/|$)/.test(path)) throw new NotFoundError();
  const m = path.match(/^\/api\/collections(?:\/([^/]+)(\/[^/]*)?)?/);
  if (m) {
    // Only record CRUD and the user auth flows are public.
    if (!m[1] || !/^\/(records|auth-|request-|confirm-)/.test(m[2] || "")) throw new NotFoundError();
    let col = null;
    try { col = e.app.findCachedCollectionByNameOrId(m[1]); } catch (_) {}
    if (col && col.name === "_superusers") throw new NotFoundError();
  }
  return e.next();
});
