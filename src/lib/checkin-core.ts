import { prisma } from "@/lib/prisma";
import { slotWindowNow } from "@/lib/slots";
import { scoreSuspicion, type CheckinGpsSample } from "@/lib/spoof";
import { writeAudit } from "@/lib/audit";
import { distanceFromCentre, getGeofence } from "@/lib/geofence";
import { formatDistance } from "@/lib/geo";
import type { RoomKey } from "@/lib/staff-access";
import type { Prisma } from "@/generated/prisma/client";

// Server-only domain operations shared by the authenticated actions and the local DB smoke test.
const SPORT_REQUIRED = true; // Trainer 2026-10-24: compete must name a sport (picker + "อื่น ๆ")
export const SPORT_REQUIRED_MESSAGE = "กรุณาเลือกชนิดกีฬาที่แข่ง";
export const SLOT_NOT_STARTED_MESSAGE = "รอบนี้ยังไม่ถึงเวลา บันทึกแทนล่วงหน้าไม่ได้";
type CheckinRole = "compete" | "cheer";
type Result = { ok: boolean; message: string; distanceM?: number; radiusM?: number };
type CheckinNow = { dateOnly: Date; wallClock: Date };
export const CHECKIN_ALREADY_DONE_MESSAGE = "คุณเช็คอินช่วงนี้ไปแล้ว";
export const NOT_EVENT_DAY_MESSAGE = "วันนี้ไม่มีกิจกรรมกีฬาสี";
export const STAFF_STUDENT_ALREADY_CHECKED_IN_MESSAGE = "นักเรียนเช็คชื่อในรอบนี้ไปแล้ว ไม่สามารถบันทึกแทนได้";

export async function performCheckin(input: { studentId: number; now: CheckinNow; role: string; sport?: string; lat: number; lng: number; accuracy: number; samples: CheckinGpsSample[]; ip: string | null }): Promise<Result> {
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90 || !Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180 || !Number.isFinite(input.accuracy) || input.accuracy > 100) return { ok: false, message: "ระบุตำแหน่ง GPS ไม่ได้หรือไม่แม่นยำพอ กรุณาลองใหม่ในที่โล่ง" };
  if (input.role !== "compete" && input.role !== "cheer") return { ok: false, message: "กรุณาเลือกแข่งกีฬาหรือเชียร์" };
  const role = input.role as CheckinRole;
  const sport = input.sport?.trim() ?? "";
  if (SPORT_REQUIRED && role === "compete" && !sport) return { ok: false, message: SPORT_REQUIRED_MESSAGE };
  const { window, slotId } = await slotWindowNow(input.now);
  if (window.state !== "open") return { ok: false, message: window.state === "not-event-day" ? NOT_EVENT_DAY_MESSAGE : "ยังไม่ถึงเวลาเช็คชื่อหรือหมดเวลาแล้ว" };
  const student = await prisma.student.findUnique({ where: { id: input.studentId }, select: { id: true, house: true, lineUserId: true } });
  if (!student?.lineUserId || student.house !== "purple") return { ok: false, message: "ต้องใช้บัญชีนักเรียนสีม่วง" };
  const slot = slotId ? { id: slotId } : null;
  if (!slot) return { ok: false, message: "ยังไม่ได้ตั้งค่ารอบเช็คชื่อวันนี้ กรุณาติดต่อเจ้าหน้าที่" };
  const fence = await getGeofence();
  if (!fence) return { ok: false, message: "ยังไม่ได้ตั้งค่าพื้นที่โรงเรียน กรุณาติดต่อเจ้าหน้าที่" };
  const { lat, lng, radius } = fence;
  const distanceM = distanceFromCentre(fence, input.lat, input.lng);
  if (distanceM > radius) return { ok: false, message: `คุณไม่ได้อยู่ในรัศมีที่กำหนด อยู่ห่างจากจุดเช็คชื่อประมาณ ${formatDistance(distanceM)} (กำหนดรัศมี ${formatDistance(radius)}) กรุณาเข้ามาในบริเวณโรงเรียนแล้วลองใหม่`, distanceM, radiusM: radius };
  const suspicion = scoreSuspicion(input.samples, input.lat, input.lng, { name: "campus", lat, lng });
  try {
    await prisma.$transaction(async (tx) => {
      const record = await tx.checkinRecord.create({ data: { studentId: student.id, slotId: slot.id, role, sport: role === "compete" && sport ? sport.slice(0, 100) : null, lat: input.lat, lng: input.lng, accuracy: input.accuracy, samples: input.samples, checkedInAt: input.now.wallClock, ipAddress: input.ip, isSuspicious: suspicion.suspicious, suspicionReasons: suspicion.reasons.join("; ") || null } });
      await writeAudit(tx, `student:${student.id}`, "checkin_created", "CheckinRecord", String(record.id), { slotId: slot.id, role, suspicious: suspicion.suspicious });
    });
    return { ok: true, message: "เช็คชื่อเรียบร้อย ขอให้สนุกกับกิจกรรมกีฬาสีนะ", distanceM, radiusM: radius };
  } catch (error) { if ((error as { code?: string }).code === "P2002") return { ok: true, message: CHECKIN_ALREADY_DONE_MESSAGE }; return { ok: false, message: "บันทึกการเช็คชื่อไม่สำเร็จ กรุณาลองใหม่" }; }
}

