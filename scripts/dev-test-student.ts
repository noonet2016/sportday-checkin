// Creates/updates the dev test students 99901 (fake-bound) and 99902 (unbound) (room 2/14, bound to a fake LINE id) on the LOCAL dev DB only.
// Run: npx tsx --env-file=.env scripts/dev-test-student.ts   then open http://localhost:3000/api/dev/student-login
import { prisma } from "../src/lib/prisma";

async function main() {
  if (!/_dev\b|_dev$|sportday_dev/.test(process.env.DATABASE_URL ?? "")) throw new Error("Refusing: DATABASE_URL is not the local sportday_dev database");
  // Codes must be digits: the LIFF bind form uses a numeric keypad. Rename the earlier TEST00x rows if present.
  for (const [from, to] of [["TEST001", "99901"], ["TEST002", "99902"]]) await prisma.student.updateMany({ where: { studentCode: from }, data: { studentCode: to } });
  const data = { prefix: "นักเรียน", firstName: "ทดสอบ", lastName: "ระบบ", classLevel: "2", room: "14", program: "SMTE", number: 99, house: "purple", lineUserId: "dev-test-student", lineDisplayName: "Test Student (dev)", linkedAt: new Date() };
  const s = await prisma.student.upsert({ where: { studentCode: "99901" }, update: data, create: { studentCode: "99901", ...data } });
  console.log(`OK test student id=${s.id} code=99901 room=2/14 number=99`);
  // 99902: left UNBOUND so a real LINE account can try the first-time LIFF bind; never re-unbound by re-running this script.
  const t2 = await prisma.student.upsert({ where: { studentCode: "99902" }, update: {}, create: { studentCode: "99902", prefix: "นักเรียน", firstName: "ทดสอบสอง", lastName: "ผูกไลน์", classLevel: "2", room: "14", program: "SMTE", number: 98, house: "purple" } });
  console.log(`OK test student id=${t2.id} code=99902 room=2/14 number=98 line=${t2.lineUserId ? "bound" : "unbound"}`);
}
main().finally(() => prisma.$disconnect());
