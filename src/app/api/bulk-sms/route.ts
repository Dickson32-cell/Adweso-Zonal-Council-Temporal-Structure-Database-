// Bulk SMS API — Adweso Zonal Council ONLY.
// GET  -> preview: due/sent counts + the fixed texts (needs a FULL admin).
// POST { type, area? } -> send the fixed message of that type to everyone due
//     (optionally within one electoral area). One message per record; a person
//     can never receive the same type twice (DB unique rule). FAILED sends are
//     marked and may be retried; SENT can never be re-sent.
// Gates: council must be 'adweso' (404 otherwise); sender must be a FULL admin
// (403 otherwise); the module must be configured via env (400 'not configured').
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFullUser, councilId, prisma } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import {
  SMS_TYPES, SMS_TEXTS, SMS_SENDER_ID, SmsType, smsConfigured,
  smsDue, normalizePhone, fillTemplate, markSms, arkeselSend,
} from "@/lib/bulkSms";

const SMS_COUNCIL = "adweso";
const MAX_PER_PRESS = 300;

async function guard() {
  const session = await getSession();
  if (!session) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (councilId() !== SMS_COUNCIL)
    return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const me = await getFullUser(session);
  if (!me || me.role !== "ADMIN" || permsFor(me.role, me.adminLevel).canManageUsers !== true)
    return { err: NextResponse.json({ error: "Only FULL administrators can use SMS" }, { status: 403 }) };
  return { me, sub: session.sub };
}

export async function GET() {
  const g = await guard();
  if (g.err) return g.err;
  const configured = smsConfigured();
  const types: Record<string, unknown> = {};
  const areas = new Set<string>();
  for (const t of SMS_TYPES) {
    const d = await smsDue(SMS_COUNCIL, t);
    for (const r of d.due) areas.add(r.electoralArea);
    types[t] = {
      text: SMS_TEXTS[t],
      dueCount: d.due.length,
      sentCount: d.sentCount,
      skips: { noPhone: d.noPhone, badPhone: d.badPhone },
    };
  }
  return NextResponse.json({ configured, senderId: SMS_SENDER_ID, areas: Array.from(areas).sort(), types });
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.err) return g.err;
  const me = g.me!;
  if (!smsConfigured())
    return NextResponse.json({ error: "SMS is not configured yet — add the provider key on the server" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const type = String(body.type || "");
  if (!SMS_TYPES.includes(type as SmsType))
    return NextResponse.json({ error: "Unknown SMS type" }, { status: 400 });
  const area = String(body.area || "").trim();
  const dryRun = body.dryRun === true;

  const d = await smsDue(SMS_COUNCIL, type as SmsType);
  let due = d.due;
  if (area) due = due.filter((r) => r.electoralArea === area);
  const skipped: Array<{ id: string; serial: string | null; reason: string }> = [];
  const sent: Array<{ id: string; serial: string | null; phone: string; name: string }> = [];
  const failed: Array<{ id: string; serial: string | null; phone: string; error: string }> = [];
  const existing = await prisma.smsSend.findMany({
    where: { councilId: SMS_COUNCIL, type },
    select: { recordId: true, status: true },
  });
  const state = new Map(existing.map((s) => [s.recordId, s.status]));
  const apiKey = process.env.ARKESEL_API_KEY as string;

  for (const r of (area ? due : d.due).slice(0, MAX_PER_PRESS)) {
    const phone = normalizePhone(r.telephone || "");
    if (state.get(r.id) === "SENT" && !body.force) { skipped.push({ id: r.id, serial: r.serialNumber, reason: "already had this message" }); continue; }
    if (!phone) { skipped.push({ id: r.id, serial: r.serialNumber, reason: "no usable phone number" }); continue; }
    const message = fillTemplate(SMS_TEXTS[type], r.name, r.serialNumber);
    if (dryRun) { sent.push({ id: r.id, serial: r.serialNumber, phone, name: r.name }); continue; }
    try {
      await arkeselSend(apiKey, SMS_SENDER_ID, message, phone);
      await markSms(SMS_COUNCIL, r.id, type as SmsType, phone, "SENT");
      sent.push({ id: r.id, serial: r.serialNumber, phone, name: r.name });
    } catch (e) {
      await markSms(SMS_COUNCIL, r.id, type as SmsType, phone, "FAILED");
      failed.push({ id: r.id, serial: r.serialNumber, phone, error: String(e).slice(0, 90) });
    }
  }

  await prisma.auditLog.create({
    data: {
      councilId: councilId(),
      userId: g.sub,
      action: "BULK_SMS",
      entityType: "fee_payer",
      entityId: null,
      details: { type, area: area || "ALL", sentCount: sent.length, failedCount: failed.length, skippedCount: skipped.length, by: me.username },
    },
  });
  return NextResponse.json({
    ok: true,
    type,
    senderId: SMS_SENDER_ID,
    result: dryRun ? { preview: true, wouldSend: sent.length, skipped: skipped.length } : { sent, failed, skipped },
  });
}