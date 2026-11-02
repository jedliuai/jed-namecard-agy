// Public settings for accounts. Paddle's account, token and prices come from the server (/api/paddle/config).
const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
// While developing locally, ?api=http://localhost:18790 talks to PocketBase through an SSH tunnel.
const asked = local && new URLSearchParams(location.search).get("api");

export const API = asked || "https://api.1name.cards";
// Cloudflare Turnstile site key for the sign-in form (public by design). Empty: no human check.
export const TURNSTILE = "0x4AAAAAAFwo4EewmpTIfABy";
