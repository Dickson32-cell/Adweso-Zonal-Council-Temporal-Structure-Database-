"use client";
// RegisterTable — the register: filters, Dickson's exact column order,
// per-area summary, GRAND TOTAL row, New Record form, payment modal.
import { useCallback, useEffect, useState } from "react";

const AREAS = [
  "Adweso Estate",
  "Adweso Town",
  "Two Streams",
  "Nyerede North",
  "Nyerede South",
  "Osabene Mile 50",
];

const GHS = (n: number) =>
  "GH\u20B5 " + n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Row = {
  id: string; serialNumber: string; name: string; businessName: string;
  telephone: string; electoralArea: string; streetName: string;
  fee: number; total: number; paid: number; balance: number; status: string;
};
type Grand = { records: number; billed: number; collected: number; outstanding: number };
type AreaSum = { count: number; billed: number; collected: number; outstanding: number };

export default function RegisterTable({ isAdmin = false }: { isAdmin?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [byArea, setByArea] = useState<Record<string, AreaSum>>({});
  const [grand, setGrand] = useState<Grand>({ records: 0, billed: 0, collected: 0, outstanding: 0 });
  const [area, setArea] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  // New-record form state
  const [showForm, setShowForm] = useState(false);
  const [serialPreview, setSerialPreview] = useState("");
  const [form, setForm] = useState({ name: "", businessName: "", telephone: "", electoralArea: "", streetName: "", fee: "" });
  const [formErr, setFormErr] = useState<string[]>([]);
  const [formOk, setFormOk] = useState("");
  const [busy, setBusy] = useState(false);

  // Payment modal state
  const [payFor, setPayFor] = useState<Row | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [payErr, setPayErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (area) p.set("area", area);
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    const res = await fetch(`/api/records/list?${p}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.records);
      setByArea(data.byArea);
      setGrand(data.grand);
    }
    setLoading(false);
  }, [area, q, status]);

  useEffect(() => { load(); }, [load]);

  // Live serial preview when the Electoral Area is picked
  async function onAreaPick(a: string) {
    setForm((f) => ({ ...f, electoralArea: a }));
    setFormErr([]);
    if (!a) { setSerialPreview(""); return; }
    const res = await fetch(`/api/serial-preview?area=${encodeURIComponent(a)}`);
    if (res.ok) {
      const d = await res.json();
      setSerialPreview(d.serial);
    }
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    setFormErr([]); setFormOk(""); setBusy(true);
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setFormErr(data.errors || [data.error]); return; }
    setFormOk(`Saved — ${data.record.serialNumber} (${data.record.name})`);
    setForm({ name: "", businessName: "", telephone: "", electoralArea: "", streetName: "", fee: "" });
    setSerialPreview("");
    load();
  }

  async function markPaid(row: Row) {
    if (!confirm(`Mark ${row.name} (${row.serialNumber}) as PAID?\nBalance GH\u20B5 ${row.balance.toFixed(2)} will be recorded as fully settled.`)) return;
    const res = await fetch(`/api/records/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    if (res.ok) load();
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payFor) return;
    setPayErr("");
    const res = await fetch(`/api/records/${payFor.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(payAmt) }),
    });
    const data = await res.json();
    if (!res.ok) { setPayErr((data.errors && data.errors[0]) || data.error || "Failed"); return; }
    setPayFor(null); setPayAmt("");
    load();
  }

  function exportExcel() {
    // Download the filtered view as a real .xlsx (3 sheets incl. grand totals)
    const p = new URLSearchParams();
    if (area) p.set("area", area);
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    window.location.href = `/api/export?${p.toString()}`;
  }

  async function deleteRecord(row: Row) {
    if (
      !confirm(
        `Delete ${row.name} (${row.serialNumber})?\n\n` +
          `This removes the record from the register. The serial number is retired ` +
          `and will NOT be reused. This action is audit-logged.`
      )
    )
      return;
    const res = await fetch(`/api/records/${row.id}/delete`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Delete failed");
      return;
    }
    setFormOk(`Deleted ${row.serialNumber} (${row.name})`);
    load();
  }

  return (
    <>
      <div className="card">
        <h2>Temporal Structures Register</h2>
        <p className="sub">Official fee register — Adweso Zonal Council, New Juaben South Municipal Assembly</p>

        <div className="filters">
          <div className="f">
            <label className="fld" style={{ marginBottom: 0 }}>
              <span className="cap">Electoral Area</span>
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">All areas</option>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>
          <div className="f">
            <label className="fld" style={{ marginBottom: 0 }}>
              <span className="cap">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
              </select>
            </label>
          </div>
          <div className="f grow">
            <label className="fld" style={{ marginBottom: 0 }}>
              <span className="cap">Search</span>
              <input type="text" placeholder="Name, business, serial or street..." value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm((s) => !s); setFormOk(""); }}>New Record</button>
          <button className="btn btn-ghost" onClick={exportExcel}>Export Excel</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
        </div>

        {showForm && (
          <form onSubmit={saveRecord} className="card" style={{ background: "#fbfdff" }}>
            <h2>New Record</h2>
            <p className="sub">Serial number is generated automatically when you select the Electoral Area.</p>

            {formErr.length > 0 && <div className="err">{formErr.map((x, i) => <div key={i}>{x}</div>)}</div>}
            {formOk && <div className="ok-msg">{formOk}</div>}

            <div style={{ marginBottom: 14 }}>
              <span className="cap" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 5 }}>
                Serial Number <span style={{ color: "var(--muted)", fontWeight: 400 }}>(automatic)</span>
              </span>
              {serialPreview
                ? <span className="serial-preview"><span className="lbl">Will receive:</span> {serialPreview}</span>
                : <span className="serial-preview" style={{ opacity: 0.55 }}><span className="lbl">Select an Electoral Area to generate</span></span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
              <label className="fld"><span className="cap">Name <span className="req">*</span></span>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
              <label className="fld"><span className="cap">Business Name <span className="req">*</span></span>
                <input type="text" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required /></label>
              <label className="fld"><span className="cap">Telephone <span className="req">*</span></span>
                <input type="tel" placeholder="0241234567" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} required /></label>
              <label className="fld"><span className="cap">Electoral Area <span className="req">*</span></span>
                <select value={form.electoralArea} onChange={(e) => onAreaPick(e.target.value)} required>
                  <option value="">Select area...</option>
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select></label>
              <label className="fld"><span className="cap">Street Name <span className="req">*</span></span>
                <input type="text" value={form.streetName} onChange={(e) => setForm({ ...form, streetName: e.target.value })} required /></label>
              <label className="fld"><span className="cap">Fee (GH\u20B5) <span className="req">*</span></span>
                <input type="number" step="0.01" min="0.01" placeholder="e.g. 50" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} required /></label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : "Save Record"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setSerialPreview(""); }}>Cancel</button>
            </div>
          </form>
        )}

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Serial No</th>
                <th>Name</th>
                <th>Business Name</th>
                <th>Telephone</th>
                <th>Electoral Area</th>
                <th>Street Name</th>
                <th style={{ textAlign: "right" }}>Fee (GH\u20B5)</th>
                <th style={{ textAlign: "right" }}>Balance (GH\u20B5)</th>
                <th style={{ textAlign: "right" }}>Total (GH\u20B5)</th>
                <th>Status</th>
                <th className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--muted)" }}>Loading...</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--muted)" }}>No records match the current filters.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="serial">{r.serialNumber}</td>
                  <td>{r.name}</td>
                  <td>{r.businessName}</td>
                  <td>{r.telephone}</td>
                  <td>{r.electoralArea}</td>
                  <td>{r.streetName}</td>
                  <td className="num">{r.fee.toFixed(2)}</td>
                  <td className="num"><b>{r.status === "PAID" ? "0.00" : r.balance.toFixed(2)}</b></td>
                  <td className="num">{r.status === "PAID" ? "0.00" : r.total.toFixed(2)}</td>
                  <td><span className={`badge ${r.status === "PAID" ? "paid" : "unpaid"}`}>{r.status === "PAID" ? "PAID" : "UNPAID"}</span></td>
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    {r.status !== "PAID" && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setPayFor(r); setPayAmt(""); setPayErr(""); }}>Pay</button>
                        {" "}
                        <button className="btn btn-green btn-sm" onClick={() => markPaid(r)}>Mark Paid</button>
                      </>
                    )}
                    {" "}
                    {isAdmin && (
                      <button className="btn btn-danger btn-sm" onClick={() => deleteRecord(r)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grand totals — system-computed */}
        <div className="grand">
          <div className="tag">GRAND TOTALS</div>
          <div className="g"><div className="k">RECORDS</div><div className="v">{grand.records}</div></div>
          <div className="g"><div className="k">TOTAL BILLED</div><div className="v">{GHS(grand.billed)}</div></div>
          <div className="g"><div className="k">TOTAL COLLECTED</div><div className="v">{GHS(grand.collected)}</div></div>
          <div className="g"><div className="k">OUTSTANDING</div><div className="v">{GHS(grand.outstanding)}</div></div>
        </div>
      </div>

      {/* Per-area summary */}
      <div className="card">
        <h2>Per-Area Summary</h2>
        <p className="sub">Counts and totals computed by the system for the current filter view.</p>
        <div className="summary-grid">
          {Object.entries(byArea).map(([a, s]) => (
            <div className="sum-card" key={a}>
              <div className="k">{a}</div>
              <div className="v">{s.count} record{s.count === 1 ? "" : "s"}</div>
              <div className="k" style={{ marginTop: 6 }}>Billed {GHS(s.billed)} · Collected {GHS(s.collected)}</div>
              <div className="k">Outstanding {GHS(s.outstanding)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment modal */}
      {payFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,44,84,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setPayFor(null)}>
          <form className="card" style={{ width: 380, margin: 0 }} onClick={(e) => e.stopPropagation()} onSubmit={savePayment}>
            <h2>Record Cash Payment</h2>
            <p className="sub">{payFor.serialNumber} — {payFor.name} ({payFor.businessName})<br />Outstanding balance: <b>{GHS(payFor.balance)}</b></p>
            {payErr && <div className="err">{payErr}</div>}
            <label className="fld"><span className="cap">Amount received (GH\u20B5)</span>
              <input type="number" step="0.01" min="0.01" max={payFor.balance} value={payAmt} onChange={(e) => setPayAmt(e.target.value)} autoFocus required /></label>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>Save Payment</button>
              <button type="button" className="btn btn-ghost" onClick={() => setPayFor(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}