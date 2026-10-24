"use client";
import { useMemo, useState } from "react";
import { Link2, Link2Off, Search } from "lucide-react";
import ConfirmSubmit from "@/app/_components/ConfirmSubmit";
import { unlinkStudentLine } from "../actions";

type Row = { id: number; code: string; name: string; room: string; program: string | null; number: number | null; linked: boolean; lineName: string | null; linkedAt: string | null };
type Tab = "all" | "linked" | "unlinked";

/** LINE binding status per student (same idea as lineup-nextjs line-status): tabs, room chips, search, unlink. */
export default function LineStatusList({ students }: { students: Row[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [room, setRoom] = useState("");
  const [query, setQuery] = useState("");
  const rooms = useMemo(() => [...new Set(students.map(s => s.room))], [students]);
  const inRoom = room ? students.filter(s => s.room === room) : students;
  const linkedCount = inRoom.filter(s => s.linked).length;
  const q = query.trim().toLowerCase();
  const visible = inRoom.filter(s => (tab === "all" || (tab === "linked") === s.linked) && (!q || s.name.toLowerCase().includes(q) || s.code.includes(q) || String(s.number ?? "") === q || (s.lineName ?? "").toLowerCase().includes(q)));
  const tabs = [["all", "ทั้งหมด", inRoom.length, "border-violet-700 bg-violet-700"], ["linked", "ผูกแล้ว", linkedCount, "border-emerald-600 bg-emerald-600"], ["unlinked", "ยังไม่ผูก", inRoom.length - linkedCount, "border-amber-500 bg-amber-500"]] as const;

  return <div className="grid gap-3">
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div role="tablist" className="grid grid-cols-3 gap-2">
        {tabs.map(([key, label, n, on]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex min-h-12 flex-col items-center justify-center rounded-xl border text-xs font-semibold leading-tight ${tab === key ? `${on} text-white` : "border-slate-300 bg-white text-slate-800"}`}><span>{label}</span><b className="text-base tabular-nums">{n}</b></button>)}
      </div>
      {rooms.length > 1 && <div className="flex flex-wrap gap-1.5" aria-label="กรองตามห้อง">
        {["", ...rooms].map(r => <button key={r || "all"} type="button" aria-pressed={room === r} onClick={() => setRoom(r)} className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${room === r ? "border-violet-700 bg-violet-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{r || "ทุกห้อง"}</button>)}
      </div>}
      <label className="relative block">
        <span className="sr-only">ค้นหา</span>
        <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาชื่อ เลขประจำตัว เลขที่ หรือชื่อ LINE" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200" />
      </label>
    </div>
    {visible.length === 0
      ? <p className="rounded-2xl bg-slate-100 p-6 text-center text-sm text-slate-600">{q ? `ไม่พบนักเรียนที่ตรงกับ “${query}”` : "ไม่มีนักเรียนในสถานะที่เลือก"}</p>
      : <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {visible.map(s => <li key={s.id} className="grid gap-2 px-3 py-3 sm:px-4">
          <div className="flex items-start gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold tabular-nums text-slate-700">{s.number ?? "—"}</span>
            <h3 className="min-w-0 flex-1 pt-1 text-base font-bold leading-snug text-slate-900">{s.name}</h3>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pl-11">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
              <span className="font-mono text-slate-500">รหัส {s.code}</span>
              <span className="text-slate-500">ห้อง {s.room}{s.program ? ` ${s.program}` : ""}</span>
              {s.linked
                ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800"><Link2 aria-hidden="true" size={13} />ผูกแล้ว{s.lineName ? ` · ${s.lineName}` : ""}</span>
                : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-900"><Link2Off aria-hidden="true" size={13} />ยังไม่ผูก</span>}
              {s.linked && s.linkedAt && <span className="text-slate-500">เมื่อ {s.linkedAt}</span>}
            </div>
            {s.linked && <form action={unlinkStudentLine} className="shrink-0">
              <input type="hidden" name="studentId" value={s.id} />
              <ConfirmSubmit label="ยกเลิกผูก" title={`ยกเลิกผูก LINE ของ ${s.name}?`} message="นักเรียนต้องเปิดลิงก์ LIFF แล้วผูกบัญชีใหม่ก่อนเช็คชื่อครั้งถัดไป ประวัติการเช็คชื่อเดิมยังอยู่ครบ" confirmLabel="ยืนยันยกเลิกผูก" className="inline-flex min-h-10 items-center rounded-xl border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50" />
            </form>}
          </div>
        </li>)}
      </ul>}
  </div>;
}
