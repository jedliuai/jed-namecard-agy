// ?debug: a small overlay for chasing freezes on a real phone. It shows frames per second, the
// longest pause in the last 10 s, every pause over 1 s with what was on screen, memory where the
// browser reports it, and the last errors. A screenshot of it is the bug report.
export function mountDebug() {
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:6px;bottom:6px;z-index:99;max-width:min(330px,calc(100vw - 12px));padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.78);color:#9f9;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;pointer-events:none;white-space:pre-wrap";
  document.body.appendChild(box);
  const stalls = [], errs = [], recent = [];
  let frames = 0, fps = 0, last = performance.now(), t1 = last, lastAct = "load";
  const now = () => new Date().toTimeString().slice(0, 8);
  const what = () => {
    const r = document.documentElement;
    const style = (r.className.match(/\bst-(\S+)/) || [])[1] || "?";
    const busy = document.getElementById("stage")?.dataset.busy ? " morphing" : "";
    return `${style}${r.classList.contains("land") ? " land" : ""}${busy}${r.classList.contains("editing") ? " editing" : ""}`;
  };
  addEventListener("click", (e) => {
    const b = e.target.closest("button,a");
    if (b) lastAct = (b.dataset.s || b.dataset.a || b.textContent || "").trim().slice(0, 16);
  }, true);
  addEventListener("pointerdown", () => { lastAct = lastAct.startsWith("swipe") ? lastAct : "swipe/tap"; }, true);
  addEventListener("error", (e) => errs.push(`${now()} ${e.message}`.slice(0, 120)));
  addEventListener("unhandledrejection", (e) => errs.push(`${now()} ${e.reason}`.slice(0, 120)));
  document.addEventListener("visibilitychange", () => { last = performance.now(); });
  (function frame(t) {
    const d = t - last;
    last = t;
    frames++;
    if (!document.hidden) {
      recent.push([t, d]);
      if (d > 1000) stalls.push(`${now()} ${(d / 1000).toFixed(1)}s · ${what()} · after ${lastAct}`);
    }
    while (recent.length && t - recent[0][0] > 10000) recent.shift();
    if (t - t1 >= 1000) { fps = Math.round((frames * 1000) / (t - t1)); frames = 0; t1 = t; paint(); }
    requestAnimationFrame(frame);
  })(last);
  function paint() {
    const worst = Math.round(Math.max(0, ...recent.map((x) => x[1])));
    const mem = performance.memory ? ` · heap ${Math.round(performance.memory.usedJSHeapSize / 1e6)} MB` : "";
    box.textContent = [
      `${fps} fps · worst ${worst} ms (10 s)${mem} · ${document.getElementsByTagName("*").length} nodes`,
      `now: ${what()} · last: ${lastAct}`,
      stalls.length ? `pauses over 1 s (${stalls.length}):\n  ${stalls.slice(-4).join("\n  ")}` : "no pauses over 1 s",
      errs.length ? `errors:\n  ${errs.slice(-3).join("\n  ")}` : "",
      navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 110),
    ].filter(Boolean).join("\n");
  }
}
