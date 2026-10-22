const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.OWNER_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const before = await c.query(`SELECT last_number FROM serial_counter WHERE council_id='ogua' AND electoral_area='Oguaa'`);
  console.log('before:', before.rows[0]);
  const noRows = await c.query(`SELECT count(*)::int n FROM fee_payer WHERE council_id='ogua' AND record_status='ACTIVE'`);
  console.log('ogua active records:', noRows.rows[0].n);
  if (noRows.rows[0].n === 0) {
    await c.query(`UPDATE serial_counter SET last_number=0 WHERE council_id='ogua' AND electoral_area='Oguaa'`);
    const after = await c.query(`SELECT last_number FROM serial_counter WHERE council_id='ogua' AND electoral_area='Oguaa'`);
    console.log('after reset:', after.rows[0]);
  } else {
    console.log('SKIP: ogua not empty');
  }
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
