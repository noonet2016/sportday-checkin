"use client";
import { useEffect, useRef, useState } from "react";
import { submitCheckin } from "./actions";
import type { CheckinGpsSample } from "@/lib/spoof";

type Props = { state: string; closesAt?: string; existing?: { role: string; checkedInAt: string } };
const MIN_COLLECT_MS = 3000; const MAX_WAIT_MS = 15000; const MIN_SAMPLES = 3;
export default function CheckinClient({ state, closesAt, existing }: Props) {
  const [role, setRole] = useState<"compete" | "cheer">("compete"); const [sport, setSport] = useState(""); const [busy, setBusy] = useState(false); const [result, setResult] = useState<string | null>(null); const [countdown, setCountdown] = useState(""); const closeMs = useRef(closesAt ? new Date(closesAt).getTime() : 0);
  useEffect(() => { if (state !== "open" || !closeMs.current) return; const update = () => setCountdown(`${Math.max(0, Math.ceil((closeMs.current - Date.now()) / 60000))} min remaining`); update(); const id = setInterval(update, 1000); return () => clearInterval(id); }, [state]);
  async function collectAndSubmit() {
    if (!navigator.geolocation) { setResult("This browser does not support GPS."); return; } setBusy(true); setResult(null);
    const samples: CheckinGpsSample[] = []; let best: CheckinGpsSample | null = null; let done = false;
    const finish = async (message?: string) => { if (done) return; done = true; navigator.geolocation.clearWatch(watch); clearTimeout(timeout); if (!best) { setResult(message ?? "Unable to get a GPS location. Please allow location access and try again."); setBusy(false); return; } const answer = await submitCheckin({ role, sport, lat: best.lat, lng: best.lng, accuracy: best.accuracy, samples }); setResult(answer.message); setBusy(false); };
    const watch = navigator.geolocation.watchPosition((position) => { const c = position.coords; const sample: CheckinGpsSample = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, altitude: c.altitude, altitudeAccuracy: c.altitudeAccuracy, speed: c.speed, heading: c.heading, timestamp: position.timestamp }; samples.push(sample); if (!best || sample.accuracy < best.accuracy) best = sample; if (samples.length >= MIN_SAMPLES && Date.now() - started >= MIN_COLLECT_MS) void finish(); }, (error) => { if (error.code === error.PERMISSION_DENIED) void finish("Location permission is required to check in."); }, { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT_MS });
    const started = Date.now(); const timeout = setTimeout(() => void finish(), MAX_WAIT_MS);
  }
  if (existing) return <section className="card"><h1>Checked in ✅</h1><p>You checked in as <b>{existing.role === "compete" ? "compete 🏃" : "cheer 📣"}</b> at {existing.checkedInAt}.</p><a className="link-button" href="/me">View my week</a></section>;
  if (state !== "open") return <section className="card"><h1>{state === "not-event-day" ? "No Sport Day today" : state === "before" ? "Check-in has not opened" : "This check-in window is closed"}</h1><p>Check-in is available 08:00–10:00 and 13:00–14:00 on 26–30 October.</p></section>;
  return <section className="card"><h1>Sport Day check-in</h1><p className="notice">{countdown}</p><div className="role-grid"><button className={role === "compete" ? "choice active" : "choice"} onClick={() => setRole("compete")}>🏃 Compete</button><button className={role === "cheer" ? "choice active" : "choice"} onClick={() => setRole("cheer")}>📣 Cheer</button></div>{role === "compete" && <label>Sport (optional)<input value={sport} maxLength={100} onChange={(e) => setSport(e.target.value)} placeholder="e.g. football" /></label>}<button className="primary" disabled={busy} onClick={() => void collectAndSubmit()}>{busy ? "Collecting GPS…" : "Confirm check-in with GPS"}</button>{result && <div role="dialog" aria-modal="true" className="result-popup"><p>{result}</p><button className="primary" onClick={() => setResult(null)}>Close</button></div>}</section>;
}
