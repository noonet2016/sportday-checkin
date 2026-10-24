import Link from "next/link";

export default function HomePage() {
  return (
    <main className="screen">
      <section className="card">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">คณะสีม่วง</p>
        <h1 className="text-3xl font-bold">ระบบเช็คชื่อกิจกรรมกีฬาสี</h1>
        <p className="text-slate-700">ระบบเช็คชื่อนักเรียนและเครื่องมือสำหรับครู/เจ้าหน้าที่</p>
        <div className="mt-4 flex flex-col gap-3">
          <Link href="/checkin" className="link-button">เช็คชื่อนักเรียน</Link>
          <Link href="/staff" className="link-button" style={{ background: "#4c1d95" }}>สำหรับครู / เจ้าหน้าที่</Link>
        </div>
      </section>
    </main>
  );
}
