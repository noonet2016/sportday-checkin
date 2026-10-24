"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Link2, Loader2, Search } from "lucide-react";
import StudentShell from "@/app/_components/StudentShell";
type Phase = "loading" | "bind" | "error";
type Result = { ok: boolean; redirect?: string; error?: string; displayName?: string };
export default function LiffPage() {
  const [phase, setPhase] = useState<Phase>("loading"); const [message, setMessage] = useState("กำลังเชื่อมต่อกับ LINE…"); const [token, setToken] = useState(""); const [studentCode, setStudentCode] = useState(""); const [maskedName, setMaskedName] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { let cancelled = false; void (async () => { try { const liffId = process.env.NEXT_PUBLIC_LIFF_ID; if (!liffId) throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID"); const liff = (await import("@line/liff")).default; await liff.init({ liffId }); if (!liff.isLoggedIn()) { liff.login(); return; } const idToken = liff.getIDToken(); if (!idToken) throw new Error("ไม่ได้รับ ID Token จาก LINE"); setToken(idToken); const response = await fetch("/api/auth/liff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }); const data = await response.json() as Result; if (data.ok && data.redirect) { location.replace(data.redirect); return; } if (data.error === "not_linked") { if (!cancelled) setPhase("bind"); return; } throw new Error(data.error ?? "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ"); } catch (error) { if (!cancelled) { setPhase("error"); setMessage(error instanceof Error ? error.message : "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ"); } } })(); return () => { cancelled = true; }; }, []);
  async function call(path: string) { setBusy(true); try { const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token, studentCode }) }); return await response.json() as Result; } finally { setBusy(false); } }
  async function lookup() { try { const data = await call("/api/auth/liff/lookup"); if (!data.ok) throw new Error(data.error); setMaskedName(data.displayName ?? ""); } catch (error) { setMessage(error instanceof Error ? error.message : "ค้นหาข้อมูลไม่สำเร็จ"); } }
  async function bind() { try { const data = await call("/api/auth/liff/bind"); if (!data.ok || !data.redirect) throw new Error(data.error ?? "ผูกบัญชีไม่สำเร็จ"); location.replace(data.redirect); } catch (error) { setMessage(error instanceof Error ? error.message : "ผูกบัญชีไม่สำเร็จ"); } }
  const showError = phase === "error" || (phase === "bind" && message !== "กำลังเชื่อมต่อกับ LINE…");
  return <StudentShell>
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {phase === "loading" && <div className="grid justify-items-center gap-3 py-6 text-center"><Loader2 aria-hidden="true" size={40} className="animate-spin text-violet-700 motion-reduce:animate-none" /><p className="font-semibold text-slate-700">{message}</p></div>}
      {phase === "bind" && <>
        <div className="grid gap-1"><h1 className="text-xl font-bold text-slate-900">เข้าใช้งานครั้งแรก</h1><p className="text-sm text-slate-600">ผูกบัญชี LINE นี้กับข้อมูลนักเรียนของคุณ ทำครั้งเดียว</p></div>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">รหัสนักเรียน
          <input inputMode="numeric" value={studentCode} onChange={(e) => { setStudentCode(e.target.value); setMaskedName(""); }} placeholder="เช่น 30401" className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-lg font-normal tracking-wider text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200" />
        </label>
        {!maskedName
          ? <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !studentCode.trim()} onClick={() => void lookup()}><Search aria-hidden="true" size={18} />ค้นหาชื่อของฉัน</button>
          : <>
            <div className="grid gap-1 rounded-2xl bg-violet-50 p-4 text-center"><p className="text-sm text-violet-800">ใช่คุณหรือไม่</p><p className="text-lg font-bold text-violet-900">{maskedName}</p></div>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy} onClick={() => void bind()}><Link2 aria-hidden="true" size={18} />ใช่ ผูกบัญชี LINE นี้</button>
            <button className="min-h-12 rounded-2xl bg-slate-700 px-4 font-semibold text-white hover:bg-slate-800" onClick={() => setMaskedName("")}>ไม่ใช่ เปลี่ยนรหัส</button>
          </>}
      </>}
      {showError && <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800"><AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />{message}</p>}
    </section>
  </StudentShell>;
}
