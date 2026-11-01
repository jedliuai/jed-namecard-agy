// Renders a card into a share pack: vertical MP4 (with the style's music), GIF and JPG stills.
// The page runs on a virtual clock (clock.js), so frames are exact and smooth on any machine.
//
//   node render.mjs --base http://127.0.0.1:8771/cards/ --style aurora [--me] --out ./out/aurora
//   or import { renderPack } from "./render.mjs" (the export worker does).
//
// Env: CHROME_CHANNEL=chrome uses the installed Chrome (Windows dev); default is Playwright's Chromium.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdir, rm, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30, W = 360, H = 640, SCALE = 3;           // 1080 × 1920
const DURATION = 14.8;

// What happens when (seconds). The entrance plays by itself from 0. Flips are eased tweens: the
// live card's spring flips in ~0.2 s, too quick to enjoy in a video.
const SCRIPT = [
  [8.4, "c.setLand(true)"],
  [11.6, "c.setLand(false)"],
];
const FLIPS = [[3.2, 1.3, 0, 180], [6.0, 1.3, 180, 360]];   // start, seconds, from, to (degrees)
const STILLS = { front: 2.8, back: 5.2, landscape: 10.9 };
const GIF = [2.2, 7.7];                                       // a loop: front, turn, back, turn, front
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// The card's idle sway, eased flat while it is landscape. Chromium draws a landscape card inside a
// 3D transform with soft, low-resolution text, so once it is flat the 3D transform is dropped too.
const LAND = [8.4, 11.6], SETTLE = 0.8;
function swayAt(t) {
  const [a, b] = LAND;
  const w = t < a || t > b + SETTLE ? 1 : t < a + SETTLE ? 1 - ease((t - a) / SETTLE) : t <= b ? 0 : ease((t - b) / SETTLE);
  return { tx: Math.sin(t * 0.55) * 0.5 * w, ty: Math.cos(t * 0.42) * 0.35 * w, flat: t >= a + SETTLE + 0.4 && t <= b };
}
function flipAt(t) {
  for (const [s, d, a, b] of FLIPS) if (t >= s && t <= s + d) return a + (b - a) * ease((t - s) / d);
  return null;
}

const run = (cmd, argv) => new Promise((res, rej) => {
  const p = spawn(cmd, argv, { stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  p.stderr.on("data", (d) => (err += d));
  p.on("close", (code) => (code === 0 ? res() : rej(new Error(`${cmd} failed (${code}): ${err.slice(-800)}`))));
});

// Renders one style and returns the paths of the files it made (MP4, GIF, three JPGs).
// data: the card's fields (see cards/js/presets.js); without it the showroom preset is used.
export async function renderPack({ style = "noir", base = "http://127.0.0.1:8771/cards/", out, data = null, me = false,
  audioDir = path.join(HERE, "..", "cards", "audio"), keep = false, log = console.log }) {
  const STYLE = style, BASE = base, AUDIO_DIR = audioDir;
  const OUT = path.resolve(out || path.join(HERE, "out", STYLE));
  const t0 = Date.now();
  const frames = path.join(OUT, "frames");
  await rm(OUT, { recursive: true, force: true });
  await mkdir(frames, { recursive: true });

  const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
    page.on("pageerror", (e) => console.error("page error:", e.message));
    await page.addInitScript({ path: path.join(HERE, "clock.js") });
    const url = new URL(BASE);
    url.searchParams.set("style", STYLE);
    url.searchParams.set("render", "1");
    if (me) url.searchParams.set("me", "1");
    // Someone's own card: index.html picks it up in render mode instead of a showroom preset.
    if (data) await page.addInitScript((d) => { window.__cardData = d; }, data);
    await page.goto(url.href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => window.__card);
    if (STYLE === "pop") await page.waitForFunction(() => window.Matter, null, { timeout: 20000 });

    const total = Math.round(DURATION * FPS);
    let next = 0;
    for (let i = 0; i < total; i++) {
      const t = i / FPS;
      while (next < SCRIPT.length && SCRIPT[next][0] <= t) {
        await page.evaluate(`(() => { const c = window.__card; ${SCRIPT[next][1]}; })()`);
        next++;
      }
      const f = flipAt(t);
      await page.evaluate(([f, sway]) => {
        const S = window.__card.state;
        S.dragging = f !== null;          // holds the card's own flip physics off during a tween
        if (f !== null) { S.flip = f; S.flipV = 0; S.flipTarget = null; }
        Object.assign(S.tilt, { tx: sway.tx, ty: sway.ty, src: "script" });
        document.querySelector(".tilt").style.transform = sway.flat ? "none" : "";
      }, [f, swayAt(t)]);
      await page.evaluate((ms) => window.__advance(ms), i === 0 ? 0 : 1000 / FPS);
      await page.screenshot({ path: path.join(frames, String(i).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 94 });
      if (i % 90 === 0) log(`frame ${i}/${total}`);
    }
  } finally {
    await browser.close();
  }

  // Video with the style's music, faded in and out.
  const audio = ["m4a", "webm"].map((e) => path.join(AUDIO_DIR, `${STYLE}.${e}`)).find(existsSync);
  const mp4 = path.join(OUT, `${STYLE}.mp4`);
  const vIn = ["-framerate", String(FPS), "-i", path.join(frames, "%05d.jpg")];
  const vOut = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
  if (audio) {
    await run("ffmpeg", ["-y", ...vIn, "-stream_loop", "-1", "-i", audio, "-t", String(DURATION),
      "-filter_complex", `[1:a]afade=t=in:d=0.5,afade=t=out:st=${DURATION - 1.4}:d=1.4[a]`,
      "-map", "0:v", "-map", "[a]", ...vOut, "-c:a", "aac", "-b:a", "160k", mp4]);
  } else {
    await run("ffmpeg", ["-y", ...vIn, ...vOut, mp4]);
  }

  // GIF: the flip loop only, 360 px wide, 12 fps, one shared palette (keeps it a few MB).
  await run("ffmpeg", ["-y", "-framerate", String(FPS), "-start_number", String(Math.round(GIF[0] * FPS)), "-i", path.join(frames, "%05d.jpg"),
    "-frames:v", String(Math.round((GIF[1] - GIF[0]) * FPS)), "-vf",
    "fps=12,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
    path.join(OUT, `${STYLE}.gif`)]);

  // Stills, straight from the frames (1080 × 1920).
  for (const [name, t] of Object.entries(STILLS)) {
    await copyFile(path.join(frames, String(Math.round(t * FPS)).padStart(5, "0") + ".jpg"), path.join(OUT, `${STYLE}-${name}.jpg`));
  }
  if (!keep) await rm(frames, { recursive: true, force: true });
  const files = (await readdir(OUT)).filter((f) => f !== "frames");
  log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${files.join(", ")}`);
  return files.map((f) => path.join(OUT, f));
}

// CLI: node render.mjs --base URL --style X [--me] [--out DIR] [--keep]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).join(" ").split(/\s+(?=--)/).filter(Boolean).map((s) => {
    const [k, ...v] = s.replace(/^--/, "").split(/\s+/);
    return [k, v.length ? v.join(" ") : true];
  }));
  await renderPack({ style: args.style, base: args.base, out: args.out, me: !!args.me, keep: !!args.keep, audioDir: args.audio || undefined });
}
