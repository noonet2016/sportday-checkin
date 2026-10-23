import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL || "mysql://localhost:3306/placeholder"),
});

function wallClock(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

async function main() {
  for (let day = 26; day <= 30; day += 1) {
    const date = `2026-10-${day}`;
    const eventDay = await prisma.eventDay.upsert({
      where: { date: wallClock(date, "00:00") },
      update: {},
      create: { date: wallClock(date, "00:00") },
    });

    await prisma.checkinSlot.upsert({
      where: { eventDayId_period: { eventDayId: eventDay.id, period: "morning" } },
      update: {},
      create: { eventDayId: eventDay.id, period: "morning", opensAt: wallClock(date, "08:00"), closesAt: wallClock(date, "10:00") },
    });
    await prisma.checkinSlot.upsert({
      where: { eventDayId_period: { eventDayId: eventDay.id, period: "afternoon" } },
      update: {},
      create: { eventDayId: eventDay.id, period: "afternoon", opensAt: wallClock(date, "13:00"), closesAt: wallClock(date, "14:00") },
    });
  }
}

main().finally(() => prisma.$disconnect());