export async function staffRecordCheckin(input: { staffId: number; studentId: number; slotId: number; role: string; sport?: string; reason: string; now: Date; allowedRooms?: RoomKey[]; isAdmin?: boolean }): Promise<Result> {
  const reason = input.reason.trim();
  if (!Number.isSafeInteger(input.studentId) || !Number.isSafeInteger(input.slotId) || !["compete", "cheer"].includes(input.role) || reason.length < 3 || reason.length > 500) return { ok: false, message: "กรุณาเลือกบทบาทและระบุเหตุผล (3–500 ตัวอักษร)" };
  if (SPORT_REQUIRED && input.role === "compete" && !input.sport?.trim()) return { ok: false, message: SPORT_REQUIRED_MESSAGE };
  try {
    await prisma.$transaction(async tx => {
      const student = await tx.student.findFirst({ where: { id: input.studentId, house: "purple", ...(input.isAdmin ? {} : { OR: (input.allowedRooms ?? []).map(({ classLevel, room }) => ({ classLevel, room })) }) }, select: { id: true } });
      const slot = await tx.checkinSlot.findUnique({ where: { id: input.slotId }, select: { id: true, opensAt: true } });
      if (!student || !slot) throw new Error("ไม่พบข้อมูลนักเรียนหรือรอบเช็คชื่อ");
      // Back-dating to any slot that has already opened is allowed (e.g. evening review); future slots are not.
      if (slot.opensAt.getTime() > input.now.getTime()) throw new Error(SLOT_NOT_STARTED_MESSAGE);
      if (await tx.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: input.studentId, slotId: input.slotId } }, select: { id: true } })) throw new Error(STAFF_STUDENT_ALREADY_CHECKED_IN_MESSAGE);
      const record = await tx.checkinRecord.create({ data: { studentId: input.studentId, slotId: input.slotId, role: input.role, sport: input.role === "compete" && input.sport?.trim() ? input.sport.trim().slice(0, 100) : null, lat: 0, lng: 0, accuracy: 0, source: "staff", staffId: input.staffId, note: reason, checkedInAt: input.now } });
      await writeAudit(tx, `staff:${input.staffId}`, "staff_checkin_created", "CheckinRecord", String(record.id), { studentId: input.studentId, slotId: input.slotId, role: input.role, reason });
    });
    return { ok: true, message: "บันทึกการเช็คชื่อแทนเรียบร้อย" };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "บันทึกการเช็คชื่อแทนไม่สำเร็จ" }; }
}

export const EDIT_NOT_ALLOWED_MESSAGE = "แก้ไขได้เฉพาะรายการที่ครูบันทึกแทนในห้องที่ดูแล";

