export const EVENT_DATES = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"] as const;
export const EVENT_PERIODS = ["morning", "afternoon"] as const;
export type EventPeriod = (typeof EVENT_PERIODS)[number];
export type SlotState = { state: "not-event-day" } | { state: "before" | "open" | "closed"; period: EventPeriod; opensAt: Date; closesAt: Date };

const schedule: Record<EventPeriod, readonly [number, number]> = { morning: [8, 10], afternoon: [13, 14] };
export function eventDateKey(wallClock: Date): string { return wallClock.toISOString().slice(0, 10); }
export function resolveSlotWindow(wallClock: Date, eventDates: readonly string[] = EVENT_DATES): SlotState {
  const date = eventDateKey(wallClock);
  if (!eventDates.includes(date)) return { state: "not-event-day" };
  const now = wallClock.getTime();
  const slots = (Object.entries(schedule) as [EventPeriod, readonly [number, number]][]).map(([period, [openHour, closeHour]]) => ({ period, opensAt: new Date(Date.UTC(wallClock.getUTCFullYear(), wallClock.getUTCMonth(), wallClock.getUTCDate(), openHour)), closesAt: new Date(Date.UTC(wallClock.getUTCFullYear(), wallClock.getUTCMonth(), wallClock.getUTCDate(), closeHour)) }));
  const current = slots.find((slot) => now >= slot.opensAt.getTime() && now < slot.closesAt.getTime());
  if (current) return { state: "open", ...current };
  if (now < slots[0].opensAt.getTime()) return { state: "before", ...slots[0] };
  return { state: "closed", ...slots[slots.length - 1] };
}
