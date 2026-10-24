import { periodLabel } from "@/lib/event";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { EVENT_DATES, EVENT_PERIODS } from "@/lib/event";
export const dynamic = "force-dynamic";
export default async function MePage() {
  const session = await getSession(); if (!session || session.role !== "student") redirect("/liff"); const student = await prisma.student.findUnique({ where: { studentCode: session.id }, select: { id: true } }); if (!student) redirect("/liff");
  const records = await prisma.checkinRecord.findMany({ where: { studentId: student.id }, select: { role: true, slot: { select: { period: true, eventDay: { select: { date: true } } } } } }); const bySlot = new Map(records.map((record) => [`${record.slot.eventDay.date.toISOString().slice(0, 10)}:${record.slot.period}`, record])); const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return <main className="screen"><section className="card"><h1>My Sport Day week</h1><div className="slot-grid">{EVENT_DATES.flatMap((date) => EVENT_PERIODS.map((period) => { const record = bySlot.get(`${date}:${period}`); return <div className="slot" key={`${date}:${period}`}><b>{date.slice(8)} Oct · {periodLabel(period)}</b><span>{record ? `✅ ${record.role}` : date > today ? "—" : "❌"}</span></div>; }))}</div><a className="link-button" href="/checkin">Back to check-in</a></section></main>;
}
