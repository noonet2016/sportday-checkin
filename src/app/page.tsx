import Link from "next/link";
import { MapPin, ShieldCheck } from "lucide-react";
import StudentShell from "@/app/_components/StudentShell";

export default function HomePage() {
  return (
    <StudentShell>
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">ระบบเช็คชื่อกิจกรรมกีฬาสี</h1>
        <p className="text-slate-600">นักเรียนเช็คชื่อผ่าน LINE วันละ 2 รอบ · ครูและเจ้าหน้าที่ดูผลและบันทึกแทน</p>
        <Link href="/checkin" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 text-lg font-bold text-white no-underline hover:bg-violet-800"><MapPin aria-hidden="true" size={22} />เช็คชื่อนักเรียน</Link>
        <Link href="/staff" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-violet-300 bg-white px-4 font-semibold text-violet-800 no-underline hover:bg-violet-50"><ShieldCheck aria-hidden="true" size={18} />สำหรับครู / เจ้าหน้าที่</Link>
      </section>
    </StudentShell>
  );
}
