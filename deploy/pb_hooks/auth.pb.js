/// <reference path="../pb_data/types.d.ts" />

// Email-code sign-in for users: a code request for an unknown email creates the account (so sign-up
// and sign-in are one step), and each account can get at most one new code a minute.
onRecordRequestOTPRequest((e) => {
  if (!e.record) {
    const email = String((e.requestInfo().body || {}).email || "").trim().toLowerCase();
    const rec = new Record(e.collection);
    rec.setEmail(email);
    rec.setRandomPassword();
    e.app.save(rec);
    e.record = rec;
  } else {
    const since = new Date(Date.now() - 60e3).toISOString().replace("T", " ");
    const recent = e.app.findRecordsByFilter("_otps", "collectionRef = {:c} && recordRef = {:r} && created > {:t}", "", 1, 0,
      { c: e.collection.id, r: e.record.id, t: since });
    if (recent.length) throw new TooManyRequestsError("We just sent you a code. Wait a minute before asking for another.");
  }
  return e.next();
}, "users");
