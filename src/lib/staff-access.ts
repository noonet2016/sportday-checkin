import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/session";

export type RoomKey = { classLevel: string; room: string };

/** The single source of truth for staff room scope. */
export async function allowedRooms(session: NonNullable<Session>): Promise<RoomKey[]> {
  if (session.role === "admin") {
    return prisma.student.findMany({ where: { house: "purple" }, distinct: ["classLevel", "room"], select: { classLevel: true, room: true } });
  }
  return prisma.staffRoom.findMany({ where: { staffId: Number(session.id) }, select: { classLevel: true, room: true }, orderBy: [{ classLevel: "asc" }, { room: "asc" }] });
}

export function roomAllowed(rooms: RoomKey[], classLevel: string, room: string): boolean {
  return rooms.some((item) => item.classLevel === classLevel && item.room === room);
}

/** Parse a "level|room" filter value; ignored unless it is one of the caller's allowed rooms, so it can only narrow scope. */
export function roomFilter(rooms: RoomKey[], value: string | null | undefined): RoomKey | null {
  const [classLevel, room] = (value ?? "").split("|");
  return classLevel && room && roomAllowed(rooms, classLevel, room) ? { classLevel, room } : null;
}
