"use client";
import { useState } from "react";

export default function ProgramFilters() {
  const [active, setActive] = useState("ทั้งหมด");
  return <div className="flex flex-wrap gap-2" aria-label="กรองตามหลักสูตร">{["ทั้งหมด", "ทั่วไป", "EP", "SMTE"].map(label => <button key={label} type="button" aria-pressed={active === label} onClick={() => { setActive(label); document.querySelectorAll<HTMLElement>("[data-program]").forEach(card => { card.hidden = label !== "ทั้งหมด" && card.dataset.program !== label; }); }} className={`min-h-10 rounded-full border px-3 py-1.5 text-sm font-semibold ${active === label ? "border-violet-700 bg-violet-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{label}</button>)}</div>;
}
