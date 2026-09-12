// GET  /api/admin/users — list all users (admin only)
// PATCH /api/admin/users — approve/reject/deactivate/reactivate a user (admin only)
import { NextRequest, NextResponse } from "next/server";
import { prisma, audit } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN")
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const users = await prisma.appUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, username: true, fullName: true,
      role: true, active: true, createdAt: true,
    },
  });
  return NextResponse.json({ users });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN")
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  try {
    const { userId, action } = await req.json(); // action: approve|reject|deactivate|reactivate|makeAdmin
    if (!userId || !action)
      return NextResponse.json({ error: "userId and action required" }, { status: 400 });

    const target = await prisma.appUser.findUnique({ where: { id: userId } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.username === "admin" && action !== "deactivate" && action !== "reactivate")
      return NextResponse.json(
        { error: "The primary admin account cannot be modified this way" },
        { status: 400 }
      );
    if (target.id === session.sub && (action === "deactivate"))
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 }
      );

    let data: Record<string, unknown> = {};
    switch (action) {
      case "approve": data = { active: true, role: "STAFF" }; break;
      case "makeAdmin": data = { active: true, role: "ADMIN" }; break;
      case "reject":
      case "deactivate": data = { active: false }; break;
      case "reactivate": data = { active: true }; break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.appUser.update({ where: { id: userId }, data });
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          action: `USER_${String(action).toUpperCase()}`,
          entityType: "app_user",
          entityId: userId,
          details: { targetUsername: target.username, before: { active: target.active, role: target.role } },
        },
      });
      return u;
    });

    return NextResponse.json({
      ok: true,
      user: { id: updated.id, username: updated.username, role: updated.role, active: updated.active },
    });
  } catch (e) {
    console.error("admin users error", e);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}