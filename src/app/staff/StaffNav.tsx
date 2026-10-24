import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { allowedRooms } from "@/lib/staff-access";
import { logoutStaff } from "./actions";

type ActivePage = "home" | "report" | "settings" | "users";

export default async function StaffNav({ active }: { active: ActivePage }) {
  const session = await getSession("staff");
  if (!session) return null;
  const [rooms, staffInfo] = await Promise.all([
    allowedRooms(session),
    prisma.staff.findUnique({ where: { id: Number(session.id) }, select: { displayName: true } }),
  ]);
  const admin = session.role === "admin";
  const links = [
    { key: "home", href: "/staff", label: "🏠 หน้าหลัก" },
    { key: "report", href: "/staff/report", label: "📊 รายงาน" },
    ...(admin ? [
      { key: "settings", href: "/staff/settings", label: "📍 ตั้งค่าพื้นที่" },
      { key: "users", href: "/staff/users", label: "👥 จัดการครู" },
    ] : []),
  ];

  return <header className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={admin ? "admin-badge" : "staff-badge"}>
          {admin ? "👑 ผู้ดูแลระบบ" : `👩‍🏫 ครูประจำห้อง · ${rooms.map(r => `${r.classLevel}/${r.room}`).join(", ")}`}
        </p>
        <p className="mt-1 font-semibold text-slate-900">{staffInfo?.displayName}</p>
      </div>
      <form action={logoutStaff}><button className="rounded-lg bg-rose-700 px-4 py-3 font-semibold text-white hover:bg-rose-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-800">ออกจากระบบ</button></form>
    </div>
    <nav aria-label="เมนูเจ้าหน้าที่" className="mt-3 flex flex-wrap gap-2">
      {links.map(link => <Link key={link.key} href={link.href} aria-current={active === link.key ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800 ${active === link.key ? "border-indigo-900 bg-indigo-800 text-white" : "border-indigo-700 bg-white text-indigo-900 hover:bg-indigo-100"}`}>
        {link.label}
      </Link>)}
    </nav>
  </header>;
}
