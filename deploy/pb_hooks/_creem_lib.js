// Shared by creem.pb.js (PocketBase runs each handler in its own context).
// Creem settings live in /opt/namecard/secrets/creem.env (see deploy/creem.env.example).
// The API key's prefix picks the environment: creem_test_… is test mode, anything else is live.

const key = () => $os.getenv("CREEM_API_KEY").trim();
const base = () => (key().startsWith("creem_test_") ? "https://test-api.creem.io" : "https://api.creem.io");

module.exports = {
  key,
  mode: () => (key().startsWith("creem_test_") ? "test" : "live"),
  enabled: () => $os.getenv("PAYMENTS").trim() === "creem" && !!key(),
  product: (sku) => $os.getenv(sku === "pro" ? "CREEM_PRODUCT_PRO" : "CREEM_PRODUCT_SHARE_PACK").trim(),
  // A Creem API call; throws with Creem's message when it fails.
  api(method, path, body) {
    const res = $http.send({
      url: base() + path,
      method,
      headers: { "x-api-key": key(), "content-type": "application/json" },
      body: body === undefined ? "" : JSON.stringify(body),
      timeout: 20,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const msg = (res.json && (res.json.message || res.json.error)) || toString(res.body).slice(0, 200);
      throw new Error(`Creem ${method} ${path}: ${res.statusCode} ${Array.isArray(msg) ? msg.join("; ") : msg}`);
    }
    return res.json;
  },
};
