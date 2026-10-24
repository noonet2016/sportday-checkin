// Creates one homeroom-teacher account per purple-house room (Trainer, 2026-10-25):
//   username teacher<level><room>   e.g. 2/14 -> teacher214
//   password <prefix><level><room>   prefix passed on the command line (kept out of git), e.g. Tnw@ -> Tnw@214
// Existing accounts keep their password (re-runs only add missing accounts / room links) unless --reset-passwords.
// Run: npx tsx --env-file=.env scripts/create-room-teachers.ts --prefix 'Tnw@' [--reset-passwords]
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { compareRooms } from "../src/lib/event";

async function main() {
  const i = process.argv.indexOf("--prefix"); const prefix = i > 0 ? process.argv[i + 1] : undefined;
  if (!prefix) throw new Error("usage: --prefix <password prefix>");
  const reset = process.argv.includes("--reset-passwords");
  const rooms = (await prisma.student.findMany({ where: { house: "purple" }, distinct: ["classLevel", "room"], select: { classLevel: true, room: true, program: true } })).sort(compareRooms);
  for (const r of rooms) {
    const code = `${r.classLevel}${r.room}`; const username = `teacher${code}`;
    const displayName = `ครูประจำชั้น ม.${r.classLevel}/${r.room}${r.program ? ` (${r.program})` : ""}`;
    const existing = await prisma.staff.findUnique({ where: { username }, select: { id: true } });
    const hash = !existing || reset ? await bcrypt.hash(`${prefix}${code}`, 12) : undefined;
    const staff = existing
      ? await prisma.staff.update({ where: { id: existing.id }, data: { displayName, ...(hash ? { passwordHash: hash } : {}) } })
      : await prisma.staff.create({ data: { username, displayName, passwordHash: hash!, role: "staff" } });
    await prisma.staffRoom.upsert({ where: { staffId_classLevel_room: { staffId: staff.id, classLevel: r.classLevel, room: r.room } }, update: {}, create: { staffId: staff.id, classLevel: r.classLevel, room: r.room } });
    await prisma.auditLog.create({ data: { actor: "script:create-room-teachers", action: existing ? (hash ? "staff_password_reset" : "staff_checked") : "staff_created", targetType: "Staff", targetId: String(staff.id), detail: { username, room: `${r.classLevel}/${r.room}` } } });
    console.log(`${existing ? (hash ? "RESET " : "KEPT  ") : "NEW   "} ${username.padEnd(12)} ม.${r.classLevel}/${r.room}`);
  }
  console.log(`${rooms.length} rooms`);
}
main().finally(() => prisma.$disconnect());
