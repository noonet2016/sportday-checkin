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
    <html lang="th">
      <body className={thai.className}>{children}</body>
    </html>
  );
}
