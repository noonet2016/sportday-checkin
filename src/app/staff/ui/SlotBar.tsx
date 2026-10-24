import Link from "next/link";
import { EVENT_DATES } from "@/lib/event";

const labels = ["จ. 26", "อ. 27", "พ. 28", "พฤ. 29", "ศ. 30"];
export default function SlotBar({ day, period, updatedAt, hrefBase = "/staff" }: { day: string; period: "morning" | "afternoon"; updatedAt: string; hrefBase?: string }) {
  const known = EVENT_DATES.includes(day as typeof EVENT_DATES[number]);
  const active = known ? EVENT_DATES.indexOf(day as typeof EVENT_DATES[number]) : -1;
  return <section aria-label="เลือกรอบกิจกรรม" className="sticky top-14 z-30 -mx-4 border-y border-slate-200 bg-white px-4 py-2 shadow-sm sm:mx-0 sm:rounded-2xl sm:border">
    <div className="grid grid-cols-5 gap-1">{EVENT_DATES.map((d, i) => <Link key={d} href={`${hrefBase}?day=${d}&period=${period}`} aria-current={active === i ? "date" : undefined} className={`flex h-12 min-w-0 flex-col items-center justify-center rounded-xl text-sm leading-tight font-semibold ${active === i ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-violet-50"}`}><span className="text-[11px]">{labels[i].split(" ")[0]}</span><b>{labels[i].split(" ")[1]}</b></Link>)}{!known && <span className="col-span-5 rounded-lg bg-amber-100 px-3 py-1 text-center text-sm text-amber-900">วันที่ {day} นอกช่วงกิจกรรม</span>}</div>
    <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" aria-label="เลือกช่วงเวลา">{(["morning", "afternoon"] as const).map(p => <Link key={p} href={`${hrefBase}?day=${day}&period=${p}`} aria-current={period === p ? "page" : undefined} className={`flex h-11 items-center justify-center rounded-lg text-sm font-bold ${period === p ? "bg-violet-700 text-white shadow-sm" : "text-slate-700 hover:bg-white"}`}>{p === "morning" ? "เช้า" : "บ่าย"}</Link>)}</div><div className="pt-1 text-right text-xs font-medium tabular-nums text-slate-600">อัปเดต {updatedAt}</div>
  </section>;
}
