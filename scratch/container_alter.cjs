const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.OWNER_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const col = await c.query(`SELECT data_type, character_maximum_length FROM information_schema.columns WHERE table_name='fee_payer' AND column_name='container_size'`);
  console.log('container_size before:', JSON.stringify(col.rows[0]));
  await c.query(`ALTER TABLE fee_payer ALTER COLUMN container_size TYPE varchar(24)`);
  console.log('widened to varchar(24)');
  const cat = await c.query(`SELECT 1 FROM information_schema.columns WHERE table_name='fee_payer' AND column_name='container_category'`);
  if (cat.rowCount === 0) { await c.query(`ALTER TABLE fee_payer ADD COLUMN container_category varchar(12)`); console.log('container_category added'); }
  else console.log('container_category exists');
  const chk = await c.query(`SELECT container_size, count(*)::int n FROM fee_payer WHERE container_size IS NOT NULL GROUP BY 1`);
  console.log('existing values:', JSON.stringify(chk.rows));
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
