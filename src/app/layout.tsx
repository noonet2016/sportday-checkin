import type { Metadata } from "next";
import "./globals.css";
import { Noto_Sans_Thai } from "next/font/google";

const thai = Noto_Sans_Thai({ subsets: ["thai"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "เช็คชื่อกีฬาสี · สีม่วง",
  description: "ระบบเช็คชื่อกิจกรรมกีฬาสีผ่าน LINE สำหรับนักเรียนสีม่วง",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // LINE's in-app browser (and some extensions) add attributes to <html>/<body> before React hydrates;
    // suppress that one-level attribute mismatch only — children are still checked.
    <html lang="th" suppressHydrationWarning>
      <body className={thai.className} suppressHydrationWarning>{children}</body>
    </html>
  );
}
