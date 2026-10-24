import { loginStaff } from "../actions";
import { House } from "lucide-react";
export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="grid min-h-[100dvh] place-items-center bg-slate-50 px-4 py-8"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
    <div className="mb-5 flex justify-center"><span className="grid size-14 place-items-center rounded-full bg-violet-700 text-white"><House size={26} aria-hidden="true"/></span></div>
    <h1 className="text-center text-xl font-bold text-slate-900">เข้าสู่ระบบเจ้าหน้าที่</h1><p className="mt-2 text-center text-sm text-slate-600">ระบบเช็คชื่อกิจกรรมกีฬาสี · สีม่วง</p>
    {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800" role="alert">ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</p>}
    <form action={loginStaff} className="mt-6 grid gap-4"><label className="grid gap-1.5 text-sm font-semibold text-slate-800">ชื่อผู้ใช้<input className="min-h-12 rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-violet-700 focus:ring-2 focus:ring-violet-200" name="username" autoComplete="username" required maxLength={100}/></label><label className="grid gap-1.5 text-sm font-semibold text-slate-800">รหัสผ่าน<input className="min-h-12 rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-violet-700 focus:ring-2 focus:ring-violet-200" name="password" type="password" autoComplete="current-password" required/></label><button className="mt-1 min-h-12 rounded-xl bg-violet-700 px-4 font-bold text-white hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-800" type="submit">เข้าสู่ระบบ</button></form>
  </section></main>;
}
