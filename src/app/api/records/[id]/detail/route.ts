// GET /api/records/[id] — single record with full money detail + ledger history
import { NextRequest, NextResponse } from "next/server";
import { prisma, payerTotals } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const payer = await prisma.feePayer.findUnique({
    where: { id },
    include: {
      fees: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!payer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totals = await payerTotals(id);
  return NextResponse.json({ record: payer, totals });
}