import { attendancePassed, attendancePercent, compareRooms, compareStudents, PASS_RATIO, periodLabel, periodOrder, roleLabel } from "@/lib/event";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatThaiDateFull } from "@/lib/time";
import StaffNav from "../StaffNav";
import ProgressBar from "../ui/ProgressBar";
import { Download } from "lucide-react";
import ReportFilters from "./ReportFilters";
import { allowedRooms, roomFilter } from "@/lib/staff-access";
import { studentNameFilter } from "@/lib/student-search";
export const dynamic = "force-dynamic";
export default async function Report({ searchParams }: { searchParams: Promise<{ q?: string; room?: string; page?: string; status?: string }> }) {
  const session = await getSession("staff"); if (!session) redirect("/staff/login"); const rooms = await allowedRooms(session); const { q, room: roomParam, page: pageParam, status: statusParam } = await searchParams; const status = statusParam === "pass" || statusParam === "fail" ? statusParam : null; const picked = roomFilter(rooms, roomParam); const scope = session.role === "admin" ? {} : { OR: rooms.map(r => ({ classLevel: r.classLevel, room: r.room })) };
  const [students, days] = await Promise.all([
    prisma.student.findMany({ where: { house: "purple", ...scope, ...(picked ?? {}), ...studentNameFilter(q) }, select: { id: true, studentCode: true, prefix: true, firstName: true, lastName: true, classLevel: true, room: true, number: true, program: true }, orderBy: [{ classLevel: "asc" }, { room: "asc" }, { number: "asc" }] }),
    prisma.eventDay.findMany({ include: { slots: { select: { id: true, period: true }, orderBy: { period: "asc" } } }, orderBy: { date: "asc" } })
  ]);
  const roomOptions = (await prisma.student.findMany({ where: { house: "purple", ...scope }, distinct: ["classLevel", "room"], select: { classLevel: true, room: true, program: true } })).sort(compareRooms);
  const pickedKey = picked ? `${picked.classLevel}|${picked.room}` : "";
  const csvQuery = new URLSearchParams({ ...(q ? { q } : {}), ...(pickedKey ? { room: pickedKey } : {}), ...(status ? { status } : {}) }).toString();
  const ids = students.map(s => s.id);
  const records = ids.length ? await prisma.checkinRecord.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, slotId: true, role: true } }) : [];
  const map = new Map(records.map(r => [`${r.studentId}:${r.slotId}`, r]));
  students.sort(compareStudents);
  days.forEach(d => d.slots.sort((a, b) => periodOrder(a.period) - periodOrder(b.period)));
  const allSlots = days.flatMap(d => d.slots);
  const attendedOf = (studentId: number) => allSlots.filter(slot => map.has(`${studentId}:${slot.id}`)).length;
  const passedCount = students.filter(s => attendancePassed(attendedOf(s.id), allSlots.length)).length;
  // "ทุกห้อง" without a name search: one room per page (Trainer, 2026-10-24); a search or a picked room shows everything matched.
  const paginate = !picked && !q && !status && roomOptions.length > 1;
  const pageIndex = Math.min(Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1), roomOptions.length) - 1;
  const pageRoom = paginate ? roomOptions[pageIndex] : null;
  const shown = (pageRoom ? students.filter(s => s.classLevel === pageRoom.classLevel && s.room === pageRoom.room) : students)
    .filter(s => !status || attendancePassed(attendedOf(s.id), allSlots.length) === (status === "pass"));
  // Summary tiles filter the list by pass/fail; they keep the current room + search.
  const statusHref = (next: "pass" | "fail" | null) => { const qs = new URLSearchParams({ ...(pickedKey ? { room: pickedKey } : {}), ...(q ? { q } : {}), ...(next ? { status: next } : {}) }).toString(); return `/staff/report${qs ? `?${qs}` : ""}`; };
  const shownPassed = shown.filter(s => attendancePassed(attendedOf(s.id), allSlots.length)).length;
  const pageHref = (i: number) => `/staff/report?page=${i + 1}`;
  const pager = pageRoom && (
    <nav aria-label="เลือกห้อง" className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        {pageIndex > 0 ? <a className="inline-flex h-11 items-center whitespace-nowrap rounded-xl border border-violet-300 bg-white px-4 font-semibold text-violet-800 no-underline hover:bg-violet-50" href={pageHref(pageIndex - 1)}>‹ ก่อนหน้า</a> : <span />}
        <b className="text-center">ห้อง {pageRoom.classLevel}/{pageRoom.room}{pageRoom.program ? ` (${pageRoom.program})` : ""} · หน้า {pageIndex + 1}/{roomOptions.length}</b>
        {pageIndex < roomOptions.length - 1 ? <a className="inline-flex h-11 items-center whitespace-nowrap rounded-xl border border-violet-300 bg-white px-4 font-semibold text-violet-800 no-underline hover:bg-violet-50" href={pageHref(pageIndex + 1)}>ถัดไป ›</a> : <span />}
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
        <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-bold">รายงานการเช็กชื่อ</h1><a className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-700 px-4 font-semibold text-white no-underline hover:bg-emerald-800" href={`/staff/report.csv${csvQuery ? `?${csvQuery}` : ""}`}><Download aria-hidden="true" size={18} />ดาวน์โหลด CSV</a></header>
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">{paginate ? "สรุปผลรวมทุกห้อง" : "สรุปผล"}</h2>
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">เกณฑ์ผ่าน: เข้าร่วมอย่างน้อย {Math.round(PASS_RATIO * 100)}% ({Math.ceil(PASS_RATIO * allSlots.length)}/{allSlots.length} ครั้ง)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a href={statusHref(null)} aria-current={!status ? "true" : undefined} className={`rounded-xl bg-slate-100 p-3 text-center no-underline transition-shadow hover:ring-2 hover:ring-slate-300 motion-reduce:transition-none ${!status ? "ring-2 ring-slate-500" : ""}`}><div className="text-2xl font-bold tabular-nums text-slate-800">{students.length}</div><div className="text-sm font-medium text-slate-700">ทั้งหมด (คน)</div></a>
            <a href={statusHref(status === "pass" ? null : "pass")} aria-current={status === "pass" ? "true" : undefined} className={`rounded-xl bg-emerald-50 p-3 text-center no-underline transition-shadow hover:ring-2 hover:ring-emerald-300 motion-reduce:transition-none ${status === "pass" ? "ring-2 ring-emerald-600" : ""}`}><div className="text-2xl font-bold tabular-nums text-emerald-700">{passedCount}</div><div className="text-sm font-medium text-emerald-900">ผ่าน</div></a>
            <a href={statusHref(status === "fail" ? null : "fail")} aria-current={status === "fail" ? "true" : undefined} className={`rounded-xl bg-rose-50 p-3 text-center no-underline transition-shadow hover:ring-2 hover:ring-rose-300 motion-reduce:transition-none ${status === "fail" ? "ring-2 ring-rose-600" : ""}`}><div className="text-2xl font-bold tabular-nums text-rose-700">{students.length - passedCount}</div><div className="text-sm font-medium text-rose-900">ไม่ผ่าน</div></a>
          </div>
          <div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={students.length ? passedCount * 100 / students.length : 0} tone="emerald" label="สัดส่วนผ่าน" /></div><span className="w-24 text-right text-xs font-semibold tabular-nums text-slate-600">ผ่าน {students.length ? Math.round(passedCount * 100 / students.length) : 0}%</span></div>
        </div>
        <ReportFilters rooms={roomOptions.map(r => ({ key: `${r.classLevel}|${r.room}`, label: `${r.classLevel}/${r.room}${r.program ? ` (${r.program})` : ""}` }))} roomCount={roomOptions.length} pickedKey={pickedKey} q={q ?? ""} status={status ?? ""} />
        {pager}
        {pageRoom && <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold text-slate-700">ห้อง {pageRoom.classLevel}/{pageRoom.room}</span><span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">ผ่าน {shownPassed}</span><span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-semibold text-rose-800">ไม่ผ่าน {shown.length - shownPassed}</span><span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">ทั้งหมด {shown.length} คน</span></div>}
        <div className="grid gap-2 md:hidden">
          {shown.map(s => { const done = attendedOf(s.id); const passed = attendancePassed(done, allSlots.length); return <article key={s.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2"><div className="font-semibold">{s.studentCode} {s.prefix ?? ""}{s.firstName} {s.lastName}<div className="text-sm font-normal text-slate-600">{s.classLevel}/{s.room} · เลขที่ {s.number ?? "—"}</div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{passed ? "ผ่าน" : "ไม่ผ่าน"}</span></div>
            <div className="mt-3 grid grid-cols-10 gap-1" aria-label="การเข้าร่วมรายรอบ">{allSlots.map(slot => { const attended = map.has(`${s.id}:${slot.id}`); return <span key={slot.id} title={`${periodLabel(slot.period)}: ${attended ? "เช็กแล้ว" : "ยังไม่เช็ก"}`} aria-label={`${periodLabel(slot.period)} ${attended ? "เช็กแล้ว" : "ยังไม่เช็ก"}`} className={`h-3 rounded-sm ${attended ? "bg-emerald-500" : "bg-slate-200"}`} />; })}</div>
            <div className="mt-2 text-right text-sm font-semibold tabular-nums">{done}/{allSlots.length}</div>
          </article>; })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-800 [&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-center [&_th]:align-middle [&_th]:whitespace-nowrap">
              <tr>
                <th rowSpan={2}>เลขที่</th>
                <th rowSpan={2}>นักเรียน</th>
                <th rowSpan={2}>ห้อง</th>
                {days.map(d => <th key={d.date.toISOString()} colSpan={d.slots.length} className="!whitespace-normal text-center font-bold leading-snug">{formatThaiDateFull(d.date)}</th>)}
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
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">สรุปรายวัน</h2>
            {paginate && <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">ทุกห้อง</span>}
            <span className="text-xs text-slate-500">จำนวนนักเรียนที่เช็กชื่อแต่ละรอบ จากทั้งหมด {students.length} คน</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {days.map(d => (
              <article key={d.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <h3 className="border-b border-slate-200 pb-2 text-center font-bold text-slate-900">{formatThaiDateFull(d.date)}</h3>
                <div className="mt-2 grid gap-3">
                  {d.slots.map(slot => {
                    const n = records.filter(r => r.slotId === slot.id).length;
                    const pct = students.length ? Math.round(n * 100 / students.length) : 0;
                    return (
                      <div key={slot.id} className="grid gap-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-700">{periodLabel(slot.period)}</span>
                          <span className="tabular-nums text-sm text-slate-600"><b className="text-base text-slate-900">{n}</b>/{students.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1"><ProgressBar value={pct} tone={pct >= PASS_RATIO * 100 ? "emerald" : "amber"} label={`${periodLabel(slot.period)} ${pct}%`} /></div>
                          <span className={`w-11 text-right text-xs font-bold tabular-nums ${n === 0 ? "text-slate-400" : pct >= PASS_RATIO * 100 ? "text-emerald-700" : "text-amber-700"}`}>{n === 0 ? "—" : `${pct}%`}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
