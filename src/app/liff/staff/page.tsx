"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Link2, Loader2, ShieldCheck } from "lucide-react";
import StudentShell from "@/app/_components/StudentShell";

type Result = { ok: boolean; redirect?: string; error?: string; displayName?: string };

/** Teacher sign-in inside LINE (opened as liff.line.me/<LIFF_ID>/staff). First time: username+password once to link this LINE. */
export default function StaffLiffPage() {
  const [phase, setPhase] = useState<"loading" | "bind" | "error">("loading");
  const [message, setMessage] = useState("กำลังเชื่อมต่อกับ LINE…");
  const [token, setToken] = useState(""); const [lineName, setLineName] = useState("");
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { let cancelled = false; void (async () => { try {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID; if (!liffId) throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID");
    const liff = (await import("@line/liff")).default; await liff.init({ liffId }); if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return; }
    const idToken = liff.getIDToken(); if (!idToken) throw new Error("ไม่ได้รับ ID Token จาก LINE"); setToken(idToken);
    const data = await (await fetch("/api/auth/liff/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) })).json() as Result;
    if (data.ok && data.redirect) { location.replace(data.redirect); return; }
    if (data.error === "not_linked") { if (!cancelled) { setLineName(data.displayName ?? ""); setPhase("bind"); } return; }
    throw new Error("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
  } catch (e) { if (!cancelled) { setPhase("error"); setMessage(e instanceof Error ? e.message : "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ"); } } })(); return () => { cancelled = true; }; }, []);
  async function bind(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const data = await (await fetch("/api/auth/liff/staff/bind", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token, username, password }) })).json() as Result; if (data.ok && data.redirect) { location.replace(data.redirect); return; } setError(data.error ?? "ผูกบัญชีไม่สำเร็จ"); }
    catch { setError("ผูกบัญชีไม่สำเร็จ"); } finally { setBusy(false); }
  }
  const field = "h-12 rounded-xl border border-slate-300 bg-white px-3 text-base font-normal text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200";
  return <StudentShell>
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {phase === "loading" && <div className="grid justify-items-center gap-3 py-6 text-center"><Loader2 aria-hidden="true" size={40} className="animate-spin text-violet-700 motion-reduce:animate-none" /><p className="font-semibold text-slate-700">{message}</p></div>}
      {phase === "error" && <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800"><AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />{message}</p>}
      {phase === "bind" && <form onSubmit={bind} className="grid gap-4">
        <div className="grid gap-1"><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><ShieldCheck aria-hidden="true" size={22} className="text-violet-700" />เข้าสู่ระบบครู</h1><p className="text-sm text-slate-600">ครั้งแรก: ใส่ชื่อผู้ใช้และรหัสผ่านครูหนึ่งครั้ง เพื่อผูกกับ LINE{lineName ? ` “${lineName}”` : ""} ครั้งต่อไปเปิดจาก LINE แล้วเข้าได้ทันที</p></div>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">ชื่อผู้ใช้<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" placeholder="เช่น teacher214" required className={field} /></label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">รหัสผ่าน<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required className={field} /></label>
        <button disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"><Link2 aria-hidden="true" size={18} />{busy ? "กำลังผูกบัญชี…" : "เข้าสู่ระบบและผูก LINE"}</button>
        {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800"><AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />{error}</p>}
      </form>}
    </section>
  </StudentShell>;
}
