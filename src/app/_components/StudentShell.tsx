import type { ReactNode } from "react";
import { Flag } from "lucide-react";

type Who = { name: string; detail: string };

/** Student-side page frame (LINE in-app browser, phone only): house header, optional student identity, content column. */
export default function StudentShell({ who, children }: { who?: Who; children: ReactNode }) {
  return <main className="mx-auto grid min-h-dvh max-w-md content-start gap-4 bg-slate-50 px-4 pb-10 pt-4">
    <header className="flex items-center gap-3 rounded-2xl bg-violet-700 px-4 py-3 text-white shadow-sm">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15"><Flag aria-hidden="true" size={22} /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-violet-100">คณะสีม่วง · กีฬาสี 2569</p>
        {who ? <><p className="font-bold leading-snug">{who.name}</p><p className="text-sm text-violet-100">{who.detail}</p></> : <p className="font-bold">ระบบเช็คชื่อกีฬาสี</p>}
      </div>
    </header>
    {children}
  </main>;
}
