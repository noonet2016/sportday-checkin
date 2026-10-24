import { loginStaff } from "../actions";
export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="screen"><section className="card"><h1>เข้าสู่ระบบเจ้าหน้าที่</h1><p>ระบบเช็คชื่อกิจกรรมกีฬาสี</p>{error && <p className="error" role="alert">ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</p>}<form action={loginStaff} className="grid gap-4"><label>ชื่อผู้ใช้<input name="username" autoComplete="username" required maxLength={100}/></label><label>รหัสผ่าน<input name="password" type="password" autoComplete="current-password" required/></label><button className="primary" type="submit">เข้าสู่ระบบ</button></form></section></main>;
}
