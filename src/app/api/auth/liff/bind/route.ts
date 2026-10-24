import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line";
import { createSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  let idToken = ""; let studentCode = "";
  try { const body = await req.json() as { idToken?: string; studentCode?: string }; idToken = String(body.idToken ?? ""); studentCode = String(body.studentCode ?? "").trim(); } catch { /* invalid JSON */ }
  if (!idToken || !studentCode) return NextResponse.json({ ok: false, error: "กรอกรหัสนักเรียน" }, { status: 400 });
  try {
    const identity = await verifyLiffIdToken(idToken);
    const student = await prisma.student.findUnique({ where: { studentCode }, select: { id: true, house: true, lineUserId: true } });
    if (!student || student.house !== "purple") return NextResponse.json({ ok: false, error: "ไม่พบรายชื่อนักเรียนสีม่วง" }, { status: 404 });
    if (student.lineUserId && student.lineUserId !== identity.userId) return NextResponse.json({ ok: false, error: "รหัสนี้ผูกกับ LINE อื่นแล้ว" }, { status: 409 });
    await prisma.$transaction(async (tx) => {
      await tx.student.update({ where: { id: student.id }, data: { lineUserId: identity.userId, lineDisplayName: identity.displayName || null, linkedAt: new Date() } });
      await writeAudit(tx, `line:${identity.userId}`, "student_bound", "Student", String(student.id), { method: "liff" });
    });
    await createSession("student", studentCode);
    return NextResponse.json({ ok: true, redirect: "/checkin" });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json({ ok: false, error: code === "P2002" ? "LINE นี้ผูกกับนักเรียนคนอื่นแล้ว" : "ผูกบัญชีไม่สำเร็จ" }, { status: code === "P2002" ? 409 : 401 });
  }
}
