import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "เช็คชื่อกีฬาสี · สีม่วง",
  description: "ระบบเช็คชื่อกิจกรรมกีฬาสีผ่าน LINE สำหรับนักเรียนสีม่วง",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
