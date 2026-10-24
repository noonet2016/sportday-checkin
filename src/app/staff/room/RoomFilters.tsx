"use client";

import { useState } from "react";

export default function RoomFilters({ counts, defaultFilter }: { counts: { missing: number; checked: number; flagged: number; all: number }; defaultFilter: "missing" | "all" }) {
  const [active, setActive] = useState<"missing" | "checked" | "flagged" | "all">(defaultFilter);
  const tabs = [["missing", "ยังไม่เช็ก", counts.missing], ["checked", "เช็กแล้ว", counts.checked], ["flagged", "ติดธง", counts.flagged], ["all", "ทั้งหมด", counts.all]] as const;
  return <div className="sticky top-28 z-20 -mx-1 flex gap-2 overflow-x-auto bg-slate-50 px-1 py-2" role="tablist" aria-label="กรองรายชื่อนักเรียน">
    {tabs.map(([key, label, n]) => <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => { setActive(key); document.querySelectorAll<HTMLElement>("[data-student-status]").forEach(row => { row.hidden = key !== "all" && row.dataset.studentStatus !== key; }); }} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${active === key ? "border-violet-700 bg-violet-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{label} ({n})</button>)}
  </div>;
}
