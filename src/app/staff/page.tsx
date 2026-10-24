import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { nowInBangkok, parseDateInput, formatDateInput, formatWallClockTime } from "@/lib/time";
import StaffNav from "./StaffNav";
import Refresh from "./Refresh";
import { EVENT_DATES, resolveDefaultSlot, compareRooms } from "@/lib/event";
import { allowedRooms } from "@/lib/staff-access";

export const dynamic = "force-dynamic";
export default async function StaffPage({ searchParams }: { searchParams: Promise<{ day?: string; period?: string }> }) {
  const session = await getSession("staff"); if (!session) redirect("/staff/login");
  const rooms = await allowedRooms(session);
  const params = await searchParams; const now = nowInBangkok();
  const defaultSlot = resolveDefaultSlot(now.wallClock, EVENT_DATES);
  const day = parseDateInput(params.day ?? "") ?? parseDateInput(defaultSlot.date)!;
  const period = params.period === "morning" || params.period === "afternoon" ? params.period : defaultSlot.period;
  const event = await prisma.eventDay.findUnique({ where: { date: day }, select: { id: true } });
  const slot = event ? await prisma.checkinSlot.findUnique({ where: { eventDayId_period: { eventDayId: event.id, period } }, select: { id: true, opensAt: true, closesAt: true } }) : null;
  const scope = session.role === "admin" ? {} : { OR: rooms.map(({ classLevel, room }) => ({ classLevel, room })) };
  const checked = slot ? await prisma.checkinRecord.findMany({ where: { slotId: slot.id, student: { house: "purple", ...scope } }, include: { student: { select: { id: true, classLevel: true, room: true, program: true } } } }) : []; const groups = rooms.length ? await prisma.student.groupBy({ by: ["classLevel", "room", "program"], where: { house: "purple", ...scope }, _count: { _all: true }, orderBy: [{ classLevel: "asc" }, { room: "asc" }] }) : [];
  const checkedByRoom = new Map<string, number>(); for (const r of checked) { const s = r.student; const k = `${s.classLevel}|${s.room}|${s.program ?? ""}`; checkedByRoom.set(k, (checkedByRoom.get(k) ?? 0) + 1); }
  const total = await prisma.student.count({ where: { house: "purple", ...scope } }); const compete = checked.filter(r => r.role === "compete").length; const cheer = checked.filter(r => r.role === "cheer").length; const flagged = checked.filter(r => r.isSuspicious).length;
  return <main className="screen" style={{ maxWidth: "70rem", alignContent: "start" }}><Refresh/><StaffNav active="home"/><section className="card"><h1>{session.role === "admin" ? "เจ้าหน้าที่ · เช็กชื่อกีฬาสี" : `ห้องที่ดูแล (${rooms.length} ห้อง, ${total} คน)`}</h1><form className="flex flex-wrap items-end gap-3"><label>วันที่<input name="day" type="date" defaultValue={formatDateInput(day)} /></label><label>ช่วงเวลา<select name="period" defaultValue={period}><option value="morning">เช้า</option><option value="afternoon">บ่าย</option></select></label><button className="primary">ดูข้อมูล</button></form><p>อัปเดตอัตโนมัติทุก 30 วินาที</p>{session.role === "staff" && rooms.length === 0 ? <p className="notice">ยังไม่ได้รับมอบหมายห้อง ติดต่อผู้ดูแลระบบ</p> : <><section className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Stat label="เช็กแล้ว" n={checked.length}/><Stat label="ยังไม่เช็ก" n={Math.max(0,total-checked.length)}/><Stat label="ทั้งหมด" n={total}/><Stat label="แข่งขัน / เชียร์" n={`${compete} / ${cheer}`}/><Stat label="ติดธง ⚠️" n={flagged}/></section>{slot ? <><p>เวลา {formatWallClockTime(slot.opensAt)}–{formatWallClockTime(slot.closesAt)}</p><h2>แยกตามห้อง</h2><p className="text-sm text-slate-600">กดปุ่ม <b>👥 รายชื่อ / เช็คแทน</b> เพื่อดูรายชื่อนักเรียนในห้อง และบันทึกแทนคนที่ยังไม่ได้เช็ค</p><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>ระดับ/ห้อง</th><th>โครงการ</th><th>เช็กแล้ว / ทั้งหมด</th><th>%</th><th></th></tr></thead><tbody>{[...groups].sort(compareRooms).map(g => { const key = `${g.classLevel}|${g.room}|${g.program ?? ""}`; const n = checkedByRoom.get(key) ?? 0; const roomHref = `/staff/room/${encodeURIComponent(g.classLevel)}/${encodeURIComponent(g.room)}?day=${formatDateInput(day)}&period=${period}`; const missing = g._count._all - n; return <tr key={key}><td><Link href={roomHref} className="font-bold text-violet-700 underline underline-offset-2">{g.classLevel}/{g.room}</Link></td><td>{g.program ?? "ทั่วไป"}</td><td>{n}/{g._count._all}</td><td>{Math.round(n * 100 / g._count._all)}%</td><td><Link href={roomHref} className="inline-block whitespace-nowrap rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white no-underline hover:bg-violet-800">👥 รายชื่อ / เช็คแทน{missing > 0 ? ` (ยังไม่เช็ค ${missing})` : ""}</Link></td></tr>; })}</tbody></table></div></> : <p className="notice">ไม่พบรอบเช็คชื่อสำหรับวันที่เลือก</p>}</>}</section></main>;
}
function Stat({ label, n }: { label: string; n: number | string }) { return <div className="slot"><span>{label}</span><strong>{n}</strong></div>; }
