"use server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { nowInBangkok } from "@/lib/time";
import { resolveSlotWindow } from "@/lib/event";
import { haversineDistance } from "@/lib/geo";
import { scoreSuspicion, type CheckinGpsSample } from "@/lib/spoof";
import { writeAudit } from "@/lib/audit";

// Flip this single policy constant when the Trainer decides sport is required.
const SPORT_REQUIRED = false;
type Input = { role: "compete" | "cheer"; sport?: string; lat: number; lng: number; accuracy: number; samples: CheckinGpsSample[] };

export async function submitCheckin(input: Input): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession(); if (session.role !== "student") return { ok: false, message: "Student account required." };
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90 || !Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180 || !Number.isFinite(input.accuracy) || input.accuracy > 100) return { ok: false, message: "GPS location is unavailable or too inaccurate. Please try again outdoors." };
  if (input.role !== "compete" && input.role !== "cheer") return { ok: false, message: "Choose compete or cheer." };
  const sport = input.sport?.trim() ?? ""; if (SPORT_REQUIRED && input.role === "compete" && !sport) return { ok: false, message: "Please enter your sport." };
  const now = nowInBangkok(); const window = resolveSlotWindow(now.wallClock);
  if (window.state !== "open") return { ok: false, message: window.state === "not-event-day" ? "Today is not a Sport Day event day." : "This check-in window is not open." };
  const student = await prisma.student.findUnique({ where: { studentCode: session.id }, select: { id: true, house: true } });
  if (!student || student.house !== "purple") return { ok: false, message: "Purple House student account required." };
  const eventDay = await prisma.eventDay.findUnique({ where: { date: now.dateOnly }, select: { id: true } });
  const slot = eventDay ? await prisma.checkinSlot.findUnique({ where: { eventDayId_period: { eventDayId: eventDay.id, period: window.period } }, select: { id: true } }) : null;
  if (!slot) return { ok: false, message: "Today’s slot has not been configured yet. Please ask staff." };
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: ["geofence_lat", "geofence_lng", "geofence_radius_m"] } } });
  const value = (key: string) => Number(settings.find((setting) => setting.key === key)?.value); const lat = value("geofence_lat"); const lng = value("geofence_lng"); const radius = value("geofence_radius_m");
  if (![lat, lng, radius].every(Number.isFinite) || radius <= 0) return { ok: false, message: "Campus geofence is not configured yet. Please ask staff." };
  const distance = haversineDistance(input.lat, input.lng, lat, lng); if (distance > radius) return { ok: false, message: "You are outside the campus check-in area. Please move inside the school boundary and try again." };
  const suspicion = scoreSuspicion(input.samples, input.lat, input.lng, { name: "campus", lat, lng });
  const forwarded = (await headers()).get("x-forwarded-for"); const ipAddress = forwarded?.split(",")[0]?.trim().slice(0, 45) || null;
  try {
    await prisma.$transaction(async (tx) => {
      const record = await tx.checkinRecord.create({ data: { studentId: student.id, slotId: slot.id, role: input.role, sport: input.role === "compete" && sport ? sport.slice(0, 100) : null, lat: input.lat, lng: input.lng, accuracy: input.accuracy, samples: input.samples, ipAddress, isSuspicious: suspicion.suspicious, suspicionReasons: suspicion.reasons.join("; ") || null } });
      await writeAudit(tx, `student:${student.id}`, "checkin_created", "CheckinRecord", String(record.id), { slotId: slot.id, role: input.role, suspicious: suspicion.suspicious });
    });
    return { ok: true, message: "Check-in complete. Have a great Sport Day!" };
  } catch (error) { if ((error as { code?: string }).code === "P2002") return { ok: true, message: "You have already checked in for this slot." }; return { ok: false, message: "Could not save your check-in. Please try again." }; }
}
