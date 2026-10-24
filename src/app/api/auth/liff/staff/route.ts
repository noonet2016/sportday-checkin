import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line";
import { createSession } from "@/lib/session";

// Staff sign-in with LINE (optional; username+password login stays). 404 not_linked -> the page asks for username+password once.
export async function POST(req: NextRequest) {
  let idToken = "";
  try { idToken = String((await req.json() as { idToken?: string }).idToken ?? ""); } catch { /* invalid JSON */ }
  if (!idToken) return NextResponse.json({ ok: false, error: "missing_id_token" }, { status: 400 });
  try {
    const identity = await verifyLiffIdToken(idToken);
    const staff = await prisma.staff.findUnique({ where: { lineUserId: identity.userId }, select: { id: true, role: true } });
    if (!staff) return NextResponse.json({ ok: false, error: "not_linked", displayName: identity.displayName }, { status: 404 });
    await createSession(staff.role === "admin" ? "admin" : "staff", String(staff.id));
    return NextResponse.json({ ok: true, redirect: "/staff" });
  } catch { return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 401 }); }
}
