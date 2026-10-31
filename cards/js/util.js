// Tiny animation helpers shared by the runtime and the morphs.
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const play = (el, kf, o) => el.animate(kf, o).finished.catch(() => {});
