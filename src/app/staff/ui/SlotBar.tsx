import Link from "next/link";
import { EVENT_DATES } from "@/lib/event";

const labels = ["จ. 26", "อ. 27", "พ. 28", "พฤ. 29", "ศ. 30"];
export default function SlotBar({ day, period, updatedAt, hrefBase = "/staff" }: { day: string; period: "morning" | "afternoon"; updatedAt: string; hrefBase?: string }) {
  const known = EVENT_DATES.includes(day as typeof EVENT_DATES[number]);
  const active = known ? EVENT_DATES.indexOf(day as typeof EVENT_DATES[number]) : -1;
  return <section aria-label="เลือกรอบกิจกรรม" className="sticky top-14 z-30 -mx-4 border-y border-slate-200 bg-white/95 px-4 py-2 shadow-sm backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
    <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 gap-1 overflow-x-auto py-1">{EVENT_DATES.map((d, i) => <Link key={d} href={`${hrefBase}?day=${d}&period=${period}`} aria-current={active === i ? "date" : undefined} className={`min-h-10 shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${active === i ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-violet-50"}`}>{labels[i]}</Link>)}{!known && <span className="shrink-0 rounded-full bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">{day}</span>}</div><span className="shrink-0 text-xs font-medium tabular-nums text-slate-600">อัปเดต {updatedAt}</span></div>
    <div className="mt-1 flex justify-between gap-2"><div className="inline-flex rounded-xl bg-slate-100 p-1" aria-label="เลือกช่วงเวลา">{(["morning", "afternoon"] as const).map(p => <Link key={p} href={`${hrefBase}?day=${day}&period=${p}`} aria-current={period === p ? "page" : undefined} className={`min-h-10 rounded-lg px-5 py-2 text-sm font-bold ${period === p ? "bg-violet-700 text-white shadow-sm" : "text-slate-700 hover:bg-white"}`}>{p === "morning" ? "เช้า" : "บ่าย"}</Link>)}</div>{!known && <span className="self-center text-xs text-slate-500">วันที่นอกช่วงกิจกรรม</span>}</div>
  </section>;
}
