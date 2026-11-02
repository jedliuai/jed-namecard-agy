/// <reference path="../pb_data/types.d.ts" />

// The app's own files (pb_public) change with every deploy and the pages load them by fixed names,
// so browsers must check back each time (an unchanged file is a quick 304). Without a header
// Cloudflare tells browsers to keep them for 4 hours, and people kept running old code after a deploy.
// Music and images rarely change and are large, so they keep a day.
routerUse((e) => {
  const path = e.request.url.path;
  if (e.request.method === "GET" && !path.startsWith("/api/") && !path.startsWith("/_/")) {
    e.response.header().set("Cache-Control", /^\/(audio|assets)\//.test(path) ? "public, max-age=86400" : "no-cache");
  }
  return e.next();
});
