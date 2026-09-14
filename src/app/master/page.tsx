"use client";
// MASTER CONSOLE — primary admin only (username 'admin'). Promoted admins
// get a 404 here: the page and its API are invisible to them.
// Features: every council's license status (local + linked remote DBs),
// key generator for any council/tier, Excel download of ALL councils.
import { useCallback, useEffect, useState } from "react";

type Remote = {
  id: string;
  status: { paidThrough: number; registered: number; licenseKey: string | null; lastPaymentAt: string | null } | null;
  error?: string;
};
type Master = {
  councilId: string;
  local: { registered: number; paidThrough: number; locked: boolean; remainingFree: number; nextUnlockAt: number };
  remotes: Remote[];
  feeUSD: number;
};

export default function MasterPage() {
  const [data, setData] = useState<Master | null>(null);
  const [denied, setDenied] = useState(false);
  const [genCouncil, setGenCouncil] = useState("newtown");
  const [genTier, setGenTier] = useState("100");
  const [genKey, setGenKey] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/master");
    if (res.status === 404) { setDenied(true); return; }
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function genKeyNow(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setGenKey("");
    const res = await fetch("/api/master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "keygen", councilId: genCouncil, paidThrough: parseInt(genTier, 10) || 0 }),
    });
    const d = await res.json();
    if (res.ok) setGenKey(`${d.key}   (unlocks registrations up to ${d.unlocksUpTo})`);
    else setGenKey(d.error || "failed");
    setBusy(false);
  }

  if (denied) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Page not found.</div>;
  if (!data) return <div style={{ padding: 40 }}>Loading…</div>;

  const councils: { id: string; registered: number; paidThrough: number; locked: boolean | null; remaining: number | null; next: number | null; remote: boolean; error?: string }[] = [
    { id: data.councilId + " (this system)", registered: data.local.registered, paidThrough: data.local.paidThrough, locked: data.local.locked, remaining: data.local.remainingFree, next: data.local.nextUnlockAt, remote: false },
    ...data.remotes.map((r) => ({
      id: r.id,
      registered: r.status?.registered ?? 0,
      paidThrough: r.status?.paidThrough ?? 0,
      locked: r.status ? (r.status.registered ?? 0) >= (r.status.paidThrough ?? 0) + 100 : null,
      remaining: r.status ? Math.max(0, (r.status.paidThrough ?? 0) + 100 - (r.status.registered ?? 0)) : null,
      next: r.status ? (r.status.paidThrough ?? 0) + 100 : null,
      remote: true, error: r.error,
    })),
  ];

  return (
    <div className="card" style={{ padding: 24, margin: "20px auto", maxWidth: 900 }}>
      <h1 style={{ fontSize: 22 }}>Master Console — All Councils</h1>
      <p className="sub">License status across every zonal council system. Only the primary admin can see this page.</p>

      <table className="tbl" style={{ width: "100%", marginTop: 14 }}>
        <thead>
          <tr>
            <th>Council</th><th>Registered</th><th>Paid through</th><th>Remaining free</th><th>Locks at</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {councils.map((c) => (
            <tr key={c.id}>
              <td><b>{c.id}</b>{c.error ? <div style={{ color: "#b91c1c", fontSize: 11 }}>connection error: {c.error}</div> : null}</td>
              <td className="num">{c.registered}</td>
              <td className="num">{c.paidThrough}</td>
              <td className="num">{c.remaining ?? "—"}</td>
              <td className="num">{c.next ?? "—"}</td>
              <td>{c.locked == null ? "—" : c.locked
                ? <span className="badge unpaid">LOCKED</span>
                : <span className="badge paid">ACTIVE</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, margin: "26px 0 8px" }}>Generate unlock key (after payment received)</h2>
      <p className="sub" style={{ fontSize: 12.5 }}>Council pays the US${data.feeUSD} fee → generate their key → send it to them. The key unlocks the next 100 registrations on their system.</p>
      <form onSubmit={genKeyNow} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="fld" style={{ minWidth: 180 }}>
          <span className="cap">Council ID</span>
          <select value={genCouncil} onChange={(e) => setGenCouncil(e.target.value)}>
            {["newtown", "ogua", "nkukwao", "betom", "srodae", "oldestate", "anlotown", "adweso"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="fld" style={{ minWidth: 140 }}>
          <span className="cap">Their paid-through number</span>
          <input type="number" value={genTier} onChange={(e) => setGenTier(e.target.value)} placeholder="0, 100, 200…" />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Generating…" : "Generate key"}</button>
      </form>
      {genKey && (
        <div className="ok-msg" style={{ marginTop: 10, fontFamily: "monospace", fontSize: 15, padding: "10px 14px" }}>{genKey}</div>
      )}

      <h2 style={{ fontSize: 16, margin: "26px 0 8px" }}>Download data</h2>
      <p className="sub" style={{ fontSize: 12.5 }}>Excel export of a council&apos;s full register is done on their own system when unlocked. This console shows counts and license state only.</p>
    </div>
  );
}