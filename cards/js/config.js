// Public settings for accounts and checkout. Paddle's client-side token is meant to be shipped to browsers.
const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
// While developing locally, ?api=http://localhost:18790 talks to PocketBase through an SSH tunnel.
const asked = local && new URLSearchParams(location.search).get("api");

export const API = asked || "https://api.1name.cards";
// Cloudflare Turnstile site key for the sign-in form (public by design). Empty: no human check.
export const TURNSTILE = "0x4AAAAAAFwo4EewmpTIfABy";
export const PADDLE = {
  env: "sandbox",
  token: "test_97afc8e77516a14895c42ee136d",
  prices: { pro: "pri_01m6bnhxmy7jtsanzgjtjvk1aj", share_pack: "pri_01m6bnj25h0ne973agxqc7jets" },
};
