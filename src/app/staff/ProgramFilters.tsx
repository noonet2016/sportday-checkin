"use client";
import { useState } from "react";

/** Program chips for the dashboard room cards; hidden when the visible rooms are all one program (e.g. a teacher's own room). */
export default function ProgramFilters({ programs }: { programs: string[] }) {
  const [active, setActive] = useState("ทั้งหมด");
  if (programs.length < 2) return null;
  const order = ["ทั่วไป", "EP", "SMTE"];
  const options = ["ทั้งหมด", ...[...programs].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))];
  return <div className="flex flex-wrap gap-2" aria-label="กรองตามหลักสูตร">{options.map(label => <button key={label} type="button" aria-pressed={active === label} onClick={() => { setActive(label); document.querySelectorAll<HTMLElement>("[data-program]").forEach(card => { card.hidden = label !== "ทั้งหมด" && card.dataset.program !== label; }); }} className={`min-h-10 rounded-full border px-3 py-1.5 text-sm font-semibold ${active === label ? "border-violet-700 bg-violet-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{label}</button>)}</div>;
}
