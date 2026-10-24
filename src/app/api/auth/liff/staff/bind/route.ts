import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line";
import { createSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

// Link this LINE account to a staff account after checking its username+password (once per teacher).
export async function POST(req: NextRequest) {
  let idToken = "", username = "", password = "";
  try { const b = await req.json() as { idToken?: string; username?: string; password?: string }; idToken = String(b.idToken ?? ""); username = String(b.username ?? "").trim().toLowerCase(); password = String(b.password ?? ""); } catch { /* invalid JSON */ }
  if (!idToken || !username || !password) return NextResponse.json({ ok: false, error: "กรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  try {
    const identity = await verifyLiffIdToken(idToken);
    const staff = await prisma.staff.findUnique({ where: { username }, select: { id: true, role: true, passwordHash: true, lineUserId: true } });
    if (!staff || !["admin", "staff"].includes(staff.role) || !(await bcrypt.compare(password, staff.passwordHash))) return NextResponse.json({ ok: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    if (staff.lineUserId && staff.lineUserId !== identity.userId) return NextResponse.json({ ok: false, error: "บัญชีนี้ผูกกับ LINE อื่นแล้ว ติดต่อผู้ดูแลระบบให้ยกเลิกผูกก่อน" }, { status: 409 });
    await prisma.$transaction(async (tx) => {
      await tx.staff.update({ where: { id: staff.id }, data: { lineUserId: identity.userId, lineDisplayName: identity.displayName || null, lineLinkedAt: new Date() } });
      await writeAudit(tx, `${staff.role}:${staff.id}`, "staff_line_bound", "Staff", String(staff.id), { lineDisplayName: identity.displayName || null });
    });
    await createSession(staff.role === "admin" ? "admin" : "staff", String(staff.id));
    return NextResponse.json({ ok: true, redirect: "/staff" });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json({ ok: false, error: code === "P2002" ? "LINE นี้ผูกกับบัญชีครูคนอื่นแล้ว" : "ผูกบัญชีไม่สำเร็จ" }, { status: code === "P2002" ? 409 : 401 });
  }
}