/** Load a record the actor may change: in scope, and (unless admin) one that staff recorded on the student's behalf. */
async function editableRecord(tx: Prisma.TransactionClient, input: { recordId: number; isAdmin: boolean; allowedRooms: RoomKey[] }) {
  const record = await tx.checkinRecord.findUnique({ where: { id: input.recordId }, include: { student: { select: { classLevel: true, room: true, house: true } } } });
  if (!record || record.student.house !== "purple") throw new Error("ไม่พบรายการเช็คชื่อ");
  const inScope = input.isAdmin || input.allowedRooms.some(r => r.classLevel === record.student.classLevel && r.room === record.student.room);
  if (!inScope || (!input.isAdmin && record.source !== "staff")) throw new Error(EDIT_NOT_ALLOWED_MESSAGE);
  return record;
}

export async function updateStaffRecord(input: { staffId: number; isAdmin: boolean; allowedRooms: RoomKey[]; recordId: number; role: string; sport?: string; reason: string }): Promise<Result> {
  const reason = input.reason.trim();
  if (!Number.isSafeInteger(input.recordId) || !["compete", "cheer"].includes(input.role) || reason.length < 3 || reason.length > 500) return { ok: false, message: "กรุณาเลือกบทบาทและระบุเหตุผล (3–500 ตัวอักษร)" };
  if (SPORT_REQUIRED && input.role === "compete" && !input.sport?.trim()) return { ok: false, message: SPORT_REQUIRED_MESSAGE };
  try {
    await prisma.$transaction(async tx => {
      const before = await editableRecord(tx, input);
      const sport = input.role === "compete" && input.sport?.trim() ? input.sport.trim().slice(0, 100) : null;
      await tx.checkinRecord.update({ where: { id: before.id }, data: { role: input.role, sport, note: reason } });
      await writeAudit(tx, `${input.isAdmin ? "admin" : "staff"}:${input.staffId}`, "checkin_updated", "CheckinRecord", String(before.id), { before: { role: before.role, sport: before.sport, note: before.note }, after: { role: input.role, sport, note: reason } });
    });
    return { ok: true, message: "แก้ไขรายการเรียบร้อย" };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "แก้ไขรายการไม่สำเร็จ" }; }
}

/** Undo an on-behalf record (staff in scope or admin). Deleting a student's own check-in stays admin-only via deleteCheckinRecord. */
export async function cancelStaffRecord(input: { staffId: number; isAdmin: boolean; allowedRooms: RoomKey[]; recordId: number }): Promise<Result> {
  try {
    await prisma.$transaction(async tx => {
      const record = await editableRecord(tx, input);
      if (record.source !== "staff") throw new Error(EDIT_NOT_ALLOWED_MESSAGE);
      await writeAudit(tx, `${input.isAdmin ? "admin" : "staff"}:${input.staffId}`, "staff_checkin_cancelled", "CheckinRecord", String(record.id), { studentId: record.studentId, slotId: record.slotId, role: record.role, note: record.note });
      await tx.checkinRecord.delete({ where: { id: record.id } });
    });
    return { ok: true, message: "ยกเลิกการบันทึกแทนเรียบร้อย" };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "ยกเลิกไม่สำเร็จ" }; }
}

