// AUTO SMS — Adweso-only: fire a THANK_YOU the moment a registration lands.
// Wired into POST /api/records after a successful create. Guards stack so a
// failure can never block or duplicate a registration:
//   - env AUTO_SMS_ENABLED must be "1" (deployment-level gate)
//   - smsConfigured() (BULK_SMS_ENABLED + provider key)
//   - only a usable Ghana phone sends (no unusable-number rows)
//   - the SMS table's unique (council_id, record_id, type) index keeps it
//     strictly once-per-record — offline-sync retries resolve to the same
//     existing record and cannot re-send.
import { prisma } from "./db";
import {
  SMS_SENDER_ID,
  SMS_TEXTS,
  normalizePhone,
  fillTemplate,
  markSms,
  arkeselSend,
  smsConfigured,
} from "./bulkSms";

const AUTO_COUNCIL = "adweso"; // pilot council only

type RecordLike = {
  id: string;
  name: string;
  serialNumber: string;
  telephone?: string | null;
};

export function autoSmsEnabled(): boolean {
  return process.env.AUTO_SMS_ENABLED === "1";
}

/** Fire-and-forget; never throws, never blocks the registration response. */
export async function maybeAutoSmsThankYou(record: RecordLike): Promise<void> {
  try {
    if (!autoSmsEnabled() || !smsConfigured()) return;
    if (councilGuard()) return;
    const phone = normalizePhone(record.telephone || "");
    if (!phone) return;

    // Dedupe belt-and-braces: skip if this record already has a SENT row.
    const st = await prisma.smsSend.findUnique({
      where: {
        councilId_recordId_type: { councilId: AUTO_COUNCIL, recordId: record.id, type: "THANK_YOU" },
      },
      select: { status: true },
    });
    if (st?.status === "SENT") return;

    const message = fillTemplate(SMS_TEXTS.THANK_YOU, record.name, record.serialNumber);
    let status: "SENT" | "FAILED" = "FAILED";
    let err = "";
    try {
      await arkeselSend(process.env.ARKESEL_API_KEY as string, SMS_SENDER_ID, message, phone);
      status = "SENT";
    } catch (e) {
      err = String(e).slice(0, 90);
    }
    await markSms(AUTO_COUNCIL, record.id, "THANK_YOU", phone, status);
    await prisma.auditLog.create({
      data: {
        councilId: AUTO_COUNCIL,
        userId: null,
        action: "AUTO_SMS",
        entityType: "fee_payer",
        entityId: record.id,
        details: { type: "THANK_YOU", status, phone, error: err, auto: true },
      },
    });
  } catch (e) {
    console.error("auto-sms skipped", String(e).slice(0, 120));
  }
}

function councilGuard(): boolean {
  return AUTO_COUNCIL !== "adweso"; // single pilot guard; always false today
}
