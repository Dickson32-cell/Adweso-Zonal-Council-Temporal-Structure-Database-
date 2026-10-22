const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.OWNER_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const st = await c.query(`SELECT record_status, count(*)::int n, max(created_at) newest, max(updated_at) last_touch FROM fee_payer WHERE council_id='oldestate' GROUP BY 1`);
  console.log('oldestate by status:', JSON.stringify(st.rows));
  const hr = await c.query(`SELECT date_trunc('hour', created_at) h, count(*)::int n FROM fee_payer WHERE council_id='oldestate' AND created_at > now() - interval '24 hours' GROUP BY 1 ORDER BY 1`);
  console.log('creates by hour (24h):', JSON.stringify(hr.rows));
  const au = await c.query(`SELECT date_trunc('hour', created_at) h, count(*)::int n FROM audit_log WHERE council_id='oldestate' AND action='CREATE_RECORD' AND created_at > now() - interval '24 hours' GROUP BY 1 ORDER BY 1`);
  console.log('audit creates by hour (24h):', JSON.stringify(au.rows));
  const upd = await c.query(`SELECT date_trunc('hour', updated_at) h, count(*)::int n FROM fee_payer WHERE council_id='oldestate' AND updated_at > now() - interval '12 hours' AND created_at < now() - interval '12 hours' GROUP BY 1 ORDER BY 1`);
  console.log('old rows touched by hour (12h):', JSON.stringify(upd.rows));
  const au2 = await c.query(`SELECT action, count(*)::int n, max(created_at) last FROM audit_log WHERE council_id='oldestate' AND created_at > now() - interval '12 hours' GROUP BY 1 ORDER BY 3 DESC`);
  console.log('audit actions (12h):', JSON.stringify(au2.rows));
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
