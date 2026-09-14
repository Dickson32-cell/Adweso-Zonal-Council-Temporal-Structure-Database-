// One-time provisioning: real passwords for the 6 remaining council roles
// + serial counters for all councils' areas.
const { Client } = require("pg");

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/^"|"$/g, ""), ssl: { rejectUnauthorized: false } });
  await c.connect();

  const pws = {
    ogua: "Ogu4-RLS-2026-mN3", nkukwao: "Nkukw40-RLS-2026-pL8", betom: "B3t0m-RLS-2026-rT5",
    srodae: "Srod43-RLS-2026-sD2", oldestate: "0ld3st4t3-RLS-2026-oE9", anlotown: "Anl0T0wn-RLS-2026-aT6",
  };
  for (const [cid, pw] of Object.entries(pws)) {
    await c.query(`ALTER ROLE zc_${cid} PASSWORD '${pw}'`);
  }
  console.log("6 council role passwords set");

  const areas = {
    ogua: ["Ogua", "Ogua Mile 50", "Jumapo"], nkukwao: ["Nkukwao", "Nkukwao Market", "Suhyen"],
    betom: ["Betom", "Betom Market", "Effiduase"], srodae: ["Srodae", "Srodae Adweso", "Oyirim"],
    oldestate: ["Old Estate", "Old Estate Town", "Kukurantumi Road"], anlotown: ["Anlo-Town", "Anloga", "Esuose"],
  };
  for (const [cid, list] of Object.entries(areas)) {
    for (const a of list) {
      await c.query("INSERT INTO serial_counter (council_id, electoral_area, last_number) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING", [cid, a]);
    }
  }
  const total = await c.query("SELECT COUNT(*)::int AS n FROM serial_counter");
  console.log("serial_counter rows total:", total.rows[0].n);
  await c.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });