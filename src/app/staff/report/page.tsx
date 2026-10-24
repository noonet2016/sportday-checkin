import { attendancePassed, attendancePercent, compareRooms, PASS_RATIO, periodLabel, periodOrder, roleLabel } from "@/lib/event";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatDateInput } from "@/lib/time";
import StaffNav from "../StaffNav";
import { allowedRooms, roomFilter } from "@/lib/staff-access";
import { studentNameFilter } from "@/lib/student-search";
export const dynamic = "force-dynamic";
export default async function Report({ searchParams }: { searchParams: Promise<{ q?: string; room?: string }> }) {
  const session = await getSession("staff"); if (!session) redirect("/staff/login"); const rooms = await allowedRooms(session); const { q, room: roomParam } = await searchParams; const picked = roomFilter(rooms, roomParam); const scope = session.role === "admin" ? {} : { OR: rooms.map(r => ({ classLevel: r.classLevel, room: r.room })) };
  const [students, days] = await Promise.all([
    prisma.student.findMany({ where: { house: "purple", ...scope, ...(picked ?? {}), ...studentNameFilter(q) }, select: { id: true, studentCode: true, prefix: true, firstName: true, lastName: true, classLevel: true, room: true, number: true, program: true }, orderBy: [{ classLevel: "asc" }, { room: "asc" }, { number: "asc" }] }),
    prisma.eventDay.findMany({ include: { slots: { select: { id: true, period: true }, orderBy: { period: "asc" } } }, orderBy: { date: "asc" } })
  ]);
  const roomOptions = (await prisma.student.findMany({ where: { house: "purple", ...scope }, distinct: ["classLevel", "room"], select: { classLevel: true, room: true, program: true } })).sort(compareRooms);
  const pickedKey = picked ? `${picked.classLevel}|${picked.room}` : "";
  const csvQuery = new URLSearchParams({ ...(q ? { q } : {}), ...(pickedKey ? { room: pickedKey } : {}) }).toString();
  const ids = students.map(s => s.id);
  const records = ids.length ? await prisma.checkinRecord.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, slotId: true, role: true } }) : [];
  const map = new Map(records.map(r => [`${r.studentId}:${r.slotId}`, r]));
  students.sort(compareRooms);
  days.forEach(d => d.slots.sort((a, b) => periodOrder(a.period) - periodOrder(b.period)));
  const allSlots = days.flatMap(d => d.slots);
  const attendedOf = (studentId: number) => allSlots.filter(slot => map.has(`${studentId}:${slot.id}`)).length;
  const passedCount = students.filter(s => attendancePassed(attendedOf(s.id), allSlots.length)).length;
  return (
    <main className="screen" style={{ maxWidth: "90rem", alignContent: "start" }}>
      <StaffNav active="report" />
      <section className="card">
        <h1>รายงานการเช็กชื่อ</h1>
        <p>เกณฑ์ผ่าน: เข้าร่วมอย่างน้อย {Math.round(PASS_RATIO * 100)}% ({Math.ceil(PASS_RATIO * allSlots.length)}/{allSlots.length} ครั้ง) · ผ่าน <b className="text-emerald-700">{passedCount}</b> · ไม่ผ่าน <b className="text-red-700">{students.length - passedCount}</b> จาก {students.length} คน</p>
        <form>
          {roomOptions.length > 1 && (
            <label>ห้อง
              <select name="room" defaultValue={pickedKey} className="rounded-xl border-2 border-violet-300 bg-white p-3 text-base text-slate-900">
                <option value="">ทุกห้อง ({roomOptions.length} ห้อง)</option>
                {roomOptions.map(r => <option key={`${r.classLevel}|${r.room}`} value={`${r.classLevel}|${r.room}`}>{r.classLevel}/{r.room}{r.program ? ` (${r.program})` : ""}</option>)}
              </select>
            </label>
          )}
          <label>ค้นหานักเรียน<input name="q" type="search" defaultValue={q ?? ""} placeholder="ชื่อ นามสกุล หรือเลขประจำตัว" /></label>
          <div className="flex flex-wrap gap-2">
            <button className="primary whitespace-nowrap">แสดงผล</button>
            {(q || pickedKey) && <a className="secondary whitespace-nowrap" href="/staff/report">ล้างตัวกรอง</a>}
            <a className="secondary whitespace-nowrap" href={`/staff/report.csv${csvQuery ? `?${csvQuery}` : ""}`}>ดาวน์โหลด CSV</a>
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>นักเรียน</th>
                <th>ห้อง</th>
                {days.flatMap(d => d.slots.map(s => <th key={s.id}>{formatDateInput(d.date)} {periodLabel(s.period)}</th>))}
                <th>รวม</th>
                <th>ร้อยละ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const done = attendedOf(s.id);
                const passed = attendancePassed(done, allSlots.length);
                return (
                  <tr key={s.id}>
                    <td>{s.number ?? "—"}</td>
                    <td className="whitespace-nowrap">{s.studentCode} {s.prefix ?? ""}{s.firstName} {s.lastName}</td>
                    <td>{s.classLevel}/{s.room} {s.program}</td>
                    {days.flatMap(d => d.slots.map(slot => {
                      const r = map.get(`${s.id}:${slot.id}`);
                      return <td key={slot.id}>{r ? roleLabel(r.role) : "—"}</td>;
                    }))}
                    <td>{done}/{allSlots.length}</td>
                    <td className={`whitespace-nowrap font-bold ${passed ? "text-emerald-700" : "text-red-700"}`}>{attendancePercent(done, allSlots.length)}%</td>
                    <td><span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-bold text-white ${passed ? "bg-emerald-600" : "bg-red-600"}`}>{passed ? "✅ ผ่าน" : "❌ ไม่ผ่าน"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <h2>สรุปรายวัน</h2>
        {days.map(d => (
          <p key={d.id}>
            {formatDateInput(d.date)}: {d.slots.map(slot => `${periodLabel(slot.period)} ${records.filter(r => r.slotId === slot.id).length}/${students.length}`).join(" · ")}
          </p>
        ))}
      </section>
    </main>
  );
}
