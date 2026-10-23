
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.OWNER_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const rows = await c.query(`SELECT serial_number, name, created_at, pending_id IS NOT NULL AS offline, record_status FROM fee_payer WHERE council_id='srodae' AND created_at > now() - interval '6 hours' ORDER BY created_at DESC LIMIT 25`);
  for (const r of rows.rows) console.log(r.serial_number.padEnd(10), r.record_status, r.created_at.toISOString().slice(11,19), r.offline ? 'OFFLINE' : 'online ', (r.name||'').slice(0,28));
  const byHour = await c.query(`SELECT date_trunc('hour', created_at) h, count(*)::int n, count(distinct name)::int dn, count(pending_id)::int viaOffline FROM fee_payer WHERE council_id IN ('srodae','anlotown','newtown','nkukwao') AND created_at > now() - interval '12 hours' GROUP BY 1, 0 ORDER BY h DESC`);
  console.log('--- by hour: created | distinct-names | via-offline ---');
  for (const r of byHour.rows) console.log(r.h.toISOString().slice(5,16), 'n=' + r.n, 'distinct=' + r.dn, 'offline=' + r.viaOffline);
  const dup = await c.query(`SELECT council_id, count(*)::int n FROM fee_payer WHERE created_at > now() - interval '12 hours' AND pending_id IS NOT NULL GROUP BY 1`);
  console.log('offline-synced rows in 12h:', JSON.stringify(dup.rows));
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
