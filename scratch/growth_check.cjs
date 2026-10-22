
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.OWNER_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const al = await c.query(`SELECT council_id, action, count(*)::int n, max(created_at) last_at FROM audit_log WHERE action='CREATE_RECORD' AND created_at > now() - interval '5 hours' AND council_id IN ('newtown','oldestate') GROUP BY 1,2 ORDER BY 1`);
  console.log('CREATE_RECORD last 5h:', JSON.stringify(al.rows));
  const names = await c.query(`SELECT council_id, serial_number, name, created_at FROM fee_payer WHERE council_id IN ('newtown','oldestate') AND created_at > now() - interval '5 hours' ORDER BY created_at DESC LIMIT 8`);
  for (const r of names.rows) console.log('ROW', r.council_id, r.serial_number, (r.name||'').slice(0,30), r.created_at);
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
