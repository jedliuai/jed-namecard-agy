/// <reference path="../pb_data/types.d.ts" />

// Email-code sign-in for users: a code request for an unknown email creates the account (so sign-up
// and sign-in are one step), and each account can get at most one new code a minute.
// Daily caps keep a flood of requests from using up Resend's free 100 emails a day (or getting the
// sender suspended for mail to random addresses): at most 80 codes in 24 hours in all, and 5 per email.
onRecordRequestOTPRequest((e) => {
  const DAY_TOTAL = 80, DAY_PER_EMAIL = 5;
  const body = e.requestInfo().body || {};
  const email = String(body.email || "").trim().toLowerCase();

  // Cloudflare Turnstile, once its secret is configured: no valid token from the sign-in form, no email.
  const secret = $os.getenv("TURNSTILE_SECRET").trim();
  if (secret) {
    const token = String(body.turnstile || "");
    if (!token) throw new BadRequestError("Please confirm you're human.");
    const form = (o) => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
    let ok = false;
    try {
      const res = $http.send({
        url: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form({ secret, response: token, remoteip: e.request.header.get("CF-Connecting-IP") || "" }),
        timeout: 10,
      });
      ok = res.statusCode === 200 && res.json && res.json.success === true;
    } catch (_) {}
    if (!ok) throw new BadRequestError("Please confirm you're human.");
  }

  const since = (ms) => new Date(Date.now() - ms).toISOString().replace("T", " ");
  const count = (filter, params) => e.app.countRecords("otp_sends", $dbx.exp(filter, params));
  if (count("created > {:t}", { t: since(864e5) }) >= DAY_TOTAL) {
    throw new TooManyRequestsError("Sign-in is very busy right now. Please try again in a few hours.");
  }
  if (count("email = {:m} AND created > {:t}", { m: email, t: since(864e5) }) >= DAY_PER_EMAIL) {
    throw new TooManyRequestsError("Too many codes for this email today. Use the last code we sent, or try again tomorrow.");
  }

  if (!e.record) {
    const rec = new Record(e.collection);
    rec.setEmail(email);
    rec.setRandomPassword();
    e.app.save(rec);
    e.record = rec;
  } else {
    const recent = e.app.findRecordsByFilter("_otps", "collectionRef = {:c} && recordRef = {:r} && created > {:t}", "", 1, 0,
      { c: e.collection.id, r: e.record.id, t: since(60e3) });
    if (recent.length) throw new TooManyRequestsError("We just sent you a code. Wait a minute before asking for another.");
  }
  e.next();
  const log = new Record(e.app.findCollectionByNameOrId("otp_sends"));
  log.set("email", email);
  e.app.save(log);
}, "users");

// Daily: accounts that asked for a code but never signed in (a successful code sign-in verifies the
// email) are removed after two days, and the send log keeps three days.
cronAdd("accounts-cleanup", "41 3 * * *", () => {
  const since = (ms) => new Date(Date.now() - ms).toISOString().replace("T", " ");
  for (const u of $app.findRecordsByFilter("users", "verified = false && created < {:t}", "", 500, 0, { t: since(2 * 864e5) })) {
    let paid = false;
    try { $app.findFirstRecordByData("entitlements", "user", u.id); paid = true; } catch (_) {}
    if (!paid) $app.delete(u);
  }
  for (const r of $app.findRecordsByFilter("otp_sends", "created < {:t}", "", 1000, 0, { t: since(3 * 864e5) })) $app.delete(r);
});
