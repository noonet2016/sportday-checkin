import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line";

export async function POST(req: NextRequest) {
  let idToken = ""; let studentCode = "";
  try { const body = await req.json() as { idToken?: string; studentCode?: string }; idToken = String(body.idToken ?? ""); studentCode = String(body.studentCode ?? "").trim(); } catch { /* invalid JSON */ }
  if (!idToken || !studentCode) return NextResponse.json({ ok: false, error: "กรอกรหัสนักเรียน" }, { status: 400 });
  try {
    await verifyLiffIdToken(idToken);
    const student = await prisma.student.findUnique({ where: { studentCode }, select: { firstName: true, lastName: true, house: true, lineUserId: true } });
    if (!student || student.house !== "purple") return NextResponse.json({ ok: false, error: "ไม่พบรายชื่อนักเรียนสีม่วง" }, { status: 404 });
    if (student.lineUserId) return NextResponse.json({ ok: false, error: "รหัสนี้ผูกกับ LINE แล้ว" }, { status: 409 });
    return NextResponse.json({ ok: true, displayName: `${student.firstName} ${student.lastName.slice(0, 1)}.` });
  } catch { return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 401 }); }
}
