/// <reference path="../pb_data/types.d.ts" />

// The app's own files (pb_public) change with every deploy and the pages load them by fixed names,
// so browsers must check back each time (an unchanged file is a quick 304). Without a header
// Cloudflare tells browsers to keep them for 4 hours, and people kept running old code after a deploy.
// Music and images rarely change and are large, so they keep a day.
// A path with no file behind it is a real 404. PocketBase would otherwise answer with the home page and
// status 200, which search engines count as duplicate pages and which hid deleted files.
routerUse((e) => {
  const path = e.request.url.path;
  if ((e.request.method === "GET" || e.request.method === "HEAD") && path !== "/" && !path.startsWith("/api/") && !path.startsWith("/_/")) {
    const file = path.endsWith("/") ? path + "index.html" : path;
    let found = false;
    try { found = !file.includes("..") && !$os.stat(`${__hooks}/../pb_public${file}`).isDir(); } catch (_) {}
    if (!found) throw new NotFoundError();
  }
  return e.next();
});

routerUse((e) => {
  const path = e.request.url.path;
  if (e.request.method === "GET" && !path.startsWith("/api/") && !path.startsWith("/_/")) {
    e.response.header().set("Cache-Control", /^\/(audio|assets)\//.test(path) ? "public, max-age=86400" : "no-cache");
  }
  return e.next();
});
