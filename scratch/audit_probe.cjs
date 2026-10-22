const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.OWNER_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const fp = await c.query(`SELECT id, council_id, serial_number, name, created_at, updated_at, pending_id, record_status FROM fee_payer WHERE council_id='ogua' ORDER BY created_at DESC LIMIT 5`);
  console.log('fee_payer ogua rows:', JSON.stringify(fp.rows, null, 1));
  const al = await c.query(`SELECT action, entity_id, details, created_at FROM audit_log WHERE council_id='ogua' ORDER BY created_at DESC LIMIT 5`);
  for (const r of al.rows) console.log('AUDIT', r.action, r.created_at, JSON.stringify(r.details).slice(0,140));
  const lic = await c.query(`SELECT * FROM license_state WHERE id='ogua'`);
  console.log('license_state ogua:', JSON.stringify(lic.rows));
  const cnt = await c.query(`SELECT serial_counter.* FROM serial_counter WHERE council_id='ogua'`);
  console.log('serial_counter:', JSON.stringify(cnt.rows));
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
