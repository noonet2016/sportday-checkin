import { attendancePassed, attendancePercent, compareRooms, compareStudents, PASS_RATIO, periodLabel, periodOrder, roleLabel } from "@/lib/event";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatThaiDate } from "@/lib/time";
import StaffNav from "../StaffNav";
import { allowedRooms, roomFilter } from "@/lib/staff-access";
import { studentNameFilter } from "@/lib/student-search";
export const dynamic = "force-dynamic";
export default async function Report({ searchParams }: { searchParams: Promise<{ q?: string; room?: string; page?: string }> }) {
  const session = await getSession("staff"); if (!session) redirect("/staff/login"); const rooms = await allowedRooms(session); const { q, room: roomParam, page: pageParam } = await searchParams; const picked = roomFilter(rooms, roomParam); const scope = session.role === "admin" ? {} : { OR: rooms.map(r => ({ classLevel: r.classLevel, room: r.room })) };
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
  students.sort(compareStudents);
  days.forEach(d => d.slots.sort((a, b) => periodOrder(a.period) - periodOrder(b.period)));
  const allSlots = days.flatMap(d => d.slots);
  const attendedOf = (studentId: number) => allSlots.filter(slot => map.has(`${studentId}:${slot.id}`)).length;
  const passedCount = students.filter(s => attendancePassed(attendedOf(s.id), allSlots.length)).length;
  // "ทุกห้อง" without a name search: one room per page (Trainer, 2026-10-24); a search or a picked room shows everything matched.
  const paginate = !picked && !q && roomOptions.length > 1;
  const pageIndex = Math.min(Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1), roomOptions.length) - 1;
  const pageRoom = paginate ? roomOptions[pageIndex] : null;
  const shown = pageRoom ? students.filter(s => s.classLevel === pageRoom.classLevel && s.room === pageRoom.room) : students;
  const shownPassed = shown.filter(s => attendancePassed(attendedOf(s.id), allSlots.length)).length;
  const pageHref = (i: number) => `/staff/report?page=${i + 1}`;
  const pager = pageRoom && (
    <nav aria-label="เลือกห้อง" className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        {pageIndex > 0 ? <a className="secondary whitespace-nowrap" href={pageHref(pageIndex - 1)}>‹ ก่อนหน้า</a> : <span />}
        <b className="text-center">ห้อง {pageRoom.classLevel}/{pageRoom.room}{pageRoom.program ? ` (${pageRoom.program})` : ""} · หน้า {pageIndex + 1}/{roomOptions.length}</b>
        {pageIndex < roomOptions.length - 1 ? <a className="secondary whitespace-nowrap" href={pageHref(pageIndex + 1)}>ถัดไป ›</a> : <span />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {roomOptions.map((r, i) => (
          <a key={`${r.classLevel}|${r.room}`} href={pageHref(i)} className={`rounded-lg px-2.5 py-1 text-sm font-semibold no-underline ${i === pageIndex ? "bg-violet-700 text-white" : "border border-violet-300 bg-white text-violet-800"}`}>{r.classLevel}/{r.room}</a>
        ))}
      </div>
    </nav>
  );
  return (
    <main className="screen" style={{ maxWidth: "90rem", alignContent: "start" }}>
      <StaffNav active="report" />
      <section className="grid gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-bold">รายงานการเช็กชื่อ</h1><a className="secondary min-h-11 border border-slate-300 bg-white text-slate-800 no-underline" href={`/staff/report.csv${csvQuery ? `?${csvQuery}` : ""}`}>ดาวน์โหลด CSV</a></header>
        <p>เกณฑ์ผ่าน: เข้าร่วมอย่างน้อย {Math.round(PASS_RATIO * 100)}% ({Math.ceil(PASS_RATIO * allSlots.length)}/{allSlots.length} ครั้ง){paginate ? " · รวมทุกห้อง: " : " · "}ผ่าน <b className="text-emerald-700">{passedCount}</b> · ไม่ผ่าน <b className="text-red-700">{students.length - passedCount}</b> จาก {students.length} คน</p>
        <form className="grid gap-3 md:flex md:flex-wrap md:items-end">
          {roomOptions.length > 1 && (
            <label>ห้อง
              <select name="room" defaultValue={pickedKey} className="rounded-xl border-2 border-violet-300 bg-white p-3 text-base text-slate-900">
                <option value="">ทุกห้อง ({roomOptions.length} ห้อง)</option>
                {roomOptions.map(r => <option key={`${r.classLevel}|${r.room}`} value={`${r.classLevel}|${r.room}`}>{r.classLevel}/{r.room}{r.program ? ` (${r.program})` : ""}</option>)}
              </select>
            </label>
          )}
          <label className="md:min-w-64">ค้นหานักเรียน<input name="q" type="search" defaultValue={q ?? ""} placeholder="ชื่อ นามสกุล หรือเลขประจำตัว" /></label>
          <div className="flex flex-wrap gap-2">
            <button className="primary whitespace-nowrap">แสดงผล</button>
            {(q || pickedKey) && <a className="secondary whitespace-nowrap" href="/staff/report">ล้างตัวกรอง</a>}
          </div>
        </form>
        {pager}
        {pageRoom && <p>ห้องนี้: ผ่าน <b className="text-emerald-700">{shownPassed}</b> · ไม่ผ่าน <b className="text-red-700">{shown.length - shownPassed}</b> จาก {shown.length} คน</p>}
        <div className="grid gap-2 md:hidden">
          {shown.map(s => { const done = attendedOf(s.id); const passed = attendancePassed(done, allSlots.length); return <article key={s.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2"><div className="font-semibold">{s.studentCode} {s.prefix ?? ""}{s.firstName} {s.lastName}<div className="text-sm font-normal text-slate-600">{s.classLevel}/{s.room} · เลขที่ {s.number ?? "—"}</div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{passed ? "ผ่าน" : "ไม่ผ่าน"}</span></div>
            <div className="mt-3 grid grid-cols-10 gap-1" aria-label="การเข้าร่วมรายรอบ">{allSlots.map(slot => { const attended = map.has(`${s.id}:${slot.id}`); return <span key={slot.id} title={`${periodLabel(slot.period)}: ${attended ? "เช็กแล้ว" : "ยังไม่เช็ก"}`} aria-label={`${periodLabel(slot.period)} ${attended ? "เช็กแล้ว" : "ยังไม่เช็ก"}`} className={`h-3 rounded-sm ${attended ? "bg-emerald-500" : "bg-slate-200"}`} />; })}</div>
            <div className="mt-2 text-right text-sm font-semibold tabular-nums">{done}/{allSlots.length}</div>
          </article>; })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-800 [&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-center [&_th]:align-middle">
              <tr>
                <th rowSpan={2}>เลขที่</th>
                <th rowSpan={2}>นักเรียน</th>
                <th rowSpan={2}>ห้อง</th>
                {days.map(d => <th key={d.date.toISOString()} colSpan={d.slots.length} className="whitespace-nowrap text-center font-bold">{formatThaiDate(d.date)} {String(d.date.getUTCFullYear() + 543).slice(-2)}</th>)}
                <th rowSpan={2}>รวม</th>
                <th rowSpan={2}>ร้อยละ</th>
                <th rowSpan={2}>สถานะ</th>
              </tr>
              <tr>
                {days.flatMap(d => d.slots.map(s => <th key={s.id} className="whitespace-nowrap text-center font-medium">{periodLabel(s.period)}</th>))}
              </tr>
            </thead>
            <tbody className="[&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1.5 [&_tr:nth-child(even)]:bg-slate-50/60">
              {shown.map(s => {
                const done = attendedOf(s.id);
                const passed = attendancePassed(done, allSlots.length);
                return (
                  <tr key={s.id}>
                    <td className="text-center tabular-nums">{s.number ?? "—"}</td>
                    <td className="whitespace-nowrap">{s.studentCode} {s.prefix ?? ""}{s.firstName} {s.lastName}</td>
                    <td className="whitespace-nowrap text-center">{s.classLevel}/{s.room} {s.program}</td>
                    {days.flatMap(d => d.slots.map(slot => {
                      const r = map.get(`${s.id}:${slot.id}`);
                      return <td key={slot.id} className="text-center" title={r ? roleLabel(r.role) : "ยังไม่เช็ก"}><span aria-label={r ? roleLabel(r.role) : "ยังไม่เช็ก"} className={`inline-block h-3 w-3 rounded-sm ${r ? "bg-emerald-500" : "bg-slate-200"}`} /></td>;
                    }))}
                    <td className="text-center tabular-nums">{done}/{allSlots.length}</td>
                    <td className={`whitespace-nowrap text-center tabular-nums font-bold ${passed ? "text-emerald-700" : "text-red-700"}`}>{attendancePercent(done, allSlots.length)}%</td>
                    <td><span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-bold ${passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{passed ? "ผ่าน" : "ไม่ผ่าน"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pager}
        <h2>สรุปรายวัน{paginate ? " (ทุกห้อง)" : ""}</h2>
        {days.map(d => (
          <p key={d.id}>
            {formatThaiDate(d.date, { year: true })}: {d.slots.map(slot => `${periodLabel(slot.period)} ${records.filter(r => r.slotId === slot.id).length}/${students.length}`).join(" · ")}
          </p>
        ))}
      </section>
    </main>
  );
}
