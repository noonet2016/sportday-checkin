"use client";
import { useActionState, useCallback, useRef, useState } from "react";
import { CheckCircle2, Copy, Save, XCircle } from "lucide-react";
import { Modal } from "../ui/Sheet";
import { updateSlotTimes, type SlotTimesResult } from "../actions";

type Slot = { id: number; period: "morning" | "afternoon"; open: string; close: string };
type Day = { key: string; label: string; slots: Slot[] };

const input = "h-11 w-full rounded-xl border border-slate-300 bg-white px-2 text-base tabular-nums text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200";

/** Admin editor for check-in windows: per day and round, with "copy first day to all", a confirm step and a result popup. */
export default function SlotTimesForm({ days }: { days: Day[] }) {
  const [values, setValues] = useState(() => Object.fromEntries(days.flatMap(d => d.slots.map(s => [s.id, { open: s.open, close: s.close }]))) as Record<number, { open: string; close: string }>);
  const [result, action, pending] = useActionState<SlotTimesResult, FormData>(updateSlotTimes, null);
  const [confirming, setConfirming] = useState(false);
  // Each submit returns a new result object; show it until dismissed.
  const [dismissed, setDismissed] = useState<SlotTimesResult>(null);
  const shown = result && result !== dismissed ? result : null;
  const formRef = useRef<HTMLFormElement>(null);
  const closeConfirm = useCallback(() => setConfirming(false), []);
  const closeResult = useCallback(() => setDismissed(result), [result]);

  const set = (id: number, key: "open" | "close", v: string) => setValues(prev => ({ ...prev, [id]: { ...prev[id], [key]: v } }));
  const copyFirstDay = () => {
    const first = days[0]; if (!first) return;
    setValues(prev => { const next = { ...prev }; for (const d of days) for (const s of d.slots) { const src = first.slots.find(x => x.period === s.period); if (src) next[s.id] = { ...prev[src.id] }; } return next; });
  };

  return <form ref={formRef} action={action} className="grid gap-3">
    <p className="text-sm text-slate-600">แก้เวลาได้ทีละวันทีละรอบ มีผลกับการเช็คชื่อครั้งถัดไปทันที รายการที่เช็คไปแล้วไม่เปลี่ยน</p>
    <div className="grid gap-2">
      {days.map(d => <fieldset key={d.key} className="grid gap-2 rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-sm font-bold text-slate-800">{d.label}</legend>
        {d.slots.map(s => <div key={s.id} className="grid grid-cols-[3.5rem_1fr_auto_1fr] items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{s.period === "morning" ? "เช้า" : "บ่าย"}</span>
          <input type="time" name={`open_${s.id}`} aria-label={`${d.label} ${s.period === "morning" ? "เช้า" : "บ่าย"} เวลาเปิด`} value={values[s.id]?.open ?? ""} onChange={e => set(s.id, "open", e.target.value)} required className={input} />
          <span className="text-slate-500">–</span>
          <input type="time" name={`close_${s.id}`} aria-label={`${d.label} ${s.period === "morning" ? "เช้า" : "บ่าย"} เวลาปิด`} value={values[s.id]?.close ?? ""} onChange={e => set(s.id, "close", e.target.value)} required className={input} />
        </div>)}
      </fieldset>)}
    </div>
    <div className="grid gap-2 sm:flex">
      <button type="button" onClick={copyFirstDay} className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-800 hover:bg-violet-50"><Copy aria-hidden="true" size={16} />ใช้เวลาวันแรกกับทุกวัน</button>
      <button type="button" disabled={pending} onClick={() => { if (formRef.current?.reportValidity()) setConfirming(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-violet-700 px-4 font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"><Save aria-hidden="true" size={18} />{pending ? "กำลังบันทึก…" : "บันทึกช่วงเวลา"}</button>
    </div>
    {confirming && <Modal title="ยืนยันเปลี่ยนช่วงเวลา" onClose={closeConfirm}>
      <div className="grid gap-3">
        <h2 className="text-lg font-bold text-slate-900">ยืนยันเปลี่ยนช่วงเวลาเช็คชื่อ?</h2>
        <p className="text-sm text-slate-700">นักเรียนจะเช็คชื่อได้ตามเวลาใหม่ทันที ระบบบันทึกว่าใครเปลี่ยนและเวลาเดิมไว้</p>
        <div className="flex gap-2">
          <button type="button" onClick={closeConfirm} className="min-h-11 flex-1 rounded-xl bg-slate-700 px-4 font-semibold text-white hover:bg-slate-800">ยกเลิก</button>
          <button type="button" onClick={() => { setConfirming(false); formRef.current?.requestSubmit(); }} className="min-h-11 flex-1 rounded-xl bg-violet-700 px-4 font-semibold text-white hover:bg-violet-800">ยืนยันบันทึก</button>
        </div>
      </div>
    </Modal>}
    {shown && <Modal title={shown.ok ? "บันทึกสำเร็จ" : "บันทึกไม่สำเร็จ"} onClose={closeResult}>
      <div className="grid justify-items-center gap-3 text-center">
        {shown.ok ? <CheckCircle2 aria-hidden="true" size={44} className="text-emerald-600" /> : <XCircle aria-hidden="true" size={44} className="text-rose-600" />}
        <p className="font-bold text-slate-900">{shown.ok ? "บันทึกสำเร็จ" : "บันทึกไม่สำเร็จ"}</p>
        <p className="text-sm text-slate-700">{shown.message}</p>
        <button type="button" onClick={closeResult} className="min-h-11 w-full rounded-xl bg-slate-700 px-4 font-semibold text-white hover:bg-slate-800">ปิด</button>
      </div>
    </Modal>}
  </form>;
}
