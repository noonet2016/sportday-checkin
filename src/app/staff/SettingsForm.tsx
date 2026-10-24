"use client";
import { useActionState, useState } from "react";
import { CheckCircle2, Save, XCircle } from "lucide-react";
import MapPicker, { type MapPoint } from "@/app/_components/MapPicker";
import { Modal } from "./ui/Sheet";
import { saveSettings, type SaveResult } from "./actions";

/** Geofence editor; shows a result popup after saving (success or why it failed). */
export default function SettingsForm({ initial }: { initial: MapPoint }) {
  const [point, setPoint] = useState(initial);
  const [result, action, pending] = useActionState<SaveResult, FormData>(saveSettings, null);
  const [dismissed, setDismissed] = useState<SaveResult>(null);
  const shown = result && result !== dismissed ? result : null;
  return <form action={action} className="grid gap-4">
    <MapPicker value={point} onChange={setPoint} inputNames={{ lat: "lat", lng: "lng", radiusM: "radius" }} />
    <button disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"><Save aria-hidden="true" size={18} />{pending ? "กำลังบันทึก…" : "บันทึกตำแหน่งและรัศมี"}</button>
    {shown && <Modal title={shown.ok ? "บันทึกสำเร็จ" : "บันทึกไม่สำเร็จ"} onClose={() => setDismissed(result)}>
      <div className="grid justify-items-center gap-3 text-center">
        {shown.ok ? <CheckCircle2 aria-hidden="true" size={44} className="text-emerald-600" /> : <XCircle aria-hidden="true" size={44} className="text-rose-600" />}
        <p className="font-bold text-slate-900">{shown.ok ? "บันทึกตำแหน่งและรัศมีแล้ว" : "บันทึกไม่สำเร็จ"}</p>
        <p className="text-sm text-slate-700">{shown.message}</p>
        <button type="button" onClick={() => setDismissed(result)} className="min-h-11 w-full rounded-xl bg-slate-700 px-4 font-semibold text-white hover:bg-slate-800">ปิด</button>
      </div>
    </Modal>}
  </form>;
}
