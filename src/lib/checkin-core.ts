import { prisma } from "@/lib/prisma";
import { resolveSlotWindow } from "@/lib/event";
import { haversineDistance } from "@/lib/geo";
import { scoreSuspicion, type CheckinGpsSample } from "@/lib/spoof";
import { writeAudit } from "@/lib/audit";

// Server-only domain operations shared by the authenticated actions and the local DB smoke test.
const SPORT_REQUIRED = false;
type CheckinRole = "compete" | "cheer";
type Result = { ok: boolean; message: string };
type CheckinNow = { dateOnly: Date; wallClock: Date };

export async function performCheckin(input: { studentId: number; now: CheckinNow; role: string; sport?: string; lat: number; lng: number; accuracy: number; samples: CheckinGpsSample[]; ip: string | null }): Promise<Result> {
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90 || !Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180 || !Number.isFinite(input.accuracy) || input.accuracy > 100) return { ok: false, message: "GPS location is unavailable or too inaccurate. Please try again outdoors." };
  if (input.role !== "compete" && input.role !== "cheer") return { ok: false, message: "Choose compete or cheer." };
  const role = input.role as CheckinRole;
  const sport = input.sport?.trim() ?? "";
  if (SPORT_REQUIRED && role === "compete" && !sport) return { ok: false, message: "Please enter your sport." };
  const window = resolveSlotWindow(input.now.wallClock);
  if (window.state !== "open") return { ok: false, message: window.state === "not-event-day" ? "Today is not a Sport Day event day." : "This check-in window is not open." };
  const student = await prisma.student.findUnique({ where: { id: input.studentId }, select: { id: true, house: true, lineUserId: true } });
  if (!student?.lineUserId || student.house !== "purple") return { ok: false, message: "Purple House student account required." };
  const eventDay = await prisma.eventDay.findUnique({ where: { date: input.now.dateOnly }, select: { id: true } });
  const slot = eventDay ? await prisma.checkinSlot.findUnique({ where: { eventDayId_period: { eventDayId: eventDay.id, period: window.period } }, select: { id: true } }) : null;
  if (!slot) return { ok: false, message: "Today’s slot has not been configured yet. Please ask staff." };
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: ["geofence_lat", "geofence_lng", "geofence_radius_m"] } } });
  const value = (key: string) => Number(settings.find((setting) => setting.key === key)?.value);
  const lat = value("geofence_lat"), lng = value("geofence_lng"), radius = value("geofence_radius_m");
  if (![lat, lng, radius].every(Number.isFinite) || radius <= 0) return { ok: false, message: "Campus geofence is not configured yet. Please ask staff." };
  if (haversineDistance(input.lat, input.lng, lat, lng) > radius) return { ok: false, message: "You are outside the campus check-in area. Please move inside the school boundary and try again." };
  const suspicion = scoreSuspicion(input.samples, input.lat, input.lng, { name: "campus", lat, lng });
  try {
    await prisma.$transaction(async (tx) => {
      const record = await tx.checkinRecord.create({ data: { studentId: student.id, slotId: slot.id, role, sport: role === "compete" && sport ? sport.slice(0, 100) : null, lat: input.lat, lng: input.lng, accuracy: input.accuracy, samples: input.samples, ipAddress: input.ip, isSuspicious: suspicion.suspicious, suspicionReasons: suspicion.reasons.join("; ") || null } });
      await writeAudit(tx, `student:${student.id}`, "checkin_created", "CheckinRecord", String(record.id), { slotId: slot.id, role, suspicious: suspicion.suspicious });
    });
    return { ok: true, message: "Check-in complete. Have a great Sport Day!" };
  } catch (error) { if ((error as { code?: string }).code === "P2002") return { ok: true, message: "You have already checked in for this slot." }; return { ok: false, message: "Could not save your check-in. Please try again." }; }
}

export async function staffRecordCheckin(input: { staffId: number; studentId: number; slotId: number; role: string; sport?: string; reason: string; now: Date }): Promise<Result> {
  const reason = input.reason.trim();
  if (!Number.isSafeInteger(input.studentId) || !Number.isSafeInteger(input.slotId) || !["compete", "cheer"].includes(input.role) || reason.length < 3 || reason.length > 500) return { ok: false, message: "A valid role and reason (3–500 characters) are required." };
  try {
    await prisma.$transaction(async tx => {
      const student = await tx.student.findFirst({ where: { id: input.studentId, house: "purple" }, select: { id: true } });
      const slot = await tx.checkinSlot.findUnique({ where: { id: input.slotId }, select: { id: true } });
      if (!student || !slot) throw new Error("Student or slot not found");
      if (await tx.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: input.studentId, slotId: input.slotId } }, select: { id: true } })) throw new Error("Student already checked in for this slot; staff on-behalf check-in was not created.");
      const record = await tx.checkinRecord.create({ data: { studentId: input.studentId, slotId: input.slotId, role: input.role, sport: input.role === "compete" && input.sport?.trim() ? input.sport.trim().slice(0, 100) : null, lat: 0, lng: 0, accuracy: 0, source: "staff", staffId: input.staffId, note: reason, checkedInAt: input.now } });
      await writeAudit(tx, `staff:${input.staffId}`, "staff_checkin_created", "CheckinRecord", String(record.id), { studentId: input.studentId, slotId: input.slotId, role: input.role, reason });
    });
    return { ok: true, message: "Staff check-in recorded." };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not record staff check-in." }; }
}

export async function clearCheckinFlag(input: { staffId: number; role: string; recordId: number }): Promise<void> {
  if (input.role !== "admin") throw new Error("Staff authorization required");
  if (!Number.isSafeInteger(input.recordId)) throw new Error("Invalid record");
  await prisma.$transaction(async tx => { const record = await tx.checkinRecord.findUnique({ where: { id: input.recordId }, select: { id: true } }); if (!record) throw new Error("Record not found");
    await tx.checkinRecord.update({ where: { id: input.recordId }, data: { isSuspicious: false, suspicionReasons: null } }); await writeAudit(tx, `staff:${input.staffId}`, "checkin_flag_cleared", "CheckinRecord", String(input.recordId)); });
}

export async function deleteCheckinRecord(input: { staffId: number; role: string; recordId: number }): Promise<void> {
  if (input.role !== "admin") throw new Error("Staff authorization required");
  if (!Number.isSafeInteger(input.recordId)) throw new Error("Invalid record");
  await prisma.$transaction(async tx => { const record = await tx.checkinRecord.findUnique({ where: { id: input.recordId }, select: { id: true, studentId: true, slotId: true } }); if (!record) throw new Error("Record not found");
    await writeAudit(tx, `admin:${input.staffId}`, "checkin_deleted", "CheckinRecord", String(input.recordId), { studentId: record.studentId, slotId: record.slotId }); await tx.checkinRecord.delete({ where: { id: input.recordId } }); });
}
