/**
 * Name / student-code search for staff pages. Returns a Prisma `where` fragment that is
 * ANDed with the caller's room scope, so a search can never widen what a teacher may see.
 * Each word must match first name, last name or student code ("สมชาย ใจดี" matches both parts).
 */
export function studentNameFilter(q: string | undefined) {
  const words = (q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!words.length) return {};
  return {
    AND: words.map((w) => ({
      OR: [{ firstName: { contains: w } }, { lastName: { contains: w } }, { studentCode: { contains: w } }],
    })),
  };
}
