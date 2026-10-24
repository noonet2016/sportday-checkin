import { prisma } from "@/lib/prisma";
import { eventDateKey, windowFromSlots, type EventPeriod, type SlotState, type SlotTimes } from "@/lib/event";

/** Today's check-in window from the DB slots (admin-editable), plus the matching slot id. */
export async function slotWindowNow(now: { dateOnly: Date; wallClock: Date }): Promise<{ window: SlotState; slotId: number | null; daySlots: SlotTimes[] }> {
  const day = await prisma.eventDay.findUnique({ where: { date: now.dateOnly }, select: { slots: { select: { id: true, period: true, opensAt: true, closesAt: true } } } });
  const daySlots = (day?.slots ?? []).map(s => ({ id: s.id, period: s.period as EventPeriod, opensAt: s.opensAt, closesAt: s.closesAt }));
  const window = windowFromSlots(now.wallClock, daySlots);
  const slotId = window.state === "not-event-day" ? null : daySlots.find(s => s.period === window.period)?.id ?? null;
  return { window, slotId, daySlots: daySlots.map(({ period, opensAt, closesAt }) => ({ period, opensAt, closesAt })) };
}

/** Every event slot with its date key, for picking the dashboard's default slot. */
export async function allEventSlots(): Promise<(SlotTimes & { date: string })[]> {
  const slots = await prisma.checkinSlot.findMany({ select: { period: true, opensAt: true, closesAt: true, eventDay: { select: { date: true } } } });
  return slots.map(s => ({ date: eventDateKey(s.eventDay.date), period: s.period as EventPeriod, opensAt: s.opensAt, closesAt: s.closesAt }));
}
