import { Noto_Sans_Thai } from "next/font/google";

const thai = Noto_Sans_Thai({ subsets: ["thai"], weight: ["400", "500", "600", "700"], display: "swap" });

export default function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${thai.className} min-h-screen bg-slate-50 pb-20 text-slate-900 md:pb-0`}>{children}</div>;
}
