// Clerk attendance sheet (READ-ONLY): per-clerk, per-day record-entry maths for
// the month-end pay run. Admin (FULL) on the Adweso deployment ONLY.
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { councilId } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (councilId() !== "adweso" || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  }
  const me = await prisma.appUser.findFirst({
    where: { username: session.username, councilId: "adweso", active: true },
    select: { adminLevel: true },
  });
  if (!me || me.adminLevel !== "FULL") {
    return NextResponse.json({ error: "Full administrators only" }, { status: 403 });
  }

  // Accra-local calendar days, active records only, month picked by the officer
  // (?month=YYYY-MM, default = current month). Read-only: SELECTs only.
  const url = new URL(_req.url);
  const month = /^\d{4}-\d{2}$/.test(String(url.searchParams.get("month") || "")) ? String(url.searchParams.get("month")) : null;
  const monthFilter = month ? `and date_trunc('month', f.created_at at time zone 'Africa/Accra') = (date '${month}-01')` : `and date_trunc('month', f.created_at at time zone 'Africa/Accra') = date_trunc('month', now() at time zone 'Africa/Accra')`;

  const matrix = await prisma.$queryRawUnsafe(
    `select to_char(date_trunc('day', f.created_at) at time zone 'Africa/Accra', 'YYYY-MM-DD (Dy)') as day,
        date_trunc('day', f.created_at at time zone 'Africa/Accra') as d0,
        coalesce(u.username, '(no clerk on record)') as clerk,
        coalesce(u.full_name, '') as full_name,
        count(*)::int as entered,
        sum(case when f.pending_id is not null then 1 else 0 end)::int as offline
      from fee_payer f left join app_user u on u.id::text = f.created_by::text
      where f.council_id = 'adweso' and f.record_status = 'ACTIVE' ${monthFilter}
      group by 1, 2, 3, 4 order by 2, 3`,
  );

  const months = (await prisma.$queryRawUnsafe(
    `select distinct to_char(date_trunc('month', created_at) at time zone 'Africa/Accra', 'YYYY-MM') as m
      from fee_payer where council_id = 'adweso' order by 1 desc`,
  )) as { m: string }[];

  return NextResponse.json({ ok: true, month: month || null, matrix, months: months.map((m) => m.m) });
}
