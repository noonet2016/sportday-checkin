export const EVENT_DATES = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"] as const;
export const EVENT_PERIODS = ["morning", "afternoon"] as const;
export type EventPeriod = (typeof EVENT_PERIODS)[number];
export const periodLabel = (period: string): string => period === "morning" ? "เช้า" : "บ่าย";
export const roleLabel = (role: string): string => role === "compete" ? "🏃 แข่งกีฬา" : "📣 เชียร์";
export const roleCsvLabel = (role: string): string => role === "compete" ? "แข่งกีฬา" : "เชียร์";
/** International sports offered in pickers (Trainer, 2026-10-24); anything else goes through "อื่น ๆ". */
export const SPORT_OPTIONS = ["ฟุตบอล", "ฟุตซอล", "วอลเลย์บอล", "บาสเกตบอล", "แบดมินตัน", "เทเบิลเทนนิส", "เซปักตะกร้อ", "แฮนด์บอล", "กรีฑา", "เปตอง"] as const;
/** Common reasons a teacher records a check-in on a student's behalf; anything else goes through "อื่น ๆ". */
export const ONBEHALF_REASON_OPTIONS = ["ลืมเช็คชื่อ", "ไม่ได้นำโทรศัพท์มา", "แบตเตอรี่โทรศัพท์หมด", "โทรศัพท์ไม่มีอินเทอร์เน็ต", "GPS ใช้งานไม่ได้", "ไม่มีโทรศัพท์มือถือ", "ช่วยงานกิจกรรม / ทำหน้าที่อื่น"] as const;
/** Why a teacher asks an admin to review a student's own check-in. */
export const REVIEW_REASON_OPTIONS = ["ไม่พบนักเรียนในบริเวณงาน", "สงสัยใช้ GPS ปลอม", "นักเรียนแจ้งว่าไม่ได้เช็คชื่อเอง", "เลือกบทบาทหรือกีฬาไม่ตรงความจริง"] as const;
/** Why an admin deletes a check-in record (stored in the audit log with a snapshot of the record). */
export const DELETE_REASON_OPTIONS = ["ยืนยันว่าใช้ GPS ปลอม / ไม่ได้อยู่ในโรงเรียนจริง", "บันทึกผิดคน", "บันทึกผิดรอบ", "รายการซ้ำหรือผิดพลาด"] as const;
/** Pass rule (Trainer, 2026-10-24): attend at least 80% of all event slots. */
export const PASS_RATIO = 0.8;
export const attendancePercent = (attended: number, totalSlots: number): number => totalSlots > 0 ? Math.round((attended / totalSlots) * 100) : 0;
export const attendancePassed = (attended: number, totalSlots: number): boolean => totalSlots > 0 && attended / totalSlots >= PASS_RATIO;
/** Slot columns in time order (Prisma's orderBy period sorts "afternoon" before "morning"). */
export const periodOrder = (period: string): number => period === "morning" ? 0 : 1;
export type SlotState = { state: "not-event-day" } | { state: "before" | "open" | "closed"; period: EventPeriod; opensAt: Date; closesAt: Date };

/** Default windows (hours) — used by the seed and as a pure fallback. Live windows come from the DB slots, editable by admin. */
const schedule: Record<EventPeriod, readonly [number, number]> = { morning: [8, 10], afternoon: [13, 15] };
export type SlotTimes = { period: EventPeriod; opensAt: Date; closesAt: Date };
export function eventDateKey(wallClock: Date): string { return wallClock.toISOString().slice(0, 10); }
function defaultSlotsFor(wallClock: Date): SlotTimes[] {
  return (Object.entries(schedule) as [EventPeriod, readonly [number, number]][]).map(([period, [openHour, closeHour]]) => ({ period, opensAt: new Date(Date.UTC(wallClock.getUTCFullYear(), wallClock.getUTCMonth(), wallClock.getUTCDate(), openHour)), closesAt: new Date(Date.UTC(wallClock.getUTCFullYear(), wallClock.getUTCMonth(), wallClock.getUTCDate(), closeHour)) }));
}
/** Window state for one day's slots (Bangkok wall-clock): open now, the next slot ("before", incl. the gap between rounds), or "closed" after the last. No slots = not an event day. */
export function windowFromSlots(wallClock: Date, daySlots: readonly SlotTimes[]): SlotState {
  if (!daySlots.length) return { state: "not-event-day" };
  const slots = [...daySlots].sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime());
  const now = wallClock.getTime();
  const current = slots.find((slot) => now >= slot.opensAt.getTime() && now < slot.closesAt.getTime());
  if (current) return { state: "open", ...current };
  const next = slots.find((slot) => now < slot.opensAt.getTime());
  if (next) return { state: "before", ...next };
  return { state: "closed", ...slots[slots.length - 1] };
}
export function resolveSlotWindow(wallClock: Date, eventDates: readonly string[] = EVENT_DATES): SlotState {
  return eventDates.includes(eventDateKey(wallClock)) ? windowFromSlots(wallClock, defaultSlotsFor(wallClock)) : { state: "not-event-day" };
}

/** Choose the current open slot, otherwise the next slot, clamping before/after the event. `slots` = all event slots (DB); defaults to the fixed schedule. */
export function resolveDefaultSlot(wallClock: Date, eventDates: readonly string[] = EVENT_DATES, slots?: readonly (SlotTimes & { date: string })[]): { date: string; period: EventPeriod } {
  const all = (slots ?? [...eventDates].flatMap(date => defaultSlotsFor(new Date(`${date}T00:00:00Z`)).map(s => ({ ...s, date }))))
    .map(s => ({ date: s.date, period: s.period, opensAt: s.opensAt.getTime(), closesAt: s.closesAt.getTime() }))
    .sort((a, b) => a.opensAt - b.opensAt);
  const now = wallClock.getTime();
  const selected = all.find(slot => now >= slot.opensAt && now < slot.closesAt)
    ?? all.find(slot => slot.opensAt > now)
    ?? all[all.length - 1];
  return { date: selected.date, period: selected.period };
}

/** Room (numeric), then เลขที่, then student code — the order every student list uses. */
export function compareStudents(a: { classLevel: string; room: string; number: number | null; studentCode: string }, b: { classLevel: string; room: string; number: number | null; studentCode: string }): number {
  return compareRooms(a, b) || (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER) || a.studentCode.localeCompare(b.studentCode);
}
export function compareRooms(a: { classLevel: string; room: string }, b: { classLevel: string; room: string }): number {
  const numericAware = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  return numericAware.compare(a.classLevel, b.classLevel) || numericAware.compare(a.room, b.room);
}
