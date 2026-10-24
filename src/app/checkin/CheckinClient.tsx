"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitCheckin } from "./actions";
import type { CheckinGpsSample } from "@/lib/spoof";
import { roleLabel, SPORT_OPTIONS } from "@/lib/event";
import ChoiceWithOther from "@/app/_components/ChoiceWithOther";
import { formatDistance } from "@/lib/geo";
import { CheckCircle2, Clock, Loader2, MapPin, Megaphone, Trophy, XCircle } from "lucide-react";

type Props = { state: string; slotLabel: string | null; remainingMs?: number; existing?: { role: string; checkedInAt: string; distanceM: number | null }; radiusM: number | null };

/** Same wording as lineup: in/out of radius with the measured distance. */
function GeoBadge({ distance, radius }: { distance: number; radius: number }) {
  const outside = distance > radius;
  return <p className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm font-semibold ${outside ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}><MapPin aria-hidden="true" size={15} />{outside ? "เช็คจากนอกรัศมี" : "เช็คจากในรัศมี"} (~{formatDistance(distance)} · กำหนด {formatDistance(radius)})</p>;
}
const MIN_COLLECT_MS = 3000; const MAX_WAIT_MS = 15000; const MIN_SAMPLES = 3;
export default function CheckinClient({ state, slotLabel, remainingMs, existing, radiusM }: Props) {
  const router = useRouter(); const [distance, setDistance] = useState<number | null>(null); const [checkedIn, setCheckedIn] = useState(false);
  const [role, setRole] = useState<"compete" | "cheer">("cheer"); const [sport, setSport] = useState(""); const [busy, setBusy] = useState(false); const [result, setResult] = useState<string | null>(null); const [countdown, setCountdown] = useState("");
  // closesAt is Bangkok wall-clock, not comparable with the phone's Date.now(); count down from the server-computed remainder.
  useEffect(() => { if (state !== "open" || remainingMs === undefined) return; const deadline = Date.now() + remainingMs; const update = () => setCountdown(`${Math.max(0, Math.ceil((deadline - Date.now()) / 60000))} นาที`); update(); const id = setInterval(update, 1000); return () => clearInterval(id); }, [state, remainingMs]);
  async function collectAndSubmit() {
    if (!navigator.geolocation) { setResult("เบราว์เซอร์นี้ไม่รองรับ GPS"); return; } setBusy(true); setResult(null);
    const samples: CheckinGpsSample[] = []; let best: CheckinGpsSample | null = null; let done = false;
    const finish = async (message?: string) => { if (done) return; done = true; navigator.geolocation.clearWatch(watch); clearTimeout(timeout); if (!best) { setResult(message ?? "ระบุตำแหน่ง GPS ไม่ได้ กรุณาอนุญาตให้เข้าถึงตำแหน่งแล้วลองใหม่"); setBusy(false); return; } const answer = await submitCheckin({ role, sport, lat: best.lat, lng: best.lng, accuracy: best.accuracy, samples }); setDistance(answer.distanceM ?? null); setCheckedIn(answer.ok); setResult(answer.message); setBusy(false); };
    const watch = navigator.geolocation.watchPosition((position) => { const c = position.coords; const sample: CheckinGpsSample = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, altitude: c.altitude, altitudeAccuracy: c.altitudeAccuracy, speed: c.speed, heading: c.heading, timestamp: position.timestamp }; samples.push(sample); if (!best || sample.accuracy < best.accuracy) best = sample; if (samples.length >= MIN_SAMPLES && Date.now() - started >= MIN_COLLECT_MS) void finish(); }, (error) => { if (error.code === error.PERMISSION_DENIED) void finish("กรุณาอนุญาตให้เข้าถึงตำแหน่ง (GPS) แล้วลองใหม่"); }, { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT_MS });
    const started = Date.now(); const timeout = setTimeout(() => void finish(), MAX_WAIT_MS);
  }
  if (existing) return <section className="grid justify-items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
    <CheckCircle2 aria-hidden="true" size={56} className="text-emerald-600" />
    <h1 className="text-xl font-bold text-slate-900">เช็คชื่อแล้ว</h1>
    {slotLabel && <p className="text-sm font-semibold text-slate-600">{slotLabel}</p>}
    <p className="text-slate-700">เช็คชื่อเป็น <b className="text-slate-900">{roleLabel(existing.role)}</b><br />เวลา {existing.checkedInAt}</p>
    {existing.distanceM !== null && radiusM !== null && <GeoBadge distance={existing.distanceM} radius={radiusM} />}
  </section>;
  if (state !== "open") return <section className="grid justify-items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
    <Clock aria-hidden="true" size={48} className="text-slate-400" />
    <h1 className="text-xl font-bold text-slate-900">{state === "not-event-day" ? "วันนี้ไม่มีกิจกรรมกีฬาสี" : state === "before" ? "ยังไม่ถึงเวลาเช็คชื่อ" : "หมดเวลาเช็คชื่อแล้ว"}</h1>
    <p className="text-sm text-slate-600">เช็คชื่อได้วันละ 2 รอบ ระหว่างวันที่ 26–30 ตุลาคม 2569</p>
    <div className="flex flex-wrap justify-center gap-2 text-sm font-semibold"><span className="rounded-full bg-violet-100 px-3 py-1 text-violet-800">รอบเช้า 08:00–10:00</span><span className="rounded-full bg-violet-100 px-3 py-1 text-violet-800">รอบบ่าย 13:00–15:00</span></div>
  </section>;
  const ok = result !== null && checkedIn;
  return <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-bold text-slate-900">เช็คชื่อ{slotLabel ? ` · ${slotLabel.split(" ")[0]}` : ""}</h1>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900"><Clock aria-hidden="true" size={15} />เหลือ {countdown}</span>
    </div>
    {slotLabel && <p className="-mt-2 text-sm text-slate-600">{slotLabel}</p>}
    {radiusM !== null && <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900"><MapPin aria-hidden="true" size={18} className="mt-0.5 shrink-0" />ต้องอยู่ในบริเวณโรงเรียน (รัศมี {formatDistance(radiusM)} จากจุดเช็คชื่อ)</p>}
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-semibold text-slate-700">วันนี้มาร่วมกิจกรรมเป็น</legend>
      <div className="grid grid-cols-2 gap-3">
        {([["cheer", "เชียร์", Megaphone], ["compete", "แข่งกีฬา", Trophy]] as const).map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={role === key} onClick={() => setRole(key)} className={`grid min-h-24 justify-items-center content-center gap-1.5 rounded-2xl border-2 text-base font-bold transition-colors motion-reduce:transition-none ${role === key ? "border-violet-700 bg-violet-700 text-white" : "border-slate-200 bg-white text-slate-800 hover:border-violet-300"}`}><Icon aria-hidden="true" size={28} />{label}</button>)}
      </div>
    </fieldset>
    {role === "compete" && <label className="grid gap-1.5 text-sm font-semibold text-slate-700">ชนิดกีฬาที่แข่ง<ChoiceWithOther options={SPORT_OPTIONS} defaultValue={sport} onChange={setSport} placeholder="เลือกชนิดกีฬา" otherPlaceholder="พิมพ์ชนิดกีฬา" /></label>}
    <button type="button" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 text-lg font-bold text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || (role === "compete" && !sport.trim())} onClick={() => void collectAndSubmit()}>{busy ? <><Loader2 aria-hidden="true" size={22} className="animate-spin motion-reduce:animate-none" />กำลังระบุตำแหน่ง GPS…</> : <><MapPin aria-hidden="true" size={22} />ยืนยันเช็คชื่อด้วย GPS</>}</button>
    {distance !== null && radiusM !== null && <p className="rounded-xl bg-slate-100 px-3 py-2 text-center text-sm text-slate-700">คุณอยู่ห่างจากจุดเช็คชื่อ <b>{formatDistance(distance)}</b> (รัศมีที่กำหนด {formatDistance(radiusM)})</p>}
    {result && <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50 p-0 sm:items-center sm:justify-center sm:p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={ok ? "เช็คชื่อสำเร็จ" : "เช็คชื่อไม่สำเร็จ"} className="grid w-full max-w-md justify-items-center gap-3 rounded-t-3xl bg-white p-6 pb-8 text-center shadow-xl sm:rounded-3xl">
        {ok ? <CheckCircle2 aria-hidden="true" size={56} className="text-emerald-600" /> : <XCircle aria-hidden="true" size={56} className="text-rose-600" />}
        <p className="text-lg font-bold text-slate-900">{ok ? "เช็คชื่อสำเร็จ" : "เช็คชื่อไม่สำเร็จ"}</p>
        <p className="text-slate-700">{result}</p>
        <button type="button" className={`mt-2 min-h-12 w-full rounded-2xl px-4 font-bold text-white ${ok ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-700 hover:bg-slate-800"}`} onClick={() => { setResult(null); if (checkedIn) router.refresh(); }}>ปิด</button>
      </div>
    </div>}
  </section>;
}
