import { periodLabel, roleLabel } from "@/lib/event";
import Link from "next/link";
import StaffNav from "../../../StaffNav";
import RecordEditor from "../../../RecordEditor";
import RoleSportFields from "../../../RoleSportFields";
import { distanceFromCentre, getGeofence } from "@/lib/geofence";
import { formatDistance } from "@/lib/geo";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseDateInput, formatWallClockTime, formatDateInput } from "@/lib/time";
import { manualRecord, clearFlag, deleteRecord } from "@/app/staff/actions";
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
  const fence = await getGeofence();
  const distanceText = (r: { source: string; lat: number; lng: number }) => {
    if (!fence || r.source !== "self") return null;
    const d = distanceFromCentre(fence, r.lat, r.lng);
    return `${d > fence.radius ? "⚠️ นอกรัศมี" : "ในรัศมี"} ~${formatDistance(d)} (กำหนด ${formatDistance(fence.radius)})`;
  };
  // Not-yet-checked students first so the on-behalf forms are at the top; Array.sort is stable, so number order is kept within each group.
  students.sort((x, y) => Number(map.has(x.id)) - Number(map.has(y.id)));
  const missingCount = students.filter(s => !map.has(s.id)).length;
  // On-behalf targets only the slot being viewed; the status shown on this page is for that slot.
  const pick = await prisma.checkinSlot.findMany({
    where: { id: slot?.id ?? -1 },
    select: { id: true, period: true },
  });

  return (
    <main className="screen" style={{ maxWidth: "76rem", alignContent: "start" }}>
      <StaffNav active="home" />
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1>{level}/{room} · {students.length} คน</h1>
          <Link href={`/staff${day ? `?day=${encodeURIComponent(day)}&period=${period === "afternoon" ? "afternoon" : "morning"}` : ""}`}>
            ← กลับ
          </Link>
        </div>
        {slot && <p className="text-sm text-slate-700">{formatDateInput(slot.opensAt)} รอบ{periodLabel(slot.period)} · ยังไม่เช็ค <b className="text-red-700">{missingCount}</b> คน{missingCount > 0 ? " — แสดงไว้ด้านบนพร้อมฟอร์มบันทึกแทน" : ""}</p>}

        {/* Mobile (<640px): one card per student */}
        <div className="space-y-3 sm:hidden">
          {students.map((s) => {
            const r = map.get(s.id);
            return (
              <article key={s.id} className="rounded-xl border border-violet-100 bg-white p-4 shadow-sm flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-900 break-words">
                    <span className="mr-2 inline-block rounded-md bg-slate-100 px-1.5 text-sm text-slate-700">เลขที่ {s.number ?? "—"}</span>
                    <span className="font-mono text-sm text-violet-700 mr-2">{s.studentCode}</span>
                    {s.prefix ?? ""}{s.firstName} {s.lastName}
                  </div>
                  <div>
                    {r ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.isSuspicious ? "bg-amber-100 text-amber-900" : "bg-violet-100 text-violet-900"}`}>
                        {roleLabel(r.role)}
                        {r.sport ? ` (${r.sport})` : ""}
                        {r.source === "staff" ? " (เจ้าหน้าที่)" : ""}
                        {r.isSuspicious && " ⚠️"}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        ยังไม่เช็ก
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-slate-700">
                  <span className="text-slate-500">เวลา: </span>
                  <span className="font-medium text-slate-900">{r ? formatWallClockTime(r.checkedInAt, true) : "—"}</span>
                </div>

                {r?.suspicionReasons && (
                  <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900 break-words">
                    ⚠️ <b>เหตุผลธง:</b> {r.suspicionReasons}
                  </div>
                )}

                {r && distanceText(r) && <div className="text-sm text-slate-700">📍 {distanceText(r)}</div>}

                {r && <RecordEditor record={r} isAdmin={session.role === "admin"} />}

                {r && (r.lat !== 0 || r.lng !== 0) && (
                  <div>
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                      className="inline-flex items-center text-sm font-semibold text-sky-700 underline hover:text-sky-800"
                    >
                      📍 เปิดแผนที่
                    </a>
                  </div>
                )}

                {!r && pick.length > 0 && (
                  <div className="mt-1 border-t border-slate-100 pt-2 space-y-2">
                    {pick.map((x) => (
                      <form action={manualRecord} key={x.id} className="grid gap-2">
                        <input type="hidden" name="studentId" value={s.id} />
                        <input type="hidden" name="slotId" value={x.id} />
                        <div className="text-xs font-semibold text-slate-700">บันทึกแทนรอบ {periodLabel(x.period)}</div>
                        <RoleSportFields />
                        <input name="reason" required minLength={3} placeholder="เหตุผลที่บันทึกแทน" className="rounded-lg border border-slate-300 p-2 text-sm" />
                        <button className="secondary py-2 text-sm">บันทึกแทน</button>
                      </form>
                    ))}
                  </div>
                )}

                {r?.isSuspicious && session.role === "admin" && (
                  <form action={clearFlag} className="mt-1">
                    <input type="hidden" name="recordId" value={r.id} />
                    <button className="secondary py-1.5 px-3 text-sm">ล้างธง</button>
                  </form>
                )}

                {r && session.role === "admin" && (
                  <form action={deleteRecord} className="mt-1">
                    <input type="hidden" name="recordId" value={r.id} />
                    <button className="secondary py-1.5 px-3 text-sm text-rose-700 hover:bg-rose-50">ลบรายการ</button>
                  </form>
                )}
              </article>
            );
          })}
        </div>

        {/* Desktop (>=640px): table view */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>นักเรียน</th>
                <th>สถานะ / บทบาท</th>
                <th>เวลา</th>
                <th>เหตุผลธง</th>
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
                          {r.source === "staff" ? " (เจ้าหน้าที่)" : ""}
                          {r.isSuspicious && " ⚠️"}
                        </span>
                      ) : (
                        "ยังไม่เช็ก"
                      )}
                    </td>
                    <td>{r ? formatWallClockTime(r.checkedInAt, true) : "—"}</td>
                    <td className="break-words max-w-xs">{r?.suspicionReasons ?? "—"}</td>
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
                          <input name="reason" required minLength={3} placeholder="เหตุผลที่บันทึกแทน" />
                          <button className="secondary">บันทึก</button>
                        </form>
                      ))}
                      {r && <RecordEditor record={r} isAdmin={session.role === "admin"} />}
                      {r?.isSuspicious && session.role === "admin" && (
                        <form action={clearFlag} className="mb-1">
                          <input type="hidden" name="recordId" value={r.id} />
                          <button className="secondary">ล้างธง</button>
                        </form>
                      )}
                      {r && session.role === "admin" && (
                        <form action={deleteRecord}>
                          <input type="hidden" name="recordId" value={r.id} />
                          <button className="secondary">ลบรายการ</button>
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
