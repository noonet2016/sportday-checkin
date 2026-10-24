import Link from "next/link";
import { ClipboardList, House, Link2, MapPin, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { logoutStaff } from "./actions";

type ActivePage = "home" | "report" | "line" | "settings" | "users";
export default async function StaffNav({ active }: { active: ActivePage }) {
  const session = await getSession("staff");
  if (!session) return null;
  const admin = session.role === "admin";
  const [staffInfo, pending] = await Promise.all([
    prisma.staff.findUnique({ where: { id: Number(session.id) }, select: { displayName: true } }),
    admin ? prisma.checkinRecord.count({ where: { reviewRequested: true } }) : Promise.resolve(0),
  ]);
  const links = [
    { key: "home" as const, href: "/staff", label: "หน้าหลัก", Icon: House },
    { key: "report" as const, href: "/staff/report", label: "รายงาน", Icon: ClipboardList },
    { key: "line" as const, href: "/staff/line", label: "ผูก LINE", Icon: Link2 },
    ...(admin ? [
      { key: "settings" as const, href: "/staff/settings", label: "พื้นที่", Icon: MapPin },
      { key: "users" as const, href: "/staff/users", label: "ครู", Icon: Users },
    ] : []),
  ];
  const navLink = (item: typeof links[number], mobile = false) => <Link key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined}
    className={`relative inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${mobile ? "flex-1 flex-col gap-0.5 px-1 py-1 text-xs" : "px-3 py-2"} ${active === item.key ? "bg-violet-100 text-violet-900" : "text-slate-700 hover:bg-slate-100"}`}>
    <item.Icon aria-hidden="true" size={18} strokeWidth={2} /><span>{item.label}</span>
    {admin && item.key === "home" && pending > 0 && <span aria-label={`${pending} รายการรอตรวจ`} className={`absolute ${mobile ? "right-[calc(50%-24px)] top-0" : "-right-1 -top-1"} min-w-5 rounded-full bg-rose-600 px-1 text-center text-[11px] leading-5 text-white`}>{pending}</span>}
  </Link>;
  return <>
    <header className="sticky top-0 z-40 -mx-4 mb-3 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:mx-0 sm:rounded-b-xl md:grid md:grid-cols-[1fr_auto_1fr]">
      <nav aria-label="เมนูเจ้าหน้าที่" className="hidden items-center gap-1 justify-self-start md:flex">{links.map(item => navLink(item))}</nav>
      <div className="flex min-w-0 items-center gap-2 md:justify-self-center"><span className="font-bold text-slate-900">เช็กชื่อกีฬาสี · สีม่วง</span><span className="hidden rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-900 sm:inline-flex">{admin ? "ผู้ดูแลระบบ" : "ครู"}</span></div>
      <details className="relative md:justify-self-end"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"><span className="whitespace-nowrap">{staffInfo?.displayName ?? "เจ้าหน้าที่"}</span><span aria-hidden="true">⌄</span></summary><div className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"><p className="px-3 py-2 text-sm text-slate-600">{admin ? "ผู้ดูแลระบบ" : "ครู"}</p><form action={logoutStaff}><button className="min-h-11 w-full rounded-lg bg-rose-600 px-3 text-left font-semibold text-white hover:bg-rose-700">ออกจากระบบ</button></form></div></details>
    </header>
    <nav aria-label="เมนูเจ้าหน้าที่" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 px-2 pt-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(15_23_42/0.08)] backdrop-blur md:hidden">{links.map(item => navLink(item, true))}</nav>
  </>;
}
