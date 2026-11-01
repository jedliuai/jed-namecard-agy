"""Sets up the Paddle catalog and webhook for Super Namecard. Safe to re-run.

  python -I paddle_setup.py ENV_FILE catalog            -> creates/finds products and prices, prints their ids
  python -I paddle_setup.py ENV_FILE webhook URL         -> creates/finds the notification destination and
                                                           prints PADDLE_WEBHOOK_SECRET=... (pipe it, never show it)
  python -I paddle_setup.py ENV_FILE simulate URL EVENT  -> sends a signed test event to the destination

ENV_FILE holds PADDLE_SANDBOX_API_KEY=pdl_sdbx_... (or PADDLE_API_KEY for live).
"""
import json
import sys
import urllib.error
import urllib.request

CATALOG = [
    {
        "sku": "pro",
        "name": "Super Namecard Pro",
        "description": "All card styles, your own link, and unlimited video, GIF and image exports for a year.",
        "price": {"amount": "599", "description": "Pro yearly", "billing_cycle": {"interval": "year", "frequency": 1}},
    },
    {
        "sku": "share_pack",
        "name": "Super Namecard Share Pack",
        "description": "One HD export set of a card style: MP4 video, GIF and JPG images.",
        "price": {"amount": "299", "description": "Share pack, one-off", "billing_cycle": None},
    },
]
EVENTS = [
    "transaction.completed",
    "subscription.created", "subscription.updated", "subscription.activated", "subscription.canceled",
    "subscription.past_due", "subscription.paused", "subscription.resumed", "subscription.trialing",
    "adjustment.created", "adjustment.updated",
]


def load_key(path):
    env = {}
    for line in open(path, encoding="utf-8-sig").read().splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    key = env.get("PADDLE_SANDBOX_API_KEY") or env.get("PADDLE_API_KEY")
    if not key:
        sys.exit("no API key in env file")
    base = "https://sandbox-api.paddle.com" if "_sdbx_" in key else "https://api.paddle.com"
    return key, base


def api(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        err = json.load(e).get("error", {})
        sys.exit(f"{method} {path}: {e.code} {err.get('code')} {err.get('detail')}")


def catalog():
    products = api("GET", "/products?per_page=200&status=active")["data"]
    for item in CATALOG:
        prod = next((p for p in products if (p.get("custom_data") or {}).get("sku") == item["sku"]), None)
        if not prod:
            prod = api("POST", "/products", {"name": item["name"], "description": item["description"],
                                             "tax_category": "standard", "custom_data": {"sku": item["sku"]}})["data"]
        prices = api("GET", f"/prices?product_id={prod['id']}&status=active")["data"]
        p = item["price"]
        price = next((x for x in prices if x["unit_price"]["amount"] == p["amount"] and x["billing_cycle"] == p["billing_cycle"]), None)
        if not price:
            body = {"product_id": prod["id"], "description": p["description"], "name": item["name"],
                    "unit_price": {"amount": p["amount"], "currency_code": "USD"},
                    "quantity": {"minimum": 1, "maximum": 1}, "custom_data": {"sku": item["sku"]}}
            if p["billing_cycle"]:
                body["billing_cycle"] = p["billing_cycle"]
            price = api("POST", "/prices", body)["data"]
        print(f"{item['sku']}: product={prod['id']} price={price['id']} ${int(p['amount']) / 100:.2f}")


def destination(url):
    dests = api("GET", "/notification-settings")["data"]
    d = next((x for x in dests if x["destination"] == url and x["active"]), None)
    if not d:
        d = api("POST", "/notification-settings", {"description": "Super Namecard backend", "destination": url,
                                                   "type": "url", "api_version": 1, "traffic_source": "all",
                                                   "subscribed_events": EVENTS})["data"]
    return d


def main():
    global KEY, BASE
    KEY, BASE = load_key(sys.argv[1])
    cmd = sys.argv[2]
    if cmd == "catalog":
        catalog()
    elif cmd == "webhook":
        d = destination(sys.argv[3])
        # Bytes, so Windows doesn't add a \r that would end up inside the secret.
        sys.stdout.buffer.write(f"PADDLE_WEBHOOK_SECRET={d['endpoint_secret_key']}\n".encode())
        print(f"notification setting {d['id']}", file=sys.stderr)
    elif cmd == "simulate":
        d = destination(sys.argv[3])
        sim = api("POST", "/simulations", {"notification_setting_id": d["id"], "type": sys.argv[4], "name": "namecard check " + sys.argv[4]})["data"]
        run = api("POST", f"/simulations/{sim['id']}/runs")["data"]
        print(f"simulation {sim['id']} run {run['id']} status {run['status']}")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
