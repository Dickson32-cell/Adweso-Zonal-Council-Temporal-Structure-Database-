// GET /api/master/export — PRIMARY ADMIN ONLY (username 'admin').
// Builds ONE Excel workbook containing the FULL register of every council:
// local DB + all linked remote council DBs (MASTER_REMOTE_<ID>_URL env vars).
// Each council gets its own worksheet with every active + inactive record,
// all payments, and computed totals — the complete database, in one file,
// downloadable only from the primary admin's console.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

const GHS = (n: number) => n.toFixed(2);

function remoteCouncils(): { id: string; url: string }[] {
  const out: { id: string; url: string }[] = [];
  for (const k of Object.keys(process.env)) {
    const m = k.match(/^MASTER_REMOTE_([A-Z0-9]+)_URL$/);
    if (m && process.env[k]) out.push({ id: m[1].toLowerCase(), url: process.env[k]! });
  }
  return out;
}

async function fetchRemoteRegister(url: string) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const payers = await client.query(`
      SELECT serial_number, electoral_area, name, business_name, telephone,
             street_name, latitude, longitude, fee, status, record_status, created_at
      FROM fee_payer ORDER BY serial_number`);
    const payments = await client.query(`
      SELECT p.amount, p.method AS kind, p.received_at AS paid_at, u.username AS recorded_by, f.serial_number FROM payment p JOIN fee_payer f ON f.id = p.fee_payer_id LEFT JOIN app_user u ON u.id = p.received_by ORDER BY p.received_at`);
    return { payers: payers.rows, payments: payments.rows };
  } finally {
    await client.end().catch(() => {});
  }
}

async function localRegister() {
  const payers = await prisma.feePayer.findMany({ orderBy: { serialNumber: "asc" } });
  const payments = await prisma.payment.findMany({
    orderBy: { receivedAt: "asc" },
    include: { feePayer: { select: { serialNumber: true } }, receivedByUser: { select: { username: true } } },
  });
  return {
    payers: payers.map((p) => ({
      serial_number: p.serialNumber, electoral_area: p.electoralArea, name: p.name,
      business_name: p.businessName, telephone: p.telephone, street_name: p.streetName,
      latitude: p.latitude, longitude: p.longitude, fee: p.fee, status: p.status,
      record_status: p.recordStatus, created_at: p.createdAt,
    })),
    payments: payments.map((p) => ({
      serial_number: p.feePayer.serialNumber, amount: p.amount, kind: p.method,
      recorded_by: p.receivedByUser?.username ?? "-", paid_at: p.receivedAt,
    })),
  };
}

function councilSheets(id: string, reg: Awaited<ReturnType<typeof localRegister>>) {
  const paidTotals: Record<string, number> = {};
  for (const pay of reg.payments) {
    paidTotals[pay.serial_number] = (paidTotals[pay.serial_number] || 0) + Number(pay.amount);
  }
  const register = reg.payers.map((p) => {
    const paid = paidTotals[p.serial_number] || 0;
    const fee = Number(p.fee);
    const balance = p.status === "PAID" ? 0 : Math.max(0, fee - paid);
    return {
      "Serial": p.serial_number, "Area": p.electoral_area, "Name": p.name,
      "Business": p.business_name, "Telephone": p.telephone, "Street": p.street_name,
      "GPS": p.latitude != null && p.longitude != null ? `${p.latitude},${p.longitude}` : "",
      "Fee (GHs)": GHS(fee), "Status": p.status, "Record": p.record_status,
      "Registered": p.created_at instanceof Date ? p.created_at.toISOString().slice(0, 10) : String(p.created_at).slice(0, 10),
      "Paid total": GHS(paid), "Balance": GHS(balance),
    };
  });
  const payments = reg.payments.map((p) => ({
    "Serial": p.serial_number,
    "Date": p.paid_at instanceof Date ? p.paid_at.toISOString().slice(0, 10) : String(p.paid_at).slice(0, 10),
    "Amount (GHs)": GHS(Number(p.amount)), "Kind": p.kind, "Recorded by": p.recorded_by,
  }));
  return [
    { name: `${id.slice(0, 26)} register`, rows: register },
    { name: `${id.slice(0, 26)} payments`, rows: payments },
  ];
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.username !== "admin")
    return NextResponse.json({ error: "Not found" }, { status: 404 }); // invisible to non-primary

  const sheets: { name: string; rows: Record<string, unknown>[] }[] = [];

  // Local council first
  try {
    sheets.push(...councilSheets(process.env.COUNCIL_ID || "adweso", await localRegister()));
  } catch { /* skip broken local */ }

  // Every linked remote council
  for (const r of remoteCouncils()) {
    try {
      const reg = await fetchRemoteRegister(r.url);
      sheets.push(...councilSheets(r.id, reg as unknown as Awaited<ReturnType<typeof localRegister>>));
    } catch { /* connection error: skip that council's sheets */ }
  }

  // Summary sheet: one row per council
  const summary = sheets
    .filter((s) => s.name.endsWith(" register"))
    .map((s) => {
      const active = s.rows.filter((r) => r.Record === "ACTIVE");
      const billed = active.reduce((t, r) => t + Number(String(r["Fee (GHs)"]).replace(/,/g, "")), 0);
      const collected = active.reduce((t, r) => t + Number(String(r["Paid total"]).replace(/,/g, "")), 0);
      return {
        "Council": s.name.replace(" register", ""),
        "Active records": active.length,
        "Total records": s.rows.length,
        "Billed (GHs)": GHS(billed), "Collected (GHs)": GHS(collected), "Outstanding (GHs)": GHS(billed - collected),
      };
    });
  const wb = XLSX.utils.book_new();
  if (summary.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows), s.name.slice(0, 31));

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="All-Councils-Register-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}