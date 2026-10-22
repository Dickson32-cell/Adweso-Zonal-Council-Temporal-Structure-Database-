// ADDITIVE schema: fee_payer.pending_id (dedupe key for offline-captured records)
// + partial unique index (council_id, pending_id) so a sync retry can NEVER create a duplicate.
const { Client } = require("pg");
const OWNER = process.env.OWNER_URL;
(async () => {
  const c = new Client({ connectionString: OWNER, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const ex = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='fee_payer' AND column_name='pending_id'`);
  if (ex.rowCount === 0) {
    await c.query(`ALTER TABLE fee_payer ADD COLUMN pending_id varchar(64)`);
    console.log("ALTER: fee_payer.pending_id added");
  } else console.log("column pending_id already exists");
  await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS fee_payer_pending_once ON fee_payer (council_id, pending_id) WHERE pending_id IS NOT NULL`);
  console.log("unique index fee_payer_pending_once ready");
  const chk = await c.query(`SELECT count(*)::int n FROM fee_payer WHERE pending_id IS NOT NULL`);
  console.log("existing rows with pending_id:", chk.rows[0].n);
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });