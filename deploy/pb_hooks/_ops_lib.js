// The daily report emailed to the operator: what happened in the last 24 hours (sign-ups, payments,
// exports, errors) and whether the server is keeping up (sign-in email budget, backups, disk).
// Sent every day even when nothing happened, so a missing report is itself the alarm.
// Used by ops.pb.js (cron and a superuser-only "send now" route).

const OTP_CAP = 80; // keep in step with DAY_TOTAL in auth.pb.js

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const since = (ms) => new Date(Date.now() - ms).toISOString().replace("T", " ");

function build(app) {
  const day = since(864e5);
  const flags = []; // things that need a look, also counted in the subject
  // countRecords takes SQL (AND/OR), not the filter syntax findRecordsByFilter uses.
  const count = (coll, filter, params) => { try { return app.countRecords(coll, $dbx.exp(filter, params || {})); } catch (_) { return -1; } };
  const rows = (coll, filter, params, limit) => { try { return app.findRecordsByFilter(coll, filter, "-created", limit || 200, 0, params || {}); } catch (_) { return []; } };

  // People
  const newUsers = count("users", "verified = TRUE AND created > {:t}", { t: day });
  const pending = count("users", "verified = FALSE AND created > {:t}", { t: day });
  const allUsers = count("users", "verified = TRUE");
  const pro = count("entitlements", "pro_until > {:n}", { n: since(0) });
  const otp = count("otp_sends", "created > {:t}", { t: day });
  if (otp >= OTP_CAP * 0.75) flags.push(`验证码 24 小时内已发 ${otp}/${OTP_CAP} 封，接近每日上限，考虑升级 Resend 并调高上限`);

  // Money
  const money = [];
  let income = 0, refunds = 0;
  for (const r of rows("creem_events", "created > {:t}", { t: day })) {
    const type = r.getString("event_type"), note = r.getString("note");
    let amt = "";
    try {
      const o = (JSON.parse(toString(r.get("payload"))).object) || {};
      const cents = type === "checkout.completed" ? (o.order || {}).amount : type === "refund.created" ? o.refund_amount : null;
      if (cents != null) {
        amt = "$" + (Number(cents) / 100).toFixed(2);
        if (type === "checkout.completed") income += Number(cents); else refunds += Number(cents);
      }
    } catch (_) {}
    money.push(`${r.getString("created").slice(5, 16)} UTC · ${type}${amt ? " · " + amt : ""} · ${note}`);
    if (/no user|unknown|review by hand|owed/.test(note)) flags.push(`付款事件需要人工看一下：${type} · ${note}`);
  }

  // Exports
  const done = count("exports", "status = 'done' AND updated > {:t}", { t: day });
  const failed = rows("exports", "status = 'failed' && updated > {:t}", { t: day }, 20);
  const stuck = count("exports", "status IN ('queued', 'rendering') AND created < {:t}", { t: since(30 * 60e3) });
  if (failed.length) flags.push(`${failed.length} 个导出失败（已自动退回额度）：${failed[0].getString("error").slice(0, 120)}`);
  if (stuck > 0) flags.push(`${stuck} 个导出排队超过 30 分钟，渲染容器可能停了`);

  // Errors and warnings logged by the app. PocketBase logs every failed request at error level, and
  // bots probing for /wp-admin or /.env make plenty of 404s, so requests count only when they are 5xx.
  const errs = {};
  try {
    const list = arrayOf(new DynamicModel({ level: 0, message: "", data: "" }));
    app.logQuery().andWhere($dbx.exp("created > {:t} AND level >= 4 AND (json_extract(data, '$.type') IS NOT 'request' OR json_extract(data, '$.status') >= 500)", { t: day }))
      .orderBy("created DESC").limit(500).all(list);
    for (const l of list) {
      let d = {};
      try { d = JSON.parse(l.data) || {}; } catch (_) {}
      const key = (l.level >= 8 ? "错误 " : "警告 ") + l.message + (d.error ? " · " + String(d.error).slice(0, 120) : "") + (d.status ? " · " + d.status : "");
      errs[key] = (errs[key] || 0) + 1;
    }
  } catch (err) { errs["读取日志失败 · " + String(err).slice(0, 120)] = 1; }
  const errLines = Object.entries(errs).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `${n}× ${k}`);
  if (Object.keys(errs).some((k) => k.startsWith("错误"))) flags.push("日志里有错误，见下方");

  // Backups and disk
  let backup = "没有找到";
  try {
    const fs = app.newBackupsFilesystem();
    try {
      const files = fs.list("").filter((f) => f && f.key.endsWith(".zip")).sort((a, b) => b.modTime.unix() - a.modTime.unix());
      if (files.length) {
        const f = files[0], age = (Date.now() / 1000 - f.modTime.unix()) / 3600;
        backup = `${f.key} · ${(f.size / 1048576).toFixed(1)} MB · ${age.toFixed(0)} 小时前 · 共 ${files.length} 份`;
        if (age > 26) flags.push(`最新备份已是 ${age.toFixed(0)} 小时前，备份可能失败了`);
      } else flags.push("备份存储里一份备份都没有");
    } finally { fs.close(); }
  } catch (err) { backup = "读取失败：" + String(err).slice(0, 120); flags.push("读不到备份存储"); }
  let disk = "";
  try {
    disk = toString($os.cmd("df", "-h", "/").output()).trim().split("\n").pop();
    const pct = Number((disk.match(/(\d+)%/) || [])[1]);
    if (pct >= 80) flags.push(`磁盘已用 ${pct}%`);
  } catch (_) { disk = "读取失败"; }

  const date = new Date(Date.now() + 8 * 3600e3).toISOString().slice(5, 10); // Beijing date
  const subject = `[1name.cards] ${date} 日报 · 新用户 ${newUsers} · 收入 $${(income / 100).toFixed(2)}` + (flags.length ? ` · ⚠ ${flags.length} 项要看` : " · 一切正常");
  const li = (a, empty) => (a.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p style="color:#888">${empty}</p>`);
  const html = `<div style="font:14px/1.6 system-ui,sans-serif;color:#222;max-width:640px">
<h2 style="margin:0 0 8px">1name.cards 过去 24 小时</h2>
${flags.length ? `<div style="background:#fff3cd;border:1px solid #e6c65c;border-radius:8px;padding:10px 14px;margin:10px 0"><b>需要看一下</b>${li(flags)}</div>` : `<p style="color:#2a7a2a"><b>一切正常</b></p>`}
<h3>用户</h3><ul><li>新注册（已验证）：${newUsers}　·　未完成验证：${pending}</li><li>已验证用户总数：${allUsers}　·　当前 Pro：${pro}</li><li>验证码：${otp} / ${OTP_CAP} 封</li></ul>
<h3>收入</h3><p>收入 $${(income / 100).toFixed(2)}　·　退款 $${(refunds / 100).toFixed(2)}（Creem 扣手续费前）</p>${li(money, "没有付款事件")}
<h3>导出</h3><ul><li>完成 ${done}　·　失败 ${failed.length}　·　卡住 ${stuck}</li></ul>
<h3>错误和警告</h3>${li(errLines, "没有")}
<h3>服务器</h3><ul><li>最新备份：${esc(backup)}</li><li>磁盘：<code>${esc(disk)}</code></li></ul>
<p style="color:#888;font-size:12px">每天北京时间 9 点发送。哪天没收到，说明服务器或邮件出了问题。</p></div>`;
  return { subject, html, flags };
}

module.exports = {
  send(app) {
    const r = build(app);
    const meta = app.settings().meta;
    app.newMailClient().send(new MailerMessage({
      from: { address: meta.senderAddress, name: meta.senderName || "Super Namecard" },
      to: [{ address: ($os.getenv("DIGEST_TO") || "support@1name.cards").trim() }],
      subject: r.subject,
      html: r.html,
    }));
    return { subject: r.subject, flags: r.flags };
  },
};
