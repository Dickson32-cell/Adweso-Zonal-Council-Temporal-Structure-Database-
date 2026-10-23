const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.OWNER_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const g = await c.query(`SELECT council_id, count(*)::int total, count(*) FILTER (WHERE record_status='ACTIVE')::int active, max(created_at)::text newest_created FROM fee_payer GROUP BY council_id ORDER BY council_id`);
  for (const r of g.rows) console.log(r.council_id.padEnd(10), 'total=' + r.total, 'active=' + r.active, 'newest_created=' + r.newest_created);
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
