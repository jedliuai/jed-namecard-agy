// Public settings for accounts and checkout. Paddle's client-side token is meant to be shipped to browsers.
const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
// While developing locally, ?api=http://localhost:18790 talks to PocketBase through an SSH tunnel.
const asked = local && new URLSearchParams(location.search).get("api");

export const API = asked || "https://api.999368.xyz";
export const PADDLE = {
  env: "sandbox",
  token: "test_97afc8e77516a14895c42ee136d",
  prices: { pro: "pri_01m6bkekw5nm03aasejsx4zsg9", share_pack: "pri_01m6bkepcssndyrrbcevcz7phv" },
};
