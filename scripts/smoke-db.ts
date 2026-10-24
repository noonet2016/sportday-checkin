import { prisma } from "../src/lib/prisma";
import { performCheckin, staffRecordCheckin, clearCheckinFlag, deleteCheckinRecord } from "../src/lib/checkin-core";
import type { CheckinGpsSample } from "../src/lib/spoof";
import { nowInBangkok } from "../src/lib/time";
import { allowedRooms, roomAllowed } from "../src/lib/staff-access";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const parsed = new URL(url);
if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) || !parsed.pathname.includes("sportday_dev")) throw new Error("Refusing DB smoke test: development DB must be localhost sportday_dev");

let failed = false;
let studentIds: number[] = [];
let staffIds: number[] = [];
let auditActors: string[] = [];
let createdSettingKeys: string[] = [];
async function check(name: string, fn: () => Promise<boolean>): Promise<boolean> {
  try { const ok = await fn(); console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed = true; return ok; }
  catch { console.log(`FAIL ${name}`); failed = true; return false; }
}
const eventDate = new Date(Date.UTC(2026, 9, 26));
const at = (hour: number, minute = 0, second = 0) => ({ dateOnly: eventDate, wallClock: new Date(Date.UTC(2026, 9, 26, hour, minute, second)) });
const samples: CheckinGpsSample[] = [1, 2, 3].map(() => ({ lat: 13.7563, lng: 100.5018, accuracy: 20, altitude: null, altitudeAccuracy: null, speed: null, heading: null, timestamp: 1_790_000_000_000 }));
const token = `smoke-${Date.now().toString().slice(-7)}-${Math.random().toString(36).slice(2, 6)}`;
async function main() {
  let stage = "database preflight";
  try {
    const event = await prisma.eventDay.findUnique({ where: { date: eventDate }, select: { id: true } });
    stage = "seeded event slots and geofence fixture";
    const morning = event ? await prisma.checkinSlot.findUnique({ where: { eventDayId_period: { eventDayId: event.id, period: "morning" } }, select: { id: true } }) : null;
    const afternoon = event ? await prisma.checkinSlot.findUnique({ where: { eventDayId_period: { eventDayId: event.id, period: "afternoon" } }, select: { id: true } }) : null;
    let settings = await prisma.systemSetting.findMany({ where: { key: { in: ["geofence_lat", "geofence_lng", "geofence_radius_m"] } } });
    // Local fixture only: preserve existing values and remove only keys created by this run.
    for (const [key, value] of [["geofence_lat", "13.7563"], ["geofence_lng", "100.5018"], ["geofence_radius_m", "300"]] as const) {
      if (!settings.some(s => s.key === key)) { stage = `temporary geofence fixture (${key})`; await prisma.$executeRaw`INSERT INTO system_settings (\`key\`, \`value\`) VALUES (${key}, ${value})`; createdSettingKeys.push(key); }
    }
    settings = await prisma.systemSetting.findMany({ where: { key: { in: ["geofence_lat", "geofence_lng", "geofence_radius_m"] } } });
    const setting = (key: string) => Number(settings.find(s => s.key === key)?.value);
    const center = { lat: setting("geofence_lat"), lng: setting("geofence_lng") };
    const radius = setting("geofence_radius_m");
    if (!morning || !afternoon || ![center.lat, center.lng, radius].every(Number.isFinite) || radius <= 0) throw new Error("seeded slots or geofence settings missing");
    stage = "temporary test records";
    const student = await prisma.student.create({ data: { studentCode: `${token}-bound`, firstName: "Smoke", lastName: "Test", classLevel: "TEST", room: "0", house: "purple", lineUserId: `line-${token}` } }); studentIds.push(student.id);
    const unbound = await prisma.student.create({ data: { studentCode: `${token}-unbound`, firstName: "Smoke", lastName: "Test", classLevel: "TEST", room: "0", house: "purple" } }); studentIds.push(unbound.id);
    const nonpurple = await prisma.student.create({ data: { studentCode: `${token}-other`, firstName: "Smoke", lastName: "Test", classLevel: "TEST", room: "0", house: "green", lineUserId: `line-other-${token}` } }); studentIds.push(nonpurple.id);
    const geoStudent = await prisma.student.create({ data: { studentCode: `${token}-geo`, firstName: "Smoke", lastName: "Test", classLevel: "TEST", room: "0", house: "purple", lineUserId: `line-geo-${token}` } }); studentIds.push(geoStudent.id);
    const suspiciousStudent = await prisma.student.create({ data: { studentCode: `${token}-suspicious`, firstName: "Smoke", lastName: "Test", classLevel: "TEST", room: "0", house: "purple", lineUserId: `line-suspicious-${token}` } }); studentIds.push(suspiciousStudent.id);
    const staffStudent = await prisma.student.create({ data: { studentCode: `${token}-stafftarget`, firstName: "Smoke", lastName: "Test", classLevel: "TEST", room: "0", house: "purple", lineUserId: `line-stafftarget-${token}` } }); studentIds.push(staffStudent.id);
    const outsideStudent = await prisma.student.create({ data: { studentCode: `${token}-outside`, firstName: "Smoke", lastName: "Test", classLevel: "TEST", room: "1", house: "purple", lineUserId: `line-outside-${token}` } }); studentIds.push(outsideStudent.id);
    const admin = await prisma.staff.create({ data: { username: `${token}-admin`, passwordHash: "not-a-login-hash", displayName: "Smoke Test", role: "admin" } }); staffIds.push(admin.id); auditActors.push(`admin:${admin.id}`, `staff:${admin.id}`);
    const staff = await prisma.staff.create({ data: { username: `${token}-staff`, passwordHash: "not-a-login-hash", displayName: "Smoke Test", role: "staff" } }); staffIds.push(staff.id); auditActors.push(`staff:${staff.id}`);
    await prisma.staffRoom.create({ data: { staffId: staff.id, classLevel: "TEST", room: "0" } });
    const staffScope = await allowedRooms({ role: "staff", id: String(staff.id) });
    const adminScope = await allowedRooms({ role: "admin", id: String(admin.id) });
    const scopedTotals = await prisma.student.count({ where: { house: "purple", OR: staffScope.map(r => ({ classLevel: r.classLevel, room: r.room })) } });
    const allTotals = await prisma.student.count({ where: { house: "purple" } });
    const exactRoomTotal = await prisma.student.count({ where: { house: "purple", classLevel: "TEST", room: "0" } });
    await check("staff totals include only assigned rooms; admin scope remains all rooms", async () => staffScope.length === 1 && staffScope[0].classLevel === "TEST" && staffScope[0].room === "0" && scopedTotals === exactRoomTotal && adminScope.length >= 15 && allTotals >= scopedTotals);
    await check("staff room page scope denies unassigned room", async () => roomAllowed(staffScope, "TEST", "0") && !roomAllowed(staffScope, "TEST", "1"));

    stage = "self-check-in core and audit";
    const openResult = await performCheckin({ studentId: student.id, now: at(8, 30), role: "compete", sport: "track", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: "127.0.0.1" });
    await check("open-window accepts and persists one row plus audit", async () => openResult.ok && Boolean(await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: student.id, slotId: morning.id } } })) && Boolean(await prisma.auditLog.findFirst({ where: { actor: `student:${student.id}`, action: "checkin_created" } })));
    const duplicate = await performCheckin({ studentId: student.id, now: at(8, 30), role: "compete", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    await check("second call returns friendly already-checked-in result and row count stays 1", async () => duplicate.ok && duplicate.message.includes("already checked in") && await prisma.checkinRecord.count({ where: { studentId: student.id, slotId: morning.id } }) === 1);

    stage = "geofence and suspicious GPS";
    const rejectedGeo = await performCheckin({ studentId: geoStudent.id, now: at(8, 31), role: "cheer", lat: 0, lng: 0, accuracy: 20, samples, ip: null });
    await check("outside configured geofence rejects with no row", async () => !rejectedGeo.ok && (await prisma.checkinRecord.count({ where: { studentId: geoStudent.id } })) === 0);
    const suspicious = await performCheckin({ studentId: suspiciousStudent.id, now: at(8, 32), role: "cheer", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    const suspiciousRow = await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: suspiciousStudent.id, slotId: morning.id } }, select: { id: true, isSuspicious: true, suspicionReasons: true } });
    await check("zero-jitter samples accept with suspicious flag and reasons", async () => suspicious.ok && Boolean(suspiciousRow?.isSuspicious) && Boolean(suspiciousRow?.suspicionReasons));

    stage = "event-window and student eligibility";
    process.env.DEV_NOW = "2026-10-26T07:59:00";
    const beforeNow = nowInBangkok();
    const before = await performCheckin({ studentId: student.id, now: beforeNow, role: "cheer", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    await check("before-window 07:59 rejects", async () => !before.ok && !before.message.includes("complete"));
    const morningClose = await performCheckin({ studentId: student.id, now: at(10, 0), role: "cheer", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    const afternoonClose = await performCheckin({ studentId: student.id, now: at(14, 0), role: "cheer", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    await check("after-window boundaries 10:00:00 and 14:00:00 reject", async () => !morningClose.ok && !afternoonClose.ok);
    const nonEvent = await performCheckin({ studentId: student.id, now: { dateOnly: new Date(Date.UTC(2026, 9, 31)), wallClock: new Date(Date.UTC(2026, 9, 31, 8, 30)) }, role: "cheer", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    await check("non-event day rejects", async () => !nonEvent.ok && nonEvent.message.includes("not a Sport Day event day"));
    const unboundResult = await performCheckin({ studentId: unbound.id, now: at(8, 30), role: "cheer", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    const nonpurpleResult = await performCheckin({ studentId: nonpurple.id, now: at(8, 30), role: "cheer", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    await check("unbound and non-purple student accounts reject", async () => !unboundResult.ok && !nonpurpleResult.ok);

    stage = "staff check-in core";
    const emptyReason = await staffRecordCheckin({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, studentId: staffStudent.id, slotId: morning.id, role: "compete", reason: " ", now: at(8, 30).wallClock });
    await check("staff on-behalf empty reason rejects", async () => !emptyReason.ok && !(await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: staffStudent.id, slotId: morning.id } } })));
    const staffResult = await staffRecordCheckin({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, studentId: staffStudent.id, slotId: morning.id, role: "cheer", reason: "late arrival", now: at(8, 30).wallClock });
    const staffRow = await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: staffStudent.id, slotId: morning.id } }, select: { id: true, source: true, staffId: true } });
    await check("staff on-behalf with reason persists source, staffId and audit", async () => staffResult.ok && staffRow?.source === "staff" && staffRow.staffId === admin.id && Boolean(await prisma.auditLog.findFirst({ where: { actor: `staff:${admin.id}`, action: "staff_checkin_created", targetId: String(staffRow.id) } })));
    const outOfScope = await staffRecordCheckin({ staffId: staff.id, studentId: outsideStudent.id, slotId: afternoon.id, role: "cheer", reason: "out of scope test", now: at(8, 30).wallClock, allowedRooms: staffScope });
    await check("staff on-behalf record for out-of-scope student rejects", async () => !outOfScope.ok && !await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: outsideStudent.id, slotId: afternoon.id } } }));
    const selfAlready = await staffRecordCheckin({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, studentId: student.id, slotId: morning.id, role: "cheer", reason: "student already self checked in", now: at(8, 30).wallClock });
    await check("staff on-behalf after self-check rejects explicitly without creating a row", async () => !selfAlready.ok && selfAlready.message.includes("already checked in") && await prisma.checkinRecord.count({ where: { studentId: student.id, slotId: morning.id } }) === 1);

    stage = "admin clear-flag and delete cores";
    const clearTarget = suspiciousRow;
    if (!clearTarget) throw new Error("suspicious check-in record missing");
    const deniedClear = await clearCheckinFlag({ staffId: staff.id, role: "staff", recordId: clearTarget.id }).then(() => false, () => true);
    await check("staff non-admin clear-flag rejects and preserves flag", async () => deniedClear && Boolean((await prisma.checkinRecord.findUnique({ where: { id: clearTarget.id }, select: { isSuspicious: true } }))?.isSuspicious));
    await clearCheckinFlag({ staffId: admin.id, role: "admin", recordId: clearTarget.id });
    const cleared = await prisma.checkinRecord.findUnique({ where: { id: clearTarget.id }, select: { isSuspicious: true, suspicionReasons: true } });
    await check("admin clear-flag updates record and writes audit", async () => cleared?.isSuspicious === false && cleared.suspicionReasons === null && Boolean(await prisma.auditLog.findFirst({ where: { actor: `staff:${admin.id}`, action: "checkin_flag_cleared", targetId: String(clearTarget.id) } })));
    const deniedDelete = await deleteCheckinRecord({ staffId: staff.id, role: "staff", recordId: clearTarget.id }).then(() => false, () => true);
    await check("staff non-admin delete rejects and preserves record", async () => deniedDelete && Boolean(await prisma.checkinRecord.findUnique({ where: { id: clearTarget.id } })));
    await deleteCheckinRecord({ staffId: admin.id, role: "admin", recordId: clearTarget.id });
    await check("admin delete removes record and writes audit", async () => !await prisma.checkinRecord.findUnique({ where: { id: clearTarget.id } }) && Boolean(await prisma.auditLog.findFirst({ where: { actor: `admin:${admin.id}`, action: "checkin_deleted", targetId: String(clearTarget.id) } })));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
    const column = error && typeof error === "object" && "meta" in error && (error as { meta?: { column_name?: unknown } }).meta?.column_name ? ` column=${String((error as { meta: { column_name: unknown } }).meta.column_name)}` : "";
    console.log(`FAIL ${stage}: ${error instanceof Error ? error.name : "unknown error"}${code ? ` ${code}` : ""}${column}`); failed = true;
  } finally {
    try {
      if (studentIds.length) await prisma.checkinRecord.deleteMany({ where: { studentId: { in: studentIds } } });
      if (auditActors.length) await prisma.auditLog.deleteMany({ where: { actor: { in: auditActors } } });
      if (studentIds.length) await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
      if (staffIds.length) await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
      if (createdSettingKeys.length) await prisma.systemSetting.deleteMany({ where: { key: { in: createdSettingKeys } } });
    } catch { console.log("FAIL temporary-row cleanup"); failed = true; }
    await prisma.$disconnect();
  }
  if (failed) process.exitCode = 1;
}
void main();
