"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitCheckin } from "./actions";
import type { CheckinGpsSample } from "@/lib/spoof";
import { roleLabel } from "@/lib/event";
import { formatDistance } from "@/lib/geo";

type Props = { state: string; remainingMs?: number; existing?: { role: string; checkedInAt: string; distanceM: number | null }; radiusM: number | null };

/** Same wording as lineup: in/out of radius with the measured distance. */
function GeoBadge({ distance, radius }: { distance: number; radius: number }) {
  const outside = distance > radius;
  return <p className={`rounded-full px-3 py-1 text-center text-sm font-semibold ${outside ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>📍 {outside ? "เช็คจากนอกรัศมี" : "เช็คจากในรัศมี"} (~{formatDistance(distance)} · กำหนด {formatDistance(radius)})</p>;
}
const MIN_COLLECT_MS = 3000; const MAX_WAIT_MS = 15000; const MIN_SAMPLES = 3;
export default function CheckinClient({ state, remainingMs, existing, radiusM }: Props) {
  const router = useRouter(); const [distance, setDistance] = useState<number | null>(null); const [checkedIn, setCheckedIn] = useState(false);
  const [role, setRole] = useState<"compete" | "cheer">("compete"); const [sport, setSport] = useState(""); const [busy, setBusy] = useState(false); const [result, setResult] = useState<string | null>(null); const [countdown, setCountdown] = useState("");
  // closesAt is Bangkok wall-clock, not comparable with the phone's Date.now(); count down from the server-computed remainder.
  useEffect(() => { if (state !== "open" || remainingMs === undefined) return; const deadline = Date.now() + remainingMs; const update = () => setCountdown(`${Math.max(0, Math.ceil((deadline - Date.now()) / 60000))} นาที`); update(); const id = setInterval(update, 1000); return () => clearInterval(id); }, [state, remainingMs]);
  async function collectAndSubmit() {
    if (!navigator.geolocation) { setResult("เบราว์เซอร์นี้ไม่รองรับ GPS"); return; } setBusy(true); setResult(null);
    const samples: CheckinGpsSample[] = []; let best: CheckinGpsSample | null = null; let done = false;
    const finish = async (message?: string) => { if (done) return; done = true; navigator.geolocation.clearWatch(watch); clearTimeout(timeout); if (!best) { setResult(message ?? "ระบุตำแหน่ง GPS ไม่ได้ กรุณาอนุญาตให้เข้าถึงตำแหน่งแล้วลองใหม่"); setBusy(false); return; } const answer = await submitCheckin({ role, sport, lat: best.lat, lng: best.lng, accuracy: best.accuracy, samples }); setDistance(answer.distanceM ?? null); setCheckedIn(answer.ok); setResult(answer.message); setBusy(false); };
    const watch = navigator.geolocation.watchPosition((position) => { const c = position.coords; const sample: CheckinGpsSample = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, altitude: c.altitude, altitudeAccuracy: c.altitudeAccuracy, speed: c.speed, heading: c.heading, timestamp: position.timestamp }; samples.push(sample); if (!best || sample.accuracy < best.accuracy) best = sample; if (samples.length >= MIN_SAMPLES && Date.now() - started >= MIN_COLLECT_MS) void finish(); }, (error) => { if (error.code === error.PERMISSION_DENIED) void finish("กรุณาอนุญาตให้เข้าถึงตำแหน่ง (GPS) แล้วลองใหม่"); }, { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT_MS });
    const started = Date.now(); const timeout = setTimeout(() => void finish(), MAX_WAIT_MS);
  }
  if (existing) return <section className="card"><h1>เช็คชื่อแล้ว ✅</h1><p>คุณเช็คชื่อเป็น<b>{roleLabel(existing.role)}</b> เมื่อ {existing.checkedInAt}</p>{existing.distanceM !== null && radiusM !== null && <GeoBadge distance={existing.distanceM} radius={radiusM} />}<a className="link-button" href="/me">ดูประวัติสัปดาห์นี้</a></section>;
  if (state !== "open") return <section className="card"><h1>{state === "not-event-day" ? "วันนี้ไม่มีกิจกรรมกีฬาสี" : state === "before" ? "ยังไม่ถึงเวลาเช็คชื่อ" : "หมดเวลาเช็คชื่อแล้ว"}</h1><p>เช็คชื่อได้เวลา 08:00–10:00 และ 13:00–14:00 ระหว่างวันที่ 26–30 ตุลาคม</p></section>;
  return <section className="card"><h1>เช็คชื่อกีฬาสี</h1><p className="notice">เหลือเวลาอีก {countdown}</p>{radiusM !== null && <p className="rounded-xl bg-sky-50 px-3 py-2 text-center text-sm font-semibold text-sky-900">📍 ต้องอยู่ในบริเวณโรงเรียน (รัศมี {formatDistance(radiusM)} จากจุดเช็คชื่อ)</p>}<div className="role-grid"><button className={role === "compete" ? "choice active" : "choice"} onClick={() => setRole("compete")}>🏃 แข่งกีฬา</button><button className={role === "cheer" ? "choice active" : "choice"} onClick={() => setRole("cheer")}>📣 เชียร์</button></div>{role === "compete" && <label>กีฬา (ไม่บังคับ)<input value={sport} maxLength={100} onChange={(e) => setSport(e.target.value)} placeholder="เช่น ฟุตบอล" /></label>}<button className="primary" disabled={busy} onClick={() => void collectAndSubmit()}>{busy ? "กำลังระบุตำแหน่ง GPS…" : "ยืนยันเช็คชื่อด้วย GPS"}</button>{distance !== null && radiusM !== null && <p className="rounded-xl bg-sky-50 px-3 py-2 text-center text-sm text-sky-900">📍 คุณอยู่ห่างจากจุดเช็คชื่อ <b>{formatDistance(distance)}</b><br />(รัศมีที่กำหนด {formatDistance(radiusM)})</p>}{result && <div role="dialog" aria-modal="true" className="result-popup"><p>{result}</p><button className="primary" onClick={() => { setResult(null); if (checkedIn) router.refresh(); }}>ปิด</button></div>}</section>;
}
