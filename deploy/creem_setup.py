"""Creates the Creem products and webhook for Super Namecard and records their IDs. Safe to re-run.

Runs on the server as root: sudo python3 creem_setup.py /opt/namecard/secrets/creem.env
The file needs CREEM_API_KEY (creem_test_… for test mode). Product IDs and the webhook's signing
secret are written back into the same file and never printed, then restart PocketBase.
"""
import json
import os
import sys
import urllib.error
import urllib.request

ENV = sys.argv[1]
WEBHOOK_URL = "https://api.1name.cards/api/creem/webhook"
EVENTS = ["checkout.completed", "subscription.active", "subscription.paid", "subscription.trialing", "subscription.update",
          "subscription.scheduled_cancel", "subscription.canceled", "subscription.expired", "subscription.past_due",
          "subscription.unpaid", "subscription.paused", "refund.created", "dispute.created"]
PRODUCTS = {
    "CREEM_PRODUCT_PRO": {"name": "Super Namecard Pro", "price": 990, "billing_type": "recurring", "billing_period": "every-year",
                          "description": "Your live card link, and video, GIF and image exports (up to 20 a day) for a year."},
    "CREEM_PRODUCT_SHARE_PACK": {"name": "Super Namecard Share Pack", "price": 299, "billing_type": "onetime",
                                 "description": "One HD export of your card in one style: MP4 video with music, GIF and JPG images."},
}

env = {}
for line in open(ENV, encoding="utf-8").read().splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
key = env.get("CREEM_API_KEY", "")
if not key:
    sys.exit("CREEM_API_KEY missing")
base = "https://test-api.creem.io" if key.startswith("creem_test_") else "https://api.creem.io"
mode = "test" if key.startswith("creem_test_") else "live"


def api(method, path, body=None, idem=None):
    headers = {"x-api-key": key, "Content-Type": "application/json"}
    if idem:
        headers["Idempotency-Key"] = idem
    req = urllib.request.Request(base + path, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path}: {e.code} {e.read()[:300].decode(errors='replace')}")


for var, p in PRODUCTS.items():
    if env.get(var):
        print(f"{var}: kept {env[var]}")
        continue
    # Tax-inclusive, so the price shown is the price paid, as on the site.
    prod = api("POST", "/v1/products", {**p, "currency": "USD", "tax_mode": "inclusive", "tax_category": "saas",
                                       "default_success_url": "https://1name.cards/"}, idem=f"namecard-{mode}-{var}")
    env[var] = prod["id"]
    print(f"{var}: created {prod['id']} ({prod.get('price')} {prod.get('currency')}, {prod.get('billing_type')}, tax {prod.get('tax_mode')})")

if env.get("CREEM_WEBHOOK_SECRET"):
    print("webhook: secret already stored, left as is")
else:
    hook = api("POST", "/v1/webhooks", {"url": WEBHOOK_URL, "name": "Super Namecard backend", "events": EVENTS}, idem=f"namecard-{mode}-webhook")
    if not hook.get("secret"):
        sys.exit("webhook created but no secret returned; copy it from the dashboard into CREEM_WEBHOOK_SECRET")
    env["CREEM_WEBHOOK_SECRET"] = hook["secret"]
    print(f"webhook: created {hook.get('id')} for {hook.get('url')}, {len(hook.get('events') or [])} events, secret stored")

env.setdefault("PAYMENTS", "creem")
tmp = ENV + ".new"
fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as f:
    for k in ["PAYMENTS", "CREEM_API_KEY", "CREEM_PRODUCT_PRO", "CREEM_PRODUCT_SHARE_PACK", "CREEM_WEBHOOK_SECRET"]:
        f.write(f"{k}={env.get(k, '')}\n")
os.replace(tmp, ENV)
print(f"saved ({mode} mode)")
