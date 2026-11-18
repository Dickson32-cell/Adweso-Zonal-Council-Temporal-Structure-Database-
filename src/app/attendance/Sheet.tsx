"use client";
import { useCallback, useEffect, useState } from "react";

type Row = { day: string; clerk: string; full_name: string; entered: number; offline: number };

// The client sheet behind the server gate. All maths are read-only sums.
export default function AttendanceSheet({ username }: { username: string }) {
  const [auth, setAuth] = useState<"loading" | "ok" | "denied">("loading");
  const [denyMsg, setDenyMsg] = useState("");
  const [month, setMonth] = useState<string>("");
  const [months, setMonths] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Row[]>([]);
  const [rate, setRate] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("adw_rate") || "40" : "40"));
  const [err, setErr] = useState("");

  const load = useCallback(async (m: string) => {
    setErr("");
    const res = await fetch("/api/attendance" + (m ? "?month=" + m : ""));
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (res.status === 403) { const j = await res.json().catch(() => ({})); setDenyMsg(j.error || "Administrators only"); setAuth("denied"); return; }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr("Could not load the sheet. Try again."); return; }
    setAuth("ok"); setMatrix(j.matrix || []); setMonths(j.months || []);
  }, []);

  useEffect(() => { void load(month); }, [load, month]); /* eslint-disable-line */
  useEffect(() => { localStorage.setItem("adw_rate", rate); }, [rate]); /* eslint-disable-line */

  const days: string[] = [];
  const seen = new Set<string>();
  for (const r of matrix) if (!seen.has(r.day)) { seen.add(r.day); days.push(r.day); }
  const clerks: { clerk: string; full_name: string }[] = [];
  const seenC = new Set<string>();
  for (const r of matrix) if (!seenC.has(r.clerk)) { seenC.add(r.clerk); clerks.push({ clerk: r.clerk, full_name: r.full_name }); }
  const per = new Map<string, Map<string, number>>();
  const off = new Map<string, Map<string, number>>();
  for (const r of matrix) {
    if (!per.has(r.day)) per.set(r.day, new Map());
    if (!off.has(r.day)) off.set(r.day, new Map());
    per.get(r.day)!.set(r.clerk, (per.get(r.day)!.get(r.clerk) || 0) + r.entered);
    off.get(r.day)!.set(r.clerk, (off.get(r.day)!.get(r.clerk) || 0) + r.offline);
  }
  const rateN = Number(rate) || 0;
  const totals = clerks.map((c) => {
    const d = days.filter((day) => (per.get(day)?.get(c.clerk) || 0) > 0).length;
    const recs = days.reduce((a, day) => a + (per.get(day)?.get(c.clerk) || 0), 0);
    return { ...c, days: d, recs, pay: d * rateN, missed: Math.max(0, days.length - d) };
  });
  const dayTotals = days.map((day) => clerks.reduce((a, c) => a + (per.get(day)?.get(c.clerk) || 0), 0));
  const totalPay = totals.reduce((a, t) => a + t.pay, 0);

  return (
    <div className="main">
      {auth === "loading" && <div className="card"><p className="sub">Loading the attendance sheet…</p></div>}
      {auth === "denied" && (
        <div className="card" style={{ textAlign: "center" }}>
          <h2>Administrators only</h2>
          <p className="sub">{denyMsg}. This sheet is for the full administrator of the Adweso zonal council.</p>
          <a className="btn btn-primary" href="/">Back to the register</a>
        </div>
      )}
      {auth === "ok" && (
        <div className="card">
          <h2 className="noprint">Clerk attendance (records entered per day)</h2>
          <p className="sub noprint">
            One day is counted for a clerk for every day the system holds at least one record they entered.
            Set the day rate, then press Print to keep the month sheet for the pay run.
          </p>
          <div className="print-head-only" style={{ display: "none" }}>
            <div style={{ textAlign: "center", fontWeight: 800, fontSize: 16, color: "#0a3b2a" }}>ADWESO ZONAL COUNCIL — CLERK ATTENDANCE &amp; PAY SHEET</div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#33463b", marginTop: 2 }}>
              {month || "This month"} • Prepared by {username} • {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
          {err && <div className="alert-err noprint">{err}</div>}
          <div className="filters noprint" style={{ flexWrap: "wrap", gap: 10 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Month</span>
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">This month</option>
                {months.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Day rate (GHS)</span>
              <input type="number" min="0" value={rate} onChange={(e) => setRate(e.target.value)} style={{ width: 110 }} />
            </label>
            <button className="btn btn-primary" onClick={() => window.print()}>Print / save as PDF</button>
          </div>

          {days.length === 0 ? (
            <p className="sub">No records were entered in this month yet.</p>
          ) : (
            <div className="tblwrap">
              <table className="tbl" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Day</th>
                    {clerks.map((c) => <th key={c.clerk}>{c.clerk === "(no clerk on record)" ? "No clerk" : c.clerk}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day, i) => (
                    <tr key={day}>
                      <td style={{ whiteSpace: "nowrap" }}>{day}</td>
                      {clerks.map((c) => {
                        const n = per.get(day)?.get(c.clerk) || 0;
                        const o = off.get(day)?.get(c.clerk) || 0;
                        return <td key={c.clerk}>{n > 0 ? (<>{n}{o > 0 ? <span style={{ fontSize: 10.5, color: "#8b7c3f" }}> ({o} offline)</span> : null}</>) : "\u2014"}</td>;
                      })}
                      <td style={{ fontWeight: 700 }}>{dayTotals[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totals.length > 0 && (
            <>
              <h3 style={{ marginTop: 14 }}>Pay summary (days worked × GHS {rateN})</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: "6px 0", display: "flex", flexWrap: "wrap", gap: 10 }}>
                {totals.map((t) => (
                  <li key={t.clerk} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px", minWidth: 210 }}>
                    <b>{t.clerk === "(no clerk on record)" ? "No clerk on record" : t.clerk}</b>
                    {t.full_name ? <span style={{ fontSize: 11.5, color: "#5f6f66" }}> — {t.full_name}</span> : null}
                    <div style={{ fontSize: 13, marginTop: 3 }}>Records entered: {t.recs}</div>
                    <div style={{ fontSize: 13 }}>Days worked: {t.days}{t.missed > 0 ? ` (missed ${t.missed})` : ""}</div>
                    <div style={{ fontWeight: 800, color: "#0a3b2a" }}>Pay: GHS {t.pay.toFixed(2)}</div>
                  </li>
                ))}
                <li style={{ background: "#eef4ef", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px", minWidth: 210, fontWeight: 800 }}>
                  Total for the month: GHS {totalPay.toFixed(2)}
                </li>
              </ul>
            </>
          )}
          <div className="noprint" style={{ marginTop: 6, fontSize: 12, color: "#5f6f66" }}>
            Days are counted from the records the system actually holds; an offline-captured record counts on the day it reached the register (shown as "offline" above). A disputed day can be checked from the record's own entry stamp.
          </div>
        </div>
      )}
    </div>
  );
}
