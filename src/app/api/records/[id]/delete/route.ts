// DELETE /api/records/[id] — soft-delete (record_status -> INACTIVE).
// Admin only. Serial number is retired forever (counter never decrements);
// the row is retained for audit integrity but hidden from all lists.
import { NextRequest, NextResponse } from "next/server";
import { prisma, audit } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN")
    return NextResponse.json(
      { error: "Only administrators can delete records" },
      { status: 403 }
    );

  const { id } = await params;
  try {
    const payer = await prisma.feePayer.findUnique({ where: { id } });
    if (!payer || payer.recordStatus !== "ACTIVE")
      return NextResponse.json({ error: "Record not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.feePayer.update({
        where: { id },
        data: { recordStatus: "INACTIVE" },
      });
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          action: "DELETE_RECORD",
          entityType: "fee_payer",
          entityId: id,
          details: {
            serial: payer.serialNumber,
            name: payer.name,
            businessName: payer.businessName,
            note: "soft-deleted; serial retired, hidden from register",
          },
        },
      });
    });

    return NextResponse.json({ ok: true, serial: payer.serialNumber });
  } catch (e) {
    console.error("delete record error", e);
    return NextResponse.json({ error: "Could not delete record" }, { status: 500 });
  }
}