"use client";
import { useEffect, useRef, useState } from "react";
import { submitCheckin } from "./actions";
import type { CheckinGpsSample } from "@/lib/spoof";
import { roleLabel } from "@/lib/event";

type Props = { state: string; closesAt?: string; existing?: { role: string; checkedInAt: string } };
const MIN_COLLECT_MS = 3000; const MAX_WAIT_MS = 15000; const MIN_SAMPLES = 3;
export default function CheckinClient({ state, closesAt, existing }: Props) {
  const [role, setRole] = useState<"compete" | "cheer">("compete"); const [sport, setSport] = useState(""); const [busy, setBusy] = useState(false); const [result, setResult] = useState<string | null>(null); const [countdown, setCountdown] = useState(""); const closeMs = useRef(closesAt ? new Date(closesAt).getTime() : 0);
  useEffect(() => { if (state !== "open" || !closeMs.current) return; const update = () => setCountdown(`${Math.max(0, Math.ceil((closeMs.current - Date.now()) / 60000))} นาที`); update(); const id = setInterval(update, 1000); return () => clearInterval(id); }, [state]);
  async function collectAndSubmit() {
    if (!navigator.geolocation) { setResult("เบราว์เซอร์นี้ไม่รองรับ GPS"); return; } setBusy(true); setResult(null);
    const samples: CheckinGpsSample[] = []; let best: CheckinGpsSample | null = null; let done = false;
    const finish = async (message?: string) => { if (done) return; done = true; navigator.geolocation.clearWatch(watch); clearTimeout(timeout); if (!best) { setResult(message ?? "ระบุตำแหน่ง GPS ไม่ได้ กรุณาอนุญาตให้เข้าถึงตำแหน่งแล้วลองใหม่"); setBusy(false); return; } const answer = await submitCheckin({ role, sport, lat: best.lat, lng: best.lng, accuracy: best.accuracy, samples }); setResult(answer.message); setBusy(false); };
    const watch = navigator.geolocation.watchPosition((position) => { const c = position.coords; const sample: CheckinGpsSample = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, altitude: c.altitude, altitudeAccuracy: c.altitudeAccuracy, speed: c.speed, heading: c.heading, timestamp: position.timestamp }; samples.push(sample); if (!best || sample.accuracy < best.accuracy) best = sample; if (samples.length >= MIN_SAMPLES && Date.now() - started >= MIN_COLLECT_MS) void finish(); }, (error) => { if (error.code === error.PERMISSION_DENIED) void finish("กรุณาอนุญาตให้เข้าถึงตำแหน่ง (GPS) แล้วลองใหม่"); }, { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT_MS });
    const started = Date.now(); const timeout = setTimeout(() => void finish(), MAX_WAIT_MS);
  }
  if (existing) return <section className="card"><h1>เช็คชื่อแล้ว ✅</h1><p>คุณเช็คชื่อเป็น<b>{roleLabel(existing.role)}</b> เมื่อ {existing.checkedInAt}</p><a className="link-button" href="/me">ดูประวัติสัปดาห์นี้</a></section>;
  if (state !== "open") return <section className="card"><h1>{state === "not-event-day" ? "วันนี้ไม่มีกิจกรรมกีฬาสี" : state === "before" ? "ยังไม่ถึงเวลาเช็คชื่อ" : "หมดเวลาเช็คชื่อแล้ว"}</h1><p>เช็คชื่อได้เวลา 08:00–10:00 และ 13:00–14:00 ระหว่างวันที่ 26–30 ตุลาคม</p></section>;
  return <section className="card"><h1>เช็คชื่อกีฬาสี</h1><p className="notice">เหลือเวลาอีก {countdown}</p><div className="role-grid"><button className={role === "compete" ? "choice active" : "choice"} onClick={() => setRole("compete")}>🏃 แข่งกีฬา</button><button className={role === "cheer" ? "choice active" : "choice"} onClick={() => setRole("cheer")}>📣 เชียร์</button></div>{role === "compete" && <label>กีฬา (ไม่บังคับ)<input value={sport} maxLength={100} onChange={(e) => setSport(e.target.value)} placeholder="เช่น ฟุตบอล" /></label>}<button className="primary" disabled={busy} onClick={() => void collectAndSubmit()}>{busy ? "กำลังระบุตำแหน่ง GPS…" : "ยืนยันเช็คชื่อด้วย GPS"}</button>{result && <div role="dialog" aria-modal="true" className="result-popup"><p>{result}</p><button className="primary" onClick={() => setResult(null)}>ปิด</button></div>}</section>;
}
