// Export worker: claims queued exports from the backend, renders them and uploads the files.
// Runs in its own container and talks to the backend only through its public API, with a token
// that can do nothing but claim, finish and fail export jobs (deploy/pb_hooks/exports.pb.js).
//
// Env: RENDER_WORKER_TOKEN (required), API_URL, SITE_DIR (holds cards/), WORK_DIR.
import http from "node:http";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPack } from "./render.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL || "https://api.999368.xyz";
const TOKEN = process.env.RENDER_WORKER_TOKEN;
const SITE = path.resolve(process.env.SITE_DIR || path.join(HERE, "site"));
const WORK = process.env.WORK_DIR || "/tmp/exports";
const TIMEOUT = 10 * 60e3;
const PORT = 8780;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webm": "audio/webm", ".m4a": "audio/mp4",
  ".mp4": "video/mp4", ".gif": "image/gif",
};
if (!TOKEN) throw new Error("RENDER_WORKER_TOKEN is not set");

const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The card site, served on the container's own loopback for the headless browser.
http.createServer(async (req, res) => {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(SITE, rel);
  if (!file.startsWith(SITE + path.sep)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT, "127.0.0.1");

async function call(p, init = {}) {
  const r = await fetch(API + p, { ...init, headers: { "x-worker-token": TOKEN, ...init.headers } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p}: ${r.status} ${d.message || ""}`);
  return d;
}

async function work(job) {
  const out = path.join(WORK, job.id);
  const started = Date.now();
  log(`${job.id} ${job.style} start`);
  let timer;
  try {
    const files = await Promise.race([
      renderPack({ style: job.style, data: job.card, base: `http://127.0.0.1:${PORT}/cards/`, out,
        audioDir: path.join(SITE, "cards", "audio"), log: (m) => log(`${job.id} ${m}`) }),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("Render took too long")), TIMEOUT); }),
    ]);
    const form = new FormData();
    for (const f of files) form.append("files", new Blob([await readFile(f)], { type: TYPES[path.extname(f)] }), path.basename(f));
    await call(`/api/worker/finish/${job.id}`, { method: "POST", body: form });
    log(`${job.id} done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  } catch (e) {
    log(`${job.id} failed: ${e.message}`);
    await call(`/api/worker/fail/${job.id}`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: String(e.message).slice(0, 400) }) }).catch((e2) => log(`${job.id} could not report failure: ${e2.message}`));
    // A render that hung may have left a browser behind; start clean (the service restarts us).
    if (/too long/.test(e.message)) process.exit(1);
  } finally {
    clearTimeout(timer);
    await rm(out, { recursive: true, force: true });
  }
}

log(`worker up, API ${API}`);
for (;;) {
  let job = null;
  try {
    job = (await call("/api/worker/claim", { method: "POST" })).job;
  } catch (e) {
    log(e.message);
    await sleep(15e3);
    continue;
  }
  if (job) await work(job);
  else await sleep(4e3);
}
