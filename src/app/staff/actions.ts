"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, requireStaff } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function loginStaff(form: FormData) {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password || username.length > 100 || password.length > 200) redirect("/staff/login?error=1");
  const staff = await prisma.staff.findUnique({ where: { username }, select: { id: true, passwordHash: true, role: true } });
  if (!staff || !(await bcrypt.compare(password, staff.passwordHash)) || !["admin", "staff"].includes(staff.role)) redirect("/staff/login?error=1");
  await createSession(staff.role as "admin" | "staff", String(staff.id)); redirect("/staff");
}

export async function logoutStaff() { await destroySession(); redirect("/staff/login"); }

export async function manualRecord(form: FormData) {
  const actor = await requireStaff();
  const studentId = Number(form.get("studentId")); const slotId = Number(form.get("slotId"));
  const role = String(form.get("role")); const reason = String(form.get("reason") ?? "").trim(); const sport = String(form.get("sport") ?? "").trim();
  if (!Number.isSafeInteger(studentId) || !Number.isSafeInteger(slotId) || !["compete", "cheer"].includes(role) || reason.length < 3 || reason.length > 500) throw new Error("Invalid manual check-in input");
  await prisma.$transaction(async tx => {
    const student = await tx.student.findFirst({ where: { id: studentId, house: "purple" }, select: { id: true } });
    const slot = await tx.checkinSlot.findUnique({ where: { id: slotId }, select: { id: true } });
    if (!student || !slot) throw new Error("Student or slot not found");
    const record = await tx.checkinRecord.create({ data: { studentId, slotId, role, sport: role === "compete" && sport ? sport.slice(0, 100) : null, lat: 0, lng: 0, accuracy: 0, source: "staff", staffId: Number(actor.id), note: reason } });
    await writeAudit(tx, `staff:${actor.id}`, "staff_checkin_created", "CheckinRecord", String(record.id), { studentId, slotId, role, reason });
  }); revalidatePath("/staff"); revalidatePath("/staff/report");
}

export async function clearFlag(form: FormData) {
  const actor = await requireStaff(true); const id = Number(form.get("recordId"));
  if (!Number.isSafeInteger(id)) throw new Error("Invalid record");
  await prisma.$transaction(async tx => { const record = await tx.checkinRecord.findUnique({ where: { id }, select: { id: true, isSuspicious: true } }); if (!record) throw new Error("Record not found");
    await tx.checkinRecord.update({ where: { id }, data: { isSuspicious: false, suspicionReasons: null } }); await writeAudit(tx, `staff:${actor.id}`, "checkin_flag_cleared", "CheckinRecord", String(id)); }); revalidatePath("/staff");
}

export async function deleteRecord(form: FormData) {
  const actor = await requireStaff(true); const id = Number(form.get("recordId"));
  if (!Number.isSafeInteger(id)) throw new Error("Invalid record");
  await prisma.$transaction(async tx => { const record = await tx.checkinRecord.findUnique({ where: { id }, select: { id: true, studentId: true, slotId: true } }); if (!record) throw new Error("Record not found");
    await writeAudit(tx, `admin:${actor.id}`, "checkin_deleted", "CheckinRecord", String(id), { studentId: record.studentId, slotId: record.slotId }); await tx.checkinRecord.delete({ where: { id } }); }); revalidatePath("/staff"); revalidatePath("/staff/report");
}

export async function saveSettings(form: FormData) {
  const actor = await requireStaff(true); const lat = Number(form.get("lat")); const lng = Number(form.get("lng")); const radius = Number(form.get("radius"));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isInteger(radius) || radius < 10 || radius > 10000) throw new Error("Invalid geofence settings");
  await prisma.$transaction(async tx => { for (const [key, value] of [["geofence_lat", lat], ["geofence_lng", lng], ["geofence_radius_m", radius]] as const) await tx.systemSetting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } }); await writeAudit(tx, `admin:${actor.id}`, "geofence_updated", "SystemSetting", "geofence", { lat, lng, radius }); }); revalidatePath("/staff/settings");
}
