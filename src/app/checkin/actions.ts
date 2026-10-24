"use server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { nowInBangkok } from "@/lib/time";
import { performCheckin } from "@/lib/checkin-core";
import type { CheckinGpsSample } from "@/lib/spoof";

type Input = { role: "compete" | "cheer"; sport?: string; lat: number; lng: number; accuracy: number; samples: CheckinGpsSample[] };

export async function submitCheckin(input: Input): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  if (session.role !== "student") return { ok: false, message: "ต้องใช้บัญชีนักเรียน" };
  const student = await prisma.student.findUnique({ where: { studentCode: session.id }, select: { id: true } });
  if (!student) return { ok: false, message: "ต้องใช้บัญชีนักเรียนสีม่วง" };
  const forwarded = (await headers()).get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim().slice(0, 45) || null;
  return performCheckin({ ...input, studentId: student.id, now: nowInBangkok(), ip });
}
