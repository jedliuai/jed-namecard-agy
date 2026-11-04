/// <reference path="../pb_data/types.d.ts" />

// The app's own files (pb_public) change with every deploy and the pages load them by fixed names,
// so browsers must check back each time (an unchanged file is a quick 304). Without a header
// Cloudflare tells browsers to keep them for 4 hours, and people kept running old code after a deploy.
// Music and images rarely change and are large, so they keep a day.
// A path with no file behind it is a real 404. PocketBase would otherwise answer with the home page and
// status 200, which search engines count as duplicate pages and which hid deleted files.
// Every page has one address: visitors who arrive over plain http (Cloudflare says so in CF-Visitor)
// move to https, and a folder page asked for without its slash (/terms) moves to /terms/. Search
// engines otherwise see two copies of each page, or a 404 for a link someone typed without the slash.
routerUse((e) => {
  const method = e.request.method;
  if (method === "GET" || method === "HEAD") {
    const q = e.request.url.rawQuery ? "?" + e.request.url.rawQuery : "";
    if ((e.request.header.get("CF-Visitor") || "").includes('"http"')) {
      return e.redirect(301, `https://${e.request.host}${e.request.url.path}${q}`);
    }
  }
  return e.next();
});

routerUse((e) => {
  const path = e.request.url.path;
  if ((e.request.method === "GET" || e.request.method === "HEAD") && path !== "/" && !path.startsWith("/api/") && !path.startsWith("/_/")) {
    const file = path.endsWith("/") ? path + "index.html" : path;
    const isFile = (f) => { try { return !f.includes("..") && !$os.stat(`${__hooks}/../pb_public${f}`).isDir(); } catch (_) { return false; } };
    if (!isFile(file)) {
      if (!path.endsWith("/") && !/\.[a-z0-9]+$/i.test(path) && isFile(path + "/index.html")) {
        const q = e.request.url.rawQuery ? "?" + e.request.url.rawQuery : "";
        return e.redirect(301, path + "/" + q);
      }
      throw new NotFoundError();
    }
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
