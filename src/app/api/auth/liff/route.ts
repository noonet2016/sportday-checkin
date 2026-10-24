import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  let idToken = "";
  try { idToken = String((await req.json() as { idToken?: string }).idToken ?? ""); } catch { /* invalid JSON */ }
  if (!idToken) return NextResponse.json({ ok: false, error: "missing_id_token" }, { status: 400 });
  try {
    const identity = await verifyLiffIdToken(idToken);
    const student = await prisma.student.findUnique({ where: { lineUserId: identity.userId }, select: { studentCode: true, house: true } });
    if (!student || student.house !== "purple") return NextResponse.json({ ok: false, error: "not_linked" }, { status: 404 });
    await createSession("student", student.studentCode);
    return NextResponse.json({ ok: true, redirect: "/checkin" });
  } catch { return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 401 }); }
}