/** Teacher → admin: flag a student's own check-in for review. The admin then keeps it (resolve) or deletes it. */
export async function requestReview(input: { staffId: number; isAdmin: boolean; allowedRooms: RoomKey[]; recordId: number; reason: string; now: Date }): Promise<Result> {
  const reason = input.reason.trim();
  if (!Number.isSafeInteger(input.recordId) || reason.length < 3 || reason.length > 500) return { ok: false, message: "กรุณาเลือกเหตุผลที่แจ้งตรวจ (3–500 ตัวอักษร)" };
  try {
    await prisma.$transaction(async tx => {
      const record = await tx.checkinRecord.findUnique({ where: { id: input.recordId }, include: { student: { select: { classLevel: true, room: true, house: true } } } });
      if (!record || record.student.house !== "purple") throw new Error("ไม่พบรายการเช็คชื่อ");
      if (!input.isAdmin && !input.allowedRooms.some(r => r.classLevel === record.student.classLevel && r.room === record.student.room)) throw new Error("แจ้งตรวจได้เฉพาะห้องที่ดูแล");
      if (record.source !== "self") throw new Error("รายการที่ครูบันทึกแทน แก้ไขหรือยกเลิกได้เองโดยไม่ต้องแจ้งตรวจ");
      await tx.checkinRecord.update({ where: { id: record.id }, data: { reviewRequested: true, reviewReason: reason, reviewRequestedBy: input.staffId, reviewRequestedAt: input.now } });
      await writeAudit(tx, `staff:${input.staffId}`, "checkin_review_requested", "CheckinRecord", String(record.id), { reason });
    });
    return { ok: true, message: "แจ้ง admin ตรวจแล้ว" };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "แจ้งตรวจไม่สำเร็จ" }; }
}

/** Admin closes a review request and keeps the record as is. */
export async function resolveReview(input: { staffId: number; role: string; recordId: number }): Promise<void> {
  if (input.role !== "admin") throw new Error("ต้องใช้สิทธิ์ผู้ดูแลระบบ");
  await prisma.$transaction(async tx => {
    const record = await tx.checkinRecord.findUnique({ where: { id: input.recordId }, select: { id: true, reviewReason: true } });
    if (!record) throw new Error("ไม่พบรายการเช็คชื่อ");
    await tx.checkinRecord.update({ where: { id: record.id }, data: { reviewRequested: false } });
    await writeAudit(tx, `admin:${input.staffId}`, "checkin_review_resolved", "CheckinRecord", String(record.id), { kept: true, reason: record.reviewReason });
  });
}

export async function clearCheckinFlag(input: { staffId: number; role: string; recordId: number }): Promise<void> {
  if (input.role !== "admin") throw new Error("ต้องใช้สิทธิ์ผู้ดูแลระบบ");
  if (!Number.isSafeInteger(input.recordId)) throw new Error("ข้อมูลรายการไม่ถูกต้อง");
  await prisma.$transaction(async tx => { const record = await tx.checkinRecord.findUnique({ where: { id: input.recordId }, select: { id: true } }); if (!record) throw new Error("ไม่พบรายการเช็คชื่อ");
    await tx.checkinRecord.update({ where: { id: input.recordId }, data: { isSuspicious: false, suspicionReasons: null } }); await writeAudit(tx, `staff:${input.staffId}`, "checkin_flag_cleared", "CheckinRecord", String(input.recordId)); });
}

export async function deleteCheckinRecord(input: { staffId: number; role: string; recordId: number; reason: string }): Promise<void> {
  if (input.role !== "admin") throw new Error("ต้องใช้สิทธิ์ผู้ดูแลระบบ");
  if (!Number.isSafeInteger(input.recordId)) throw new Error("ข้อมูลรายการไม่ถูกต้อง");
  const reason = (input.reason ?? "").trim();
  if (reason.length < 3 || reason.length > 500) throw new Error("กรุณาระบุเหตุผลที่ลบรายการ (3–500 ตัวอักษร)");
  await prisma.$transaction(async tx => {
    const record = await tx.checkinRecord.findUnique({ where: { id: input.recordId }, select: { id: true, studentId: true, slotId: true, role: true, sport: true, source: true, staffId: true, note: true, lat: true, lng: true, accuracy: true, isSuspicious: true, suspicionReasons: true, checkedInAt: true } });
    if (!record) throw new Error("ไม่พบรายการเช็คชื่อ");
    // The row is gone after this, so the audit entry keeps the reason and a full snapshot for later review.
    await writeAudit(tx, `admin:${input.staffId}`, "checkin_deleted", "CheckinRecord", String(input.recordId), { reason, record: { ...record, checkedInAt: record.checkedInAt.toISOString() } });
    await tx.checkinRecord.delete({ where: { id: input.recordId } });
  });
}
