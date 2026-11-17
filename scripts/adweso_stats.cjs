// Read-only counts for the Adweso council write-up. Prints no secrets.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const active = await p.$queryRawUnsafe("SELECT count(*)::int AS n FROM fee_payer WHERE council_id='adweso' AND record_status='ACTIVE'");
  const areas = await p.$queryRawUnsafe("SELECT electoral_area, count(*)::int AS n FROM fee_payer WHERE council_id='adweso' AND record_status='ACTIVE' GROUP BY electoral_area ORDER BY count(*) DESC");
  const money = await p.$queryRawUnsafe("SELECT COALESCE(sum(fee),0)::float AS fee_sum, COALESCE(sum(bop_fee),0)::float AS bop_sum FROM fee_payer WHERE council_id='adweso' AND record_status='ACTIVE'");
  const paid = await p.$queryRawUnsafe("SELECT COALESCE(sum(p.amount),0)::float AS collected, count(*)::int AS npay FROM payment p JOIN fee_payer f ON p.fee_payer_id = f.id WHERE f.council_id='adweso'");
  const users = await p.$queryRawUnsafe("SELECT username, role, COALESCE(admin_level,'-') AS lvl FROM app_user WHERE council_id='adweso'");
  const sms = await p.$queryRawUnsafe("SELECT type, count(*)::int AS n FROM sms_send WHERE council_id='adweso' AND status='SENT' GROUP BY type");
  const gps = await p.$queryRawUnsafe("SELECT count(*)::int AS n FROM fee_payer WHERE council_id='adweso' AND record_status='ACTIVE' AND latitude IS NOT NULL");
  console.log(JSON.stringify({ active: active[0].n, areas, money: money[0], collections: paid[0], users, smsSent: sms, withGps: gps[0].n }, null, 1));
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
