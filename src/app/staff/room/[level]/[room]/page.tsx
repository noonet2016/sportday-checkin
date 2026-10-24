import { periodLabel, periodOrder, roleLabel } from "@/lib/event";
import Link from "next/link";
import StaffNav from "../../../StaffNav";
import SlotBar from "../../../ui/SlotBar";
import RecordEditor from "../../../RecordEditor";
import SheetTrigger from "../../../ui/SheetTrigger";
import { ExternalLink, MapPin, PencilLine, TriangleAlert } from "lucide-react";
import RoomFilters from "../../RoomFilters";
import RoleSportFields from "../../../RoleSportFields";
import ChoiceWithOther from "@/app/_components/ChoiceWithOther";
import { ONBEHALF_REASON_OPTIONS } from "@/lib/event";
import { distanceFromCentre, getGeofence } from "@/lib/geofence";
import { formatDistance } from "@/lib/geo";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseDateInput, formatWallClockTime, formatDateInput, formatThaiDate, nowInBangkok } from "@/lib/time";
import { manualRecord, clearFlag } from "@/app/staff/actions";
import { allowedRooms, roomAllowed } from "@/lib/staff-access";

export const dynamic = "force-dynamic";

export default async function Room({
  params,
  searchParams,
}: {
  params: Promise<{ level: string; room: string }>;
  searchParams: Promise<{ day?: string; period?: string }>;
}) {
  const session = await getSession("staff");
  if (!session) redirect("/staff/login");
  const [{ level: rawLevel, room: rawRoom }, { day, period }] = await Promise.all([params, searchParams]);
  const level = decodeURIComponent(rawLevel), room = decodeURIComponent(rawRoom);
  const rooms = await allowedRooms(session);
  if (!roomAllowed(rooms, level, room)) notFound();

  const date = parseDateInput(day ?? "");
  const selectedDate = date ?? new Date(0);
  const slot = date ? await prisma.checkinSlot.findFirst({
    where: { eventDay: { date: selectedDate }, period: period === "afternoon" ? "afternoon" : "morning" },
  }) : null;

  const students = await prisma.student.findMany({
    where: { house: "purple", classLevel: level, room },
    select: { id: true, studentCode: true, prefix: true, firstName: true, lastName: true, classLevel: true, room: true, program: true, number: true },
    orderBy: [{ number: "asc" }, { studentCode: "asc" }],
  });

  const records = slot ? await prisma.checkinRecord.findMany({
    where: { slotId: slot.id, studentId: { in: students.map(s => s.id) } },
    include: { staff: { select: { displayName: true } } },
  }) : [];

  const map = new Map(records.map(r => [r.studentId, r]));
  const reviewerIds = [...new Set(records.map(r => r.reviewRequestedBy).filter((id): id is number => id !== null))];
  const reviewers = new Map((reviewerIds.length ? await prisma.staff.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, displayName: true } }) : []).map(x => [x.id, x.displayName]));
  const fence = await getGeofence();
  // Spoof-detection reasons are for the admin to judge; teachers do not see them (Trainer, 2026-10-24).
  const isAdmin = session.role === "admin";
  const distanceText = (r: { source: string; lat: number; lng: number }) => {
    if (!fence || r.source !== "self") return null;
    const d = distanceFromCentre(fence, r.lat, r.lng);
    return `${d > fence.radius ? "⚠️ นอกรัศมี" : "ในรัศมี"} ~${formatDistance(d)} (กำหนด ${formatDistance(fence.radius)})`;
  };
  const distanceInfo = (r: { source: string; lat: number; lng: number }) => {
    if (!fence || r.source !== "self") return null;
    const d = distanceFromCentre(fence, r.lat, r.lng);
    return { inside: d <= fence.radius, text: `${d <= fence.radius ? "ในรัศมี" : "นอกรัศมี"} ~${formatDistance(d)} (กำหนด ${formatDistance(fence.radius)})` };
  };
  // Strict เลขที่ order (Trainer, 2026-10-24) — the query already orders by number.
  const missingCount = students.filter(s => !map.has(s.id)).length;
  // On-behalf targets only the slot being viewed; the status shown on this page is for that slot.
  // Slot picker: every event slot, so teachers can review in the evening and back-date; future slots are view-only.
  const nowWall = nowInBangkok().wallClock;
  const allSlots = (await prisma.checkinSlot.findMany({ include: { eventDay: { select: { date: true } } } }))
    .sort((a, b) => a.eventDay.date.getTime() - b.eventDay.date.getTime() || periodOrder(a.period) - periodOrder(b.period));
  const slotDays = [...new Map(allSlots.map(x => [formatDateInput(x.eventDay.date), allSlots.filter(y => y.eventDayId === x.eventDayId)])).entries()];
  const slotStarted = (x: { opensAt: Date }) => x.opensAt.getTime() <= nowWall.getTime();
  const viewedStarted = slot ? slotStarted(slot) : false;
  const viewedIsPast = slot ? slot.closesAt.getTime() <= nowWall.getTime() : false;
  const roomBase = `/staff/room/${encodeURIComponent(level)}/${encodeURIComponent(room)}`;
  const pick = await prisma.checkinSlot.findMany({
    where: { id: slot && viewedStarted ? slot.id : -1 },
    select: { id: true, period: true },
  });

  return (
    <main className="screen pb-24 md:pb-6" style={{ maxWidth: "76rem", alignContent: "start" }}>
      <StaffNav active="home" />
      <SlotBar day={date ? formatDateInput(date) : ""} period={period === "afternoon" ? "afternoon" : "morning"} updatedAt={formatWallClockTime(nowWall)} hrefBase={roomBase}/>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-950">{level}/{room} · {students[0]?.program ?? "ทั่วไป"}</h1>
          <Link className="min-h-11 inline-flex items-center font-semibold text-violet-800" href={`/staff${day ? `?day=${encodeURIComponent(day)}&period=${period === "afternoon" ? "afternoon" : "morning"}` : ""}`}>
            ← ภาพรวม
          </Link>
        </div>
        <div className="my-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-emerald-50 p-2"><b className="block text-lg text-emerald-800">{records.length}</b><span className="text-xs text-slate-700">เช็กแล้ว</span></div><div className="rounded-xl bg-amber-50 p-2"><b className="block text-lg text-amber-900">{missingCount}</b><span className="text-xs text-slate-700">ยังไม่เช็ก</span></div><div className="rounded-xl bg-rose-50 p-2"><b className="block text-lg text-rose-800">{records.filter(r => r.isSuspicious).length}</b><span className="text-xs text-slate-700">ติดธง</span></div></div>
        {slot && !viewedStarted && <p className="rounded-xl bg-slate-100 p-3 font-semibold text-slate-800">🔒 ยังไม่ถึงเวลารอบนี้ — ดูได้อย่างเดียว</p>}
        {slot && viewedIsPast && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">🕘 รอบนี้ผ่านไปแล้ว — บันทึกแทนที่นี่จะเป็นการ<b>บันทึกย้อนหลัง</b></p>}
        {slot && <p className="text-sm text-slate-700">{formatThaiDate(slot.opensAt, { year: true })} รอบ{periodLabel(slot.period)} · ยังไม่เช็ค <b className="text-red-700">{missingCount}</b> คน{missingCount > 0 ? " — กดบันทึกแทนได้ที่แถวของนักเรียนคนนั้น" : ""}</p>}

        <RoomFilters counts={{ missing: missingCount, checked: records.length - records.filter(r => r.isSuspicious).length, flagged: records.filter(r => r.isSuspicious).length, all: students.length }} defaultFilter={slot && viewedStarted && !viewedIsPast ? "missing" : "all"}/>
        <div className="divide-y divide-slate-200">
          {students.map((s) => {
            const r = map.get(s.id);
            return (
              <article key={s.id} data-student-status={r ? r.isSuspicious ? "flagged" : "checked" : "missing"} hidden={Boolean(slot && viewedStarted && !viewedIsPast && r && !r.isSuspicious)} className="grid min-h-16 gap-2 py-3">
                <div className="flex items-start gap-2">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold tabular-nums text-slate-700">{s.number ?? "—"}</span>
                  <h3 className="min-w-0 flex-1 pt-1 text-base font-bold leading-snug text-slate-900">{s.prefix ?? ""}{s.firstName} {s.lastName}</h3>
                </div>
                <div className="grid gap-2 pl-11">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                    <span className="font-mono text-slate-500">รหัส {s.studentCode}</span>
                    {r ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.isSuspicious ? "bg-amber-100 text-amber-900" : "bg-violet-100 text-violet-900"}`}>
                        {roleLabel(r.role)}
                        {r.sport ? ` (${r.sport})` : ""}
                        {r.isSuspicious && " ⚠️"}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        ยังไม่เช็ก
                      </span>
                    )}
                    {r && <><span className="font-medium tabular-nums text-slate-600">เวลา {formatWallClockTime(r.checkedInAt, true)}</span>{r.source === "staff" && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 font-semibold text-sky-800"><PencilLine aria-hidden="true" size={13} />ครูบันทึกแทน{r.staff?.displayName ? ` · ${r.staff.displayName}` : ""}</span>}</>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!r && pick.length > 0 && (
                      <SheetTrigger className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800" label="บันทึกแทน" title={`เลขที่ ${s.number ?? "—"} · ${s.prefix ?? ""}${s.firstName} ${s.lastName}`} subtitle="บันทึกแทนนักเรียนที่ยังไม่ได้เช็กชื่อ">
                        <div className="grid gap-4">
                          {pick.map((x) => (
                      <form action={manualRecord} key={x.id} className="grid gap-2">
                        <input type="hidden" name="studentId" value={s.id} />
                        <input type="hidden" name="slotId" value={x.id} />
                        <div className="text-xs font-semibold text-slate-700">บันทึกแทนรอบ {periodLabel(x.period)}</div>
                        <RoleSportFields />
                        <ChoiceWithOther name="reason" options={ONBEHALF_REASON_OPTIONS} placeholder="เลือกเหตุผลที่บันทึกแทน" otherPlaceholder="พิมพ์เหตุผล (อย่างน้อย 3 ตัวอักษร)" maxLength={500} />
                        <button className="min-h-11 rounded-xl bg-violet-700 px-4 font-semibold text-white hover:bg-violet-800">บันทึกแทน</button>
                      </form>
                    ))}
                        </div>
                      </SheetTrigger>
                    )}
                    {r && (
                      <SheetTrigger label="จัดการ" title={`เลขที่ ${s.number ?? "—"} · ${s.prefix ?? ""}${s.firstName} ${s.lastName}`} subtitle={`${roleLabel(r.role)}${r.sport ? ` (${r.sport})` : ""} · เวลา ${formatWallClockTime(r.checkedInAt, true)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                        <RecordEditor record={r} isAdmin={session.role === "admin"} reviewerName={r.reviewRequestedBy ? reviewers.get(r.reviewRequestedBy) ?? null : null} />
                      </SheetTrigger>
                    )}
                  </div>
                </div>

                {isAdmin && r?.suspicionReasons && (
                  <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900 break-words">
                    ⚠️ <b>เหตุผลธง:</b> {r.suspicionReasons}
                  </div>
                )}

                {r?.reviewRequested && <div><span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">🚩 แจ้ง admin ตรวจแล้ว</span></div>}

                {r && (distanceInfo(r) || r.lat !== 0 || r.lng !== 0) && (() => { const dist = distanceInfo(r); return (
                  <div className="flex flex-wrap items-center gap-2">
                    {dist && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${dist.inside ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{dist.inside ? <MapPin aria-hidden="true" size={13} /> : <TriangleAlert aria-hidden="true" size={13} />}{dist.text}</span>}
                    {(r.lat !== 0 || r.lng !== 0) && (
                      <a target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 text-sm font-semibold text-sky-800 no-underline hover:bg-sky-50">
                        <MapPin aria-hidden="true" size={16} />ดูบนแผนที่<ExternalLink aria-hidden="true" size={14} className="text-sky-600" />
                      </a>
                    )}
                  </div>
                ); })()}


                {r?.isSuspicious && session.role === "admin" && (
                  <form action={clearFlag} className="mt-1">
                    <input type="hidden" name="recordId" value={r.id} />
                    <button className="secondary py-1.5 px-3 text-sm">ล้างธง</button>
                  </form>
                )}

                </div>
              </article>
            );
          })}
        </div>

        <div className="hidden">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>นักเรียน</th>
                <th>สถานะ / บทบาท</th>
                <th>เวลา</th>
                {isAdmin && <th>เหตุผลธง</th>}
                <th>แผนที่</th>
                <th>บันทึกแทน</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const r = map.get(s.id);
                return (
                  <tr key={s.id}>
                    <td>{s.number ?? "—"}</td>
                    <td className="break-words font-medium text-slate-900">
                      {s.studentCode} {s.prefix ?? ""}{s.firstName} {s.lastName}
                    </td>
                    <td>
                      {r ? (
                        <span>
                          {roleLabel(r.role)}
                          {r.sport ? ` (${r.sport})` : ""}
                          {r.isSuspicious && " ⚠️"}
                        </span>
                      ) : (
                        "ยังไม่เช็ก"
                      )}
                    </td>
                    <td>{r ? formatWallClockTime(r.checkedInAt, true) : "—"}</td>
                    {isAdmin && <td className="break-words max-w-xs">{r?.suspicionReasons ?? "—"}</td>}
                    <td>
                      {r && distanceText(r) && <div className="mb-1 whitespace-nowrap text-xs text-slate-700">📍 {distanceText(r)}</div>}
                      {r && (r.lat !== 0 || r.lng !== 0) ? (
                        <a target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${r.lat},${r.lng}`}>
                          เปิดแผนที่
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {!r && pick.map((x) => (
                        <form action={manualRecord} key={x.id} className="grid gap-1 mb-2">
                          <input type="hidden" name="studentId" value={s.id} />
                          <input type="hidden" name="slotId" value={x.id} />
                          <span className="text-xs font-semibold">{periodLabel(x.period)}</span>
                          <RoleSportFields className="grid gap-1" />
                          <ChoiceWithOther name="reason" options={ONBEHALF_REASON_OPTIONS} placeholder="เลือกเหตุผลที่บันทึกแทน" otherPlaceholder="พิมพ์เหตุผล (อย่างน้อย 3 ตัวอักษร)" maxLength={500} />
                          <button className="secondary">บันทึก</button>
                        </form>
                      ))}
                      {r && <RecordEditor record={r} isAdmin={session.role === "admin"} reviewerName={r.reviewRequestedBy ? reviewers.get(r.reviewRequestedBy) ?? null : null} />}
                      {r?.isSuspicious && session.role === "admin" && (
                        <form action={clearFlag} className="mb-1">
                          <input type="hidden" name="recordId" value={r.id} />
                          <button className="secondary">ล้างธง</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

