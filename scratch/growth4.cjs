const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.OWNER_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const rows = await c.query(`SELECT serial_number, name, created_at::text, (pending_id IS NOT NULL) AS offline, record_status FROM fee_payer WHERE council_id='srodae' AND created_at > now() - interval '8 hours' ORDER BY created_at DESC LIMIT 25`);
  console.log('--- srodae newest rows ---');
  for (const r of rows.rows) console.log(r.serial_number.padEnd(10), r.record_status, String(r.created_at).slice(11,19), r.offline ? 'OFFLINE' : 'online ', (r.name||'').slice(0,28));
  const byHour = await c.query(`SELECT date_trunc('hour', created_at) AS h, count(*)::int AS n, count(DISTINCT name)::int AS dn, count(pending_id)::int AS via_offline FROM fee_payer WHERE council_id IN ('srodae','anlotown','newtown','nkukwao') AND created_at > now() - interval '14 hours' GROUP BY date_trunc('hour', created_at) ORDER BY h DESC`);
  console.log('--- per hour: n | distinct-names | offline-path ---');
  for (const r of byHour.rows) console.log(String(r.h).slice(5,16), 'n='+r.n, 'distinct='+r.dn, 'offline='+r.via_offline);
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
