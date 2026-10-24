"use client";

import { useState } from "react";

export default function RoomFilters({ counts, defaultFilter }: { counts: { missing: number; checked: number; flagged: number; all: number }; defaultFilter: "missing" | "all" }) {
  const [active, setActive] = useState<"missing" | "checked" | "flagged" | "all">(defaultFilter);
  const tabs = [["all", "ทั้งหมด", counts.all], ["checked", "เช็กแล้ว", counts.checked], ["missing", "ยังไม่เช็ก", counts.missing], ["flagged", "ติดธง", counts.flagged]] as const;
  return <div className="sticky top-[13rem] z-40 -mx-3 grid grid-cols-4 gap-1 border-y border-slate-200 bg-slate-50 px-1 py-2 sm:-mx-4 sm:px-2" role="tablist" aria-label="กรองรายชื่อนักเรียน">
    {tabs.map(([key, label, n]) => <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => { setActive(key); document.querySelectorAll<HTMLElement>("[data-student-status]").forEach(row => { row.hidden = key !== "all" && row.dataset.studentStatus !== key; }); }} className={`flex min-h-12 flex-col items-center justify-center rounded-xl border text-xs font-semibold leading-tight ${active === key ? "border-violet-700 bg-violet-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}><span>{label}</span><b className="text-base tabular-nums">{n}</b></button>)}
  </div>;
}
