// READ-ONLY probe: pending_edit vs fee_payer state across councils
const { Client } = require('pg');
const OWNER = process.env.OWNER_URL;

(async () => {
  const c = new Client({ connectionString: OWNER, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const cols = async (table) => {
    const r = await c.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [table]);
    return r.rows.map(x => x.column_name);
  };

  const peCols = await cols('pending_edit');
  const fpCols = await cols('fee_payer');
  const alCols = await cols('audit_log');
  console.log('pending_edit cols:', peCols.join(', '));
  console.log('fee_payer cols:', fpCols.filter(x => /updated|name|serial|council|status|lat|long|address|type|container|bop/i.test(x)).join(', '));

  // pending_edit rows
  const pe = await c.query(`SELECT * FROM pending_edit ORDER BY created_at DESC LIMIT 12`);
  console.log('\n=== PENDING_EDIT (latest 12 of', pe.rowCount, 'shown) ===');
  const peStatus = await c.query(`SELECT council_id, count(*) n FROM pending_edit GROUP BY 1 ORDER BY 1`);
  console.log('counts by council:', peStatus.rows.map(r => `${r.council_id}:${r.n}`).join(' | ') || 'NONE');
  for (const r of pe.rows) {
    const slim = {};
    for (const k of ['id','council_id','record_id','requested_by','status','created_at','requested_at','approved_at','field','field_name','field_name2','before_value','after_value','old_value','new_value','changes','payload','data']) if (k in r && r[k] != null) slim[k] = typeof r[k] === 'string' && r[k].length > 220 ? r[k].slice(0,220)+'...' : r[k];
    console.log(JSON.stringify(slim));
  }

  // fee_payer recently updated
  const fp = await c.query(`
    SELECT council_id, count(*) n FROM fee_payer
    WHERE updated_at > now() - interval '36 hours' GROUP BY 1 ORDER BY 1`);
  console.log('\n=== FEE_PAYER updated <36h ===');
  console.log(fp.rows.map(r => `${r.council_id}:${r.n}`).join(' | ') || 'NONE');

  const fpRows = await c.query(`
    SELECT id, council_id, record_serial, first_name, other_names, last_name, updated_at, record_status,
           business_type, container_size, bop_fee, latitude, longitude, address
    FROM ${['business_type','container_size','bop_fee','latitude','longitude'].every(x => fpCols.includes(x)) ? 'fee_payer' :
      `(SELECT * FROM fee_payer WHERE updated_at > now() - interval '36 hours' LIMIT 8) AS fp`}
    WHERE updated_at > now() - interval '36 hours'
    ORDER BY updated_at DESC LIMIT 12`).catch(async e => {
      // fallback if some cols missing
      const r = await c.query(`SELECT * FROM fee_payer WHERE updated_at > now() - interval '36 hours' ORDER BY updated_at DESC LIMIT 8`);
      return r;
    });
  console.log('--- samples ---');
  for (const r of (fpRows.rows||[])) {
    console.log(JSON.stringify({
      id: r.id, c: r.council_id, s: r.record_serial, n: [r.first_name, r.other_names, r.last_name].filter(Boolean).join(' ').slice(0,40),
      st: r.record_status, bt: r.business_type, cs: r.container_size, bop: r.bop_fee, lat: r.latitude, lng: r.longitude,
      addr: r.address, at: r.updated_at
    }));
  }

  // audit log recent edit-related events
  const evCols = await cols('audit_log');
  const evCol = evCols.includes('event') ? 'event' : (evCols.includes('action') ? 'action' : null);
  if (evCol) {
    const al = await c.query(
      `SELECT council_id, ${evCol} e, count(*) n, max(created_at) last_at FROM audit_log
       WHERE created_at > now() - interval '36 hours' AND (${evCol} ILIKE '%EDIT%' OR ${evCol} ILIKE '%UPDATE%')
       GROUP BY 1,2 ORDER BY 1,4 DESC LIMIT 40`);
    console.log('\n=== AUDIT_LOG edit/update events <36h ===');
    for (const r of al.rows) console.log(`${r.council_id} ${r.e} n=${r.n} last=${r.last_at}`);
  }

  await c.end();
})().catch(e => { console.error('PROBE-ERR', e.message); process.exit(1); });