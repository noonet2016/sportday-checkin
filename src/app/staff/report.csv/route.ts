import { attendancePassed, attendancePercent, compareRooms, periodLabel, periodOrder, roleCsvLabel } from "@/lib/event";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatDateInput } from "@/lib/time";
import { allowedRooms } from "@/lib/staff-access";
import { studentNameFilter } from "@/lib/student-search";

export async function GET(request: NextRequest) {
  const session = await getSession("staff");
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const rooms = await allowedRooms(session);
  const search = request.nextUrl.searchParams.get("q") ?? undefined;
  const scope = session.role === "admin" ? {} : { OR: rooms.map(r => ({ classLevel: r.classLevel, room: r.room })) };

  const students = await prisma.student.findMany({
    where: { house: "purple", ...scope, ...studentNameFilter(search) },
    select: { studentCode: true, prefix: true, firstName: true, lastName: true, classLevel: true, room: true, number: true, program: true, id: true },
    orderBy: [{ classLevel: "asc" }, { room: "asc" }, { number: "asc" }]
  });
  const days = await prisma.eventDay.findMany({
    include: { slots: { select: { id: true, period: true }, orderBy: { period: "asc" } } },
    orderBy: { date: "asc" }
  });
  const records = students.length ? await prisma.checkinRecord.findMany({
    where: { studentId: { in: students.map(s => s.id) } },
    select: { studentId: true, slotId: true, role: true }
  }) : [];
  const map = new Map(records.map(r => [`${r.studentId}:${r.slotId}`, r]));
  students.sort(compareRooms);
  days.forEach(d => d.slots.sort((a, b) => periodOrder(a.period) - periodOrder(b.period)));

  const q = (x: unknown) => `"${String(x ?? "").replaceAll('"', '""')}"`;
  const rows: string[][] = [
    ["รหัส", "ชื่อ", "ระดับ", "ห้อง", "เลขที่", "โครงการ", ...days.flatMap(d => d.slots.map(s => `${formatDateInput(d.date)} ${periodLabel(s.period)}`)), "รวม", "ร้อยละ", "สถานะ"]
  ];
  for (const s of students) {
    const slots = days.flatMap(d => d.slots);
    const vals = slots.map(slot => {
      const r = map.get(`${s.id}:${slot.id}`);
      return r ? roleCsvLabel(r.role) : "—";
    });
    const count = slots.filter(slot => map.has(`${s.id}:${slot.id}`)).length;
    rows.push([
      s.studentCode,
      `${s.prefix ?? ""}${s.firstName} ${s.lastName}`,
      s.classLevel,
      s.room,
      s.number == null ? "" : String(s.number),
      s.program ?? "",
      ...vals,
      `${count}/${slots.length}`,
      `${attendancePercent(count, slots.length)}%`,
      attendancePassed(count, slots.length) ? "ผ่าน" : "ไม่ผ่าน"
    ]);
  }
  const csv = "\uFEFF" + rows.map(row => row.map(q).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename*=UTF-8''sportday-report.csv",
      "Cache-Control": "no-store"
    }
  });
}
