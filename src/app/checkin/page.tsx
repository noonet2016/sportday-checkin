import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { nowInBangkok, formatWallClockTime, formatThaiDateFull } from "@/lib/time";
import { periodLabel } from "@/lib/event";
import { slotWindowNow } from "@/lib/slots";
import CheckinClient from "./CheckinClient";
import StudentShell from "@/app/_components/StudentShell";
import { distanceFromCentre, getGeofence } from "@/lib/geofence";
export const dynamic = "force-dynamic";
export default async function CheckinPage() {
  const session = await getSession(); if (!session || session.role !== "student") redirect("/liff");
  const student = await prisma.student.findUnique({ where: { studentCode: session.id }, select: { id: true, prefix: true, firstName: true, lastName: true, classLevel: true, room: true, number: true } }); if (!student) redirect("/liff");
  const now = nowInBangkok(); const { window, slotId, daySlots } = await slotWindowNow(now); const fence = await getGeofence();
  let existing: { role: string; checkedInAt: string; distanceM: number | null } | undefined;
  if (slotId) { const record = await prisma.checkinRecord.findUnique({ where: { studentId_slotId: { studentId: student.id, slotId } }, select: { role: true, checkedInAt: true, source: true, lat: true, lng: true } }); if (record) existing = { role: record.role, checkedInAt: formatWallClockTime(record.checkedInAt, true), distanceM: fence && record.source === "self" ? distanceFromCentre(fence, record.lat, record.lng) : null }; }
  const who = { name: `${student.prefix ?? ""}${student.firstName} ${student.lastName}`, detail: `ม.${student.classLevel}/${student.room}${student.number != null ? ` · เลขที่ ${student.number}` : ""}` };
  const slotLabel = window.state === "not-event-day" ? null : `${window.period === "afternoon" ? "รอบบ่าย" : "รอบเช้า"} ${formatWallClockTime(window.opensAt)}–${formatWallClockTime(window.closesAt)}`;
  return <StudentShell who={who}>
    <p className="px-1 text-sm font-semibold text-slate-600">{formatThaiDateFull(now.dateOnly)}</p>
    <CheckinClient state={window.state} slotLabel={slotLabel} todaySlots={daySlots.map(s => `รอบ${periodLabel(s.period)} ${formatWallClockTime(s.opensAt)}–${formatWallClockTime(s.closesAt)}`)} remainingMs={window.state === "open" ? window.closesAt.getTime() - now.wallClock.getTime() : undefined} existing={existing} radiusM={fence?.radius ?? null} />
    <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-violet-300 bg-white px-4 font-semibold text-violet-800 no-underline hover:bg-violet-50" href="/me"><History aria-hidden="true" size={18} />ประวัติการเช็คชื่อของฉัน</a>
  </StudentShell>;
}
