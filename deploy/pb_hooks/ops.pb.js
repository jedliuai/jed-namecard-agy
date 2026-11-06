/// <reference path="../pb_data/types.d.ts" />

// Daily report to the operator, 01:00 UTC (09:00 in Beijing). See _ops_lib.js.
cronAdd("daily-digest", "0 1 * * *", () => {
  try {
    require(`${__hooks}/_ops_lib.js`).send($app);
  } catch (err) {
    $app.logger().error("daily digest failed", "error", String(err));
  }
});

// Send the report now (superusers only), to check it after a change.
routerAdd("POST", "/api/ops/digest", (e) => {
  return e.json(200, require(`${__hooks}/_ops_lib.js`).send(e.app));
}, $apis.requireSuperuserAuth());
