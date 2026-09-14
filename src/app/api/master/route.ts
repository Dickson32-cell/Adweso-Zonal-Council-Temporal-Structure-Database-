// GET  /api/master  — master console data (PRIMARY ADMIN ONLY: username 'admin')
//        Returns: all councils' license statuses (from linked DBs) + local one
// POST /api/master  — actions (PRIMARY ADMIN ONLY)
//        action=keygen  { councilId, paidThrough } -> returns the unlock key
//        action=sync    { } -> refreshes remote license states
//
// SECURITY MODEL: the primary admin is identified by username === "admin"
// in THIS deployment. Promoted admins (FULL/EDITOR/VIEWER) are rejected -
// they cannot see key generation or the master data, per owner requirement.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { licenseStatus, deriveKey } from "@/lib/license";
import crypto from "crypto";

const COUNCIL_ID = process.env.COUNCIL_ID || "adweso";

async function requirePrimaryAdmin() {
  const session = await getSession();
  if (!session) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  // session.username identifies the logged-in user; only the primary
  // admin account (username 'admin') reaches this console.
  if (session.username !== "admin")
    return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) }; // 404: invisible to non-primary
  return { session };
}

// Remote councils are declared in env: MASTER_COUNCILS="newtown:url,ogua:url,..."
// Each url is that council's own /api/... no — simpler & fully hidden: we hold
// each council's DATABASE_URL here and read directly. But cross-DB via Prisma
// needs separate clients. We declare them as env pairs:
//   MASTER_REMOTE_<ID>_URL="postgresql://..."   (one per council)
function remoteCouncils(): { id: string; url: string }[] {
  const out: { id: string; url: string }[] = [];
  for (const k of Object.keys(process.env)) {
    const m = k.match(/^MASTER_REMOTE_([A-Z0-9]+)_URL$/);
    if (m && process.env[k]) out.push({ id: m[1].toLowerCase(), url: process.env[k]! });
  }
  return out;
}

async function fetchRemoteStatus(url: string) {
  // Direct DB query via Prisma client per remote (dynamic import trick not
  // possible for Prisma; use pg-compatible fetch through raw connection).
  // Simplest robust path: fetch the council's own /api/license with a shared
  // MASTER_READ token... but that exposes an endpoint. Instead: raw pg query.
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const lic = await client.query("SELECT paid_through, license_key, last_payment_at FROM license_state WHERE id=1");
    const cnt = await client.query("SELECT COUNT(*)::int AS n FROM fee_payer WHERE record_status='ACTIVE'");
    const areas = await client.query("SELECT electoral_area, last_number FROM serial_counter ORDER BY electoral_area");
    return {
      paidThrough: lic.rows[0]?.paid_through ?? 0,
      licenseKey: lic.rows[0]?.license_key ?? null,
      lastPaymentAt: lic.rows[0]?.last_payment_at ?? null,
      registered: cnt.rows[0]?.n ?? 0,
      counters: areas.rows,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

export async function GET() {
  const gate = await requirePrimaryAdmin();
  if (gate.err) return gate.err;

  const local = await licenseStatus();
  const remotes: { id: string; status: unknown; error?: string }[] = [];
  for (const r of remoteCouncils()) {
    try {
      remotes.push({ id: r.id, status: await fetchRemoteStatus(r.url) });
    } catch (e) {
      remotes.push({ id: r.id, status: null, error: (e as Error).message.slice(0, 120) });
    }
  }

  return NextResponse.json({
    councilId: COUNCIL_ID,
    local,
    remotes,
    feeUSD: 5,
  });
}

export async function POST(req: NextRequest) {
  const gate = await requirePrimaryAdmin();
  if (gate.err) return gate.err;

  const body = await req.json().catch(() => ({}));

  if (body.action === "keygen") {
    // Generate a key for any council (local or remote) — the master secret
    // is shared across deployments, so keys generated here work anywhere.
    const councilId = String(body.councilId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const paidThrough = parseInt(String(body.paidThrough ?? ""), 10);
    if (!councilId || Number.isNaN(paidThrough))
      return NextResponse.json({ error: "councilId and paidThrough required" }, { status: 400 });
    const key = deriveKey(councilId, paidThrough);
    return NextResponse.json({
      ok: true,
      councilId,
      paidThrough,
      unlocksUpTo: paidThrough + 100,
      key,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}