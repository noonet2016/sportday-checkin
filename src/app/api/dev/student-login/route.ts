import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

// Local testing only: sign in as a dev test student (lineUserId "dev-…") without LINE. 404 in production.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const code = req.nextUrl.searchParams.get("code") ?? "99901";
  const student = await prisma.student.findUnique({ where: { studentCode: code }, select: { lineUserId: true } });
  if (!student?.lineUserId?.startsWith("dev-")) return new NextResponse("Not a dev test student — run scripts/dev-test-student.ts", { status: 404 });
  await createSession("student", code);
  return NextResponse.redirect(new URL("/checkin", req.url));
}
