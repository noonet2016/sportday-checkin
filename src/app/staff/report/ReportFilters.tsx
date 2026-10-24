"use client";
import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type RoomOption = { key: string; label: string };

/** Room picker + student search that apply as you go (no submit button); same ?room=&q= params as before. */
export default function ReportFilters({ rooms, roomCount, pickedKey, q }: { rooms: RoomOption[]; roomCount: number; pickedKey: string; q: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const roomRef = useRef<HTMLSelectElement>(null);
  const qRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const apply = () => {
    if (timer.current) clearTimeout(timer.current);
    const params = new URLSearchParams();
    const room = roomRef.current?.value ?? "";
    const text = qRef.current?.value.trim() ?? "";
    if (room) params.set("room", room);
    if (text) params.set("q", text);
    const query = params.toString();
    startTransition(() => router.replace(`/staff/report${query ? `?${query}` : ""}`, { scroll: false }));
  };
  const applySoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(apply, 400);
  };
  const clear = () => {
    if (roomRef.current) roomRef.current.value = "";
    if (qRef.current) qRef.current.value = "";
    apply();
  };

  return <form role="search" onSubmit={e => { e.preventDefault(); apply(); }} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:grid-cols-[minmax(12rem,16rem)_1fr_auto] md:items-end">
    {rooms.length > 1 && (
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">ห้อง
        <select ref={roomRef} name="room" defaultValue={pickedKey} onChange={apply} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200">
          <option value="">ทุกห้อง ({roomCount} ห้อง)</option>
          {rooms.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </label>
    )}
    <label className={`grid gap-1.5 text-sm font-semibold text-slate-700 ${rooms.length > 1 ? "" : "md:col-span-2"}`}>
      <span className="flex items-center justify-between gap-2">ค้นหานักเรียน{pending && <span className="text-xs font-normal text-violet-700" aria-live="polite">กำลังค้นหา…</span>}</span>
      <span className="relative block">
        <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input ref={qRef} name="q" type="search" defaultValue={q} onChange={applySoon} placeholder="พิมพ์ชื่อ นามสกุล หรือเลขประจำตัว — แสดงผลทันที" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-base font-normal text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200" />
      </span>
    </label>
    {(q || pickedKey) && <button type="button" onClick={clear} className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-xl bg-slate-700 px-4 font-semibold text-white hover:bg-slate-800">ล้างตัวกรอง</button>}
  </form>;
}
