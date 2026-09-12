// POST /api/auth/login — username + bcrypt, httpOnly session cookie
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, createSessionToken, audit } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const user = await prisma.appUser.findUnique({ where: { username } });
    if (!user || !user.active) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSessionToken(user.id, user.username, user.role);
    await audit(user.id, "LOGIN", "app_user", user.id, { username });

    const res = NextResponse.json({
      ok: true,
      user: { username: user.username, fullName: user.fullName, role: user.role },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}