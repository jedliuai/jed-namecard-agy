// Shared by paddle.pb.js (PocketBase runs each handler in its own context).
// Which Paddle account the site uses is server configuration, not code: PADDLE_ENV ("sandbox" or
// "live"), PADDLE_CLIENT_TOKEN, PADDLE_PRICE_PRO, PADDLE_PRICE_SHARE_PACK and PADDLE_WEBHOOK_SECRET in
// /opt/namecard/secrets/paddle.env (see deploy/paddle.env.example). Switching to live is a change
// to that file and a restart.

const env = () => ($os.getenv("PADDLE_ENV").trim() === "live" ? "live" : "sandbox");

// Paddle sends webhooks only from the addresses its /ips endpoint lists (the list can change, so it
// is fetched, cached for 6 hours, and the last good copy kept if a refresh fails).
function paddleIPs(app) {
  const key = "paddle_ips_" + env();
  const cached = app.store().get(key);
  if (cached && Date.now() - cached.at < 6 * 3600e3) return cached.list;
  try {
    const res = $http.send({ url: env() === "live" ? "https://api.paddle.com/ips" : "https://sandbox-api.paddle.com/ips", method: "GET", timeout: 10 });
    const list = res.statusCode === 200 && res.json && res.json.data && res.json.data.ipv4_cidrs;
    if (list && list.length) {
      app.store().set(key, { at: Date.now(), list });
      return list;
    }
  } catch (_) {}
  return cached ? cached.list : null;
}

function inCidr(ip, cidr) {
  const toInt = (a) => a.split(".").reduce((n, o) => (n << 8) + (Number(o) & 255), 0) >>> 0;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const [base, bits = "32"] = cidr.split("/");
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (toInt(ip) & mask) === (toInt(base) & mask);
}

module.exports = {
  env,
  // null: the list could not be fetched and nothing is cached.
  fromPaddle(app, ip) {
    const list = paddleIPs(app);
    return list ? list.some((c) => inCidr(ip, c)) : null;
  },
  publicConfig() {
    return {
      env: env(),
      token: $os.getenv("PADDLE_CLIENT_TOKEN").trim(),
      prices: { pro: $os.getenv("PADDLE_PRICE_PRO").trim(), share_pack: $os.getenv("PADDLE_PRICE_SHARE_PACK").trim() },
    };
  },
};
