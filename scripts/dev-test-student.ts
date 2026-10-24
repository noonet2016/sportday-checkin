// Creates/updates the dev test student TEST001 (room 2/14, bound to a fake LINE id) on the LOCAL dev DB only.
// Run: npx tsx --env-file=.env scripts/dev-test-student.ts   then open http://localhost:3000/api/dev/student-login
import { prisma } from "../src/lib/prisma";

async function main() {
  if (!/_dev\b|_dev$|sportday_dev/.test(process.env.DATABASE_URL ?? "")) throw new Error("Refusing: DATABASE_URL is not the local sportday_dev database");
  const data = { prefix: "นักเรียน", firstName: "ทดสอบ", lastName: "ระบบ", classLevel: "2", room: "14", program: "SMTE", number: 99, house: "purple", lineUserId: "dev-test-student", lineDisplayName: "Test Student (dev)", linkedAt: new Date() };
  const s = await prisma.student.upsert({ where: { studentCode: "TEST001" }, update: data, create: { studentCode: "TEST001", ...data } });
  console.log(`OK test student id=${s.id} code=TEST001 room=2/14 number=99`);
}
main().finally(() => prisma.$disconnect());
