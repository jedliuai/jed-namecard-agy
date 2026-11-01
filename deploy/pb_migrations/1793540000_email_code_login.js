/// <reference path="../pb_data/types.d.ts" />

// Sign-in is by emailed code only: no passwords to leak, guess or reset. A first code request also
// creates the account (pb_hooks/auth.pb.js).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.passwordAuth.enabled = false;
  users.otp.enabled = true;
  users.otp.duration = 600;
  users.otp.length = 6;
  users.otp.emailTemplate.subject = "{OTP} is your Super Namecard code";
  users.otp.emailTemplate.body = `<p>Hi,</p>
<p>Your sign-in code for Super Namecard is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:18px 0">{OTP}</p>
<p>It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>
<p>— Super Namecard</p>`;
  // Every sign-in already goes through the inbox, so "new device" alerts would only add noise.
  users.authAlert.enabled = false;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.passwordAuth.enabled = true;
  users.otp.enabled = false;
  users.authAlert.enabled = true;
  app.save(users);
});
