import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { allowedRooms } from "@/lib/staff-access";
import { compareRooms } from "@/lib/event";
import { formatInstantDate } from "@/lib/time";
import StaffNav from "../StaffNav";
import ProgressBar from "../ui/ProgressBar";
import LineStatusList from "./LineStatusList";
export const dynamic = "force-dynamic";
// linkedAt is written as a real instant (`new Date()` in the bind route), so it is converted to Bangkok time — unlike the wall-clock check-in columns.
const instantTime = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });

export default async function LineStatusPage() {
  const session = await getSession("staff"); if (!session) redirect("/staff/login");
  const rooms = await allowedRooms(session);
  const scope = session.role === "admin" ? {} : { OR: rooms.map(({ classLevel, room }) => ({ classLevel, room })) };
  const students = rooms.length ? await prisma.student.findMany({ where: { house: "purple", ...scope }, select: { id: true, studentCode: true, prefix: true, firstName: true, lastName: true, classLevel: true, room: true, number: true, program: true, lineUserId: true, lineDisplayName: true, linkedAt: true } }) : [];
  students.sort((a, b) => compareRooms(a, b) || (a.number ?? 999) - (b.number ?? 999));
  const linked = students.filter(s => s.lineUserId).length;
  const pct = students.length ? Math.round(linked * 100 / students.length) : 0;
  return <main className="screen gap-3 bg-slate-50 pb-24 md:pb-6" style={{ maxWidth: "70rem", alignContent: "start" }}>
    <StaffNav active="line" />
    <section className="grid gap-3">
      <h1 className="text-xl font-bold">สถานะผูก LINE</h1>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-slate-600">นักเรียนต้องผูกบัญชี LINE ก่อนจึงจะเช็คชื่อได้ — ผูกครั้งแรกตอนเปิดลิงก์ LIFF</p>
          <p className="text-sm font-semibold text-slate-700">ผูกแล้ว <b className="text-lg tabular-nums text-emerald-700">{linked}</b> / {students.length} คน ({pct}%)</p>
        </div>
        <ProgressBar value={pct} tone={pct >= 80 ? "emerald" : "amber"} label="สัดส่วนที่ผูก LINE แล้ว" />
      </div>
      {session.role === "staff" && rooms.length === 0
        ? <p className="rounded-xl bg-amber-50 p-3 text-amber-900">ยังไม่ได้รับมอบหมายห้อง ติดต่อผู้ดูแลระบบ</p>
        : <LineStatusList students={students.map(s => ({ id: s.id, code: s.studentCode, name: `${s.prefix ?? ""}${s.firstName} ${s.lastName}`, room: `${s.classLevel}/${s.room}`, program: s.program, number: s.number, linked: Boolean(s.lineUserId), lineName: s.lineDisplayName, linkedAt: s.linkedAt ? `${formatInstantDate(s.linkedAt)} ${instantTime.format(s.linkedAt)} น.` : null }))} />}
    </section>
  </main>;
}
