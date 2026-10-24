import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { EVENT_DATES, EVENT_PERIODS, PASS_RATIO, attendancePassed, periodLabel, roleLabel } from "@/lib/event";
import { formatDateInput, formatThaiDateFull, nowInBangkok } from "@/lib/time";
import StudentShell from "@/app/_components/StudentShell";
import ProgressBar from "@/app/staff/ui/ProgressBar";
export const dynamic = "force-dynamic";
export default async function MePage() {
  const session = await getSession(); if (!session || session.role !== "student") redirect("/liff");
  const student = await prisma.student.findUnique({ where: { studentCode: session.id }, select: { id: true, prefix: true, firstName: true, lastName: true, classLevel: true, room: true, number: true } }); if (!student) redirect("/liff");
  const records = await prisma.checkinRecord.findMany({ where: { studentId: student.id }, select: { role: true, sport: true, slot: { select: { period: true, eventDay: { select: { date: true } } } } } });
  const bySlot = new Map(records.map((record) => [`${record.slot.eventDay.date.toISOString().slice(0, 10)}:${record.slot.period}`, record]));
  // Bangkok wall-clock "today" (honours DEV_NOW in development).
  const today = formatDateInput(nowInBangkok().dateOnly);
  const totalSlots = EVENT_DATES.length * EVENT_PERIODS.length;
  const attended = records.length; const needed = Math.ceil(PASS_RATIO * totalSlots); const passed = attendancePassed(attended, totalSlots);
  const who = { name: `${student.prefix ?? ""}${student.firstName} ${student.lastName}`, detail: `ม.${student.classLevel}/${student.room}${student.number != null ? ` · เลขที่ ${student.number}` : ""}` };
  return <StudentShell who={who}>
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">ประวัติการเช็คชื่อ</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{passed ? "ผ่านเกณฑ์แล้ว" : `ต้องเข้าร่วมอีก ${needed - attended} รอบ`}</span>
      </div>
      <div className="flex items-baseline gap-2"><span className="text-3xl font-bold tabular-nums text-slate-900">{attended}</span><span className="text-slate-600">/ {totalSlots} รอบ</span></div>
      <ProgressBar value={attended * 100 / totalSlots} tone={passed ? "emerald" : "amber"} label="เข้าร่วมแล้ว" />
      <p className="text-xs text-slate-500">เกณฑ์ผ่าน: เข้าร่วมอย่างน้อย {needed} จาก {totalSlots} รอบ ({Math.round(PASS_RATIO * 100)}%)</p>
    </section>
    <div className="grid gap-3">
      {EVENT_DATES.map((date) => <article key={date} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className={`mb-2 font-bold ${date === today ? "text-violet-800" : "text-slate-900"}`}>{formatThaiDateFull(new Date(`${date}T00:00:00Z`))}{date === today && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">วันนี้</span>}</h2>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_PERIODS.map((period) => { const record = bySlot.get(`${date}:${period}`); const state = record ? "done" : date > today ? "future" : date === today ? "pending" : "missed";
            const tone = { done: "bg-emerald-50 text-emerald-900 border-emerald-200", future: "bg-slate-50 text-slate-500 border-slate-200", pending: "bg-amber-50 text-amber-900 border-amber-200", missed: "bg-rose-50 text-rose-800 border-rose-200" }[state];
            return <div key={period} className={`grid gap-0.5 rounded-xl border px-3 py-2 ${tone}`}>
              <span className="text-xs font-semibold opacity-80">{periodLabel(period)}</span>
              <span className="text-sm font-bold">{record ? `${roleLabel(record.role)}${record.sport ? ` · ${record.sport}` : ""}` : state === "future" ? "ยังไม่ถึง" : state === "pending" ? "ยังไม่เช็ค" : "ขาด"}</span>
            </div>; })}
        </div>
      </article>)}
    </div>
    <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 font-bold text-white no-underline hover:bg-violet-800" href="/checkin"><ArrowLeft aria-hidden="true" size={18} />กลับหน้าเช็คชื่อ</a>
  </StudentShell>;
}
