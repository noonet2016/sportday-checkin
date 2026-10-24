import { prisma } from "../src/lib/prisma";
import { performCheckin, staffRecordCheckin, clearCheckinFlag, deleteCheckinRecord, updateStaffRecord, cancelStaffRecord, SPORT_REQUIRED_MESSAGE, SLOT_NOT_STARTED_MESSAGE, CHECKIN_ALREADY_DONE_MESSAGE, NOT_EVENT_DAY_MESSAGE, STAFF_STUDENT_ALREADY_CHECKED_IN_MESSAGE } from "../src/lib/checkin-core";
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
    await check("self check-in time is stored as Bangkok wall-clock (08:30, not 01:30)", async () => (await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: student.id, slotId: morning.id } }, select: { checkedInAt: true } }))?.checkedInAt.toISOString() === "2026-10-26T08:30:00.000Z");
    await check("check-in result reports distance and radius", async () => typeof openResult.distanceM === "number" && typeof openResult.radiusM === "number" && openResult.distanceM <= openResult.radiusM);
    const duplicate = await performCheckin({ studentId: student.id, now: at(8, 30), role: "compete", sport: "ฟุตบอล", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    await check("second call returns friendly already-checked-in result and row count stays 1", async () => duplicate.ok && duplicate.message === CHECKIN_ALREADY_DONE_MESSAGE && await prisma.checkinRecord.count({ where: { studentId: student.id, slotId: morning.id } }) === 1);

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
    await check("non-event day rejects", async () => !nonEvent.ok && nonEvent.message === NOT_EVENT_DAY_MESSAGE);
    const unboundResult = await performCheckin({ studentId: unbound.id, now: at(8, 30), role: "cheer", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    const nonpurpleResult = await performCheckin({ studentId: nonpurple.id, now: at(8, 30), role: "cheer", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    await check("unbound and non-purple student accounts reject", async () => !unboundResult.ok && !nonpurpleResult.ok);

    stage = "staff check-in core";
    const emptyReason = await staffRecordCheckin({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, studentId: staffStudent.id, slotId: morning.id, role: "compete", reason: " ", now: at(8, 30).wallClock });
    await check("staff on-behalf empty reason rejects", async () => !emptyReason.ok && !(await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: staffStudent.id, slotId: morning.id } } })));
    const competeNoSportStaff = await staffRecordCheckin({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, studentId: staffStudent.id, slotId: morning.id, role: "compete", reason: "ไม่ได้นำโทรศัพท์มา", now: at(8, 30).wallClock });
    const competeNoSportStudent = await performCheckin({ studentId: geoStudent.id, now: at(8, 30), role: "compete", sport: "  ", lat: center.lat, lng: center.lng, accuracy: 20, samples, ip: null });
    await check("compete without a sport is rejected (staff + student)", async () => !competeNoSportStaff.ok && competeNoSportStaff.message === SPORT_REQUIRED_MESSAGE && !competeNoSportStudent.ok && competeNoSportStudent.message === SPORT_REQUIRED_MESSAGE && !await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: staffStudent.id, slotId: morning.id } } }));
    const futureSlot = await staffRecordCheckin({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, studentId: staffStudent.id, slotId: afternoon.id, role: "cheer", reason: "ลืมเช็คชื่อ", now: at(8, 30).wallClock });
    await check("on-behalf for a slot that has not opened yet is rejected", async () => !futureSlot.ok && futureSlot.message === SLOT_NOT_STARTED_MESSAGE && !await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: staffStudent.id, slotId: afternoon.id } } }));
    const backdated = await staffRecordCheckin({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, studentId: geoStudent.id, slotId: morning.id, role: "cheer", reason: "ลืมเช็คชื่อ", now: at(17, 0).wallClock });
    await check("on-behalf back-dated to an earlier slot (evening review) is accepted", async () => backdated.ok && (await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: geoStudent.id, slotId: morning.id } }, select: { source: true } }))?.source === "staff");
    const staffResult = await staffRecordCheckin({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, studentId: staffStudent.id, slotId: morning.id, role: "cheer", reason: "late arrival", now: at(8, 30).wallClock });
    const staffRow = await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: staffStudent.id, slotId: morning.id } }, select: { id: true, source: true, staffId: true } });
    await check("staff on-behalf with reason persists source, staffId and audit", async () => staffResult.ok && staffRow?.source === "staff" && staffRow.staffId === admin.id && Boolean(await prisma.auditLog.findFirst({ where: { actor: `staff:${admin.id}`, action: "staff_checkin_created", targetId: String(staffRow.id) } })));
    const outOfScope = await staffRecordCheckin({ staffId: staff.id, studentId: outsideStudent.id, slotId: afternoon.id, role: "cheer", reason: "out of scope test", now: at(8, 30).wallClock, allowedRooms: staffScope });
    await check("staff on-behalf record for out-of-scope student rejects", async () => !outOfScope.ok && !await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: outsideStudent.id, slotId: afternoon.id } } }));
    const selfAlready = await staffRecordCheckin({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, studentId: student.id, slotId: morning.id, role: "cheer", reason: "student already self checked in", now: at(8, 30).wallClock });
    await check("staff on-behalf after self-check rejects explicitly without creating a row", async () => !selfAlready.ok && selfAlready.message === STAFF_STUDENT_ALREADY_CHECKED_IN_MESSAGE && await prisma.checkinRecord.count({ where: { studentId: student.id, slotId: morning.id } }) === 1);

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
    stage = "staff edit / cancel of on-behalf records";
    const editOwn = await updateStaffRecord({ staffId: staff.id, isAdmin: false, allowedRooms: staffScope, recordId: staffRow!.id, role: "compete", sport: "ฟุตบอล", reason: "แก้บทบาทหลังบันทึก" });
    const editedRow = await prisma.checkinRecord.findUnique({ where: { id: staffRow!.id }, select: { role: true, sport: true, note: true } });
    await check("staff edits an in-scope on-behalf record and audit keeps before/after", async () => editOwn.ok && editedRow?.role === "compete" && editedRow.sport === "ฟุตบอล" && editedRow.note === "แก้บทบาทหลังบันทึก" && Boolean(await prisma.auditLog.findFirst({ where: { actor: `staff:${staff.id}`, action: "checkin_updated", targetId: String(staffRow!.id) } })));
    const selfRow = await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: student.id, slotId: morning.id } }, select: { id: true, role: true } });
    const editSelf = await updateStaffRecord({ staffId: staff.id, isAdmin: false, allowedRooms: staffScope, recordId: selfRow!.id, role: selfRow!.role === "cheer" ? "compete" : "cheer", reason: "พยายามแก้รายการที่นักเรียนเช็คเอง" });
    await check("staff cannot edit a student's own check-in", async () => !editSelf.ok && (await prisma.checkinRecord.findUnique({ where: { id: selfRow!.id }, select: { role: true } }))?.role === selfRow!.role);
    await staffRecordCheckin({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, studentId: outsideStudent.id, slotId: morning.id, role: "cheer", reason: "admin on-behalf outside staff scope", now: at(8, 30).wallClock });
    const outsideRow = await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: outsideStudent.id, slotId: morning.id } }, select: { id: true } });
    const editOut = await updateStaffRecord({ staffId: staff.id, isAdmin: false, allowedRooms: staffScope, recordId: outsideRow!.id, role: "compete", reason: "นอกห้องที่ดูแล" });
    const cancelOut = await cancelStaffRecord({ staffId: staff.id, isAdmin: false, allowedRooms: staffScope, recordId: outsideRow!.id });
    await check("staff cannot edit or cancel an out-of-scope record", async () => !editOut.ok && !cancelOut.ok && Boolean(await prisma.checkinRecord.findUnique({ where: { id: outsideRow!.id } })));
    const cancelSelf = await cancelStaffRecord({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, recordId: selfRow!.id });
    await check("cancel never removes a student's own check-in (even for admin)", async () => !cancelSelf.ok && Boolean(await prisma.checkinRecord.findUnique({ where: { id: selfRow!.id } })));
    const adminEditSelf = await updateStaffRecord({ staffId: admin.id, isAdmin: true, allowedRooms: adminScope, recordId: selfRow!.id, role: "cheer", reason: "admin แก้บทบาทให้นักเรียน" });
    await check("admin can edit a student's own check-in", async () => adminEditSelf.ok && (await prisma.checkinRecord.findUnique({ where: { id: selfRow!.id }, select: { role: true } }))?.role === "cheer");
    const cancelOwn = await cancelStaffRecord({ staffId: staff.id, isAdmin: false, allowedRooms: staffScope, recordId: staffRow!.id });
    await check("staff cancels an in-scope on-behalf record with audit", async () => cancelOwn.ok && !await prisma.checkinRecord.findUnique({ where: { id: staffRow!.id } }) && Boolean(await prisma.auditLog.findFirst({ where: { actor: `staff:${staff.id}`, action: "staff_checkin_cancelled", targetId: String(staffRow!.id) } })));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
    const column = error && typeof error === "object" && "meta" in error && (error as { meta?: { column_name?: unknown } }).meta?.column_name ? ` column=${String((error as { meta: { column_name: unknown } }).meta.column_name)}` : "";
    console.log(`FAIL ${stage}: ${error instanceof Error ? error.name : "unknown error"}${code ? ` ${code}` : ""}${column}`); failed = true;
  } finally {
    try {
      if (studentIds.length) await prisma.checkinRecord.deleteMany({ where: { studentId: { in: studentIds } } });
      if (auditActors.length) await prisma.auditLog.deleteMany({ where: { actor: { in: auditActors } } });
      if (studentIds.length) await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
      if (staffIds.length) await prisma.staffRoom.deleteMany({ where: { staffId: { in: staffIds } } });
      if (staffIds.length) await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
      if (createdSettingKeys.length) await prisma.systemSetting.deleteMany({ where: { key: { in: createdSettingKeys } } });
    } catch { console.log("FAIL temporary-row cleanup"); failed = true; }
    await prisma.$disconnect();
  }
  if (failed) process.exitCode = 1;
}
void main();
