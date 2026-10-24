"use client";
import { useCallback, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Sheet } from "./Sheet";

/** Button that opens server-rendered forms in a bottom sheet (dialog on md+); closes once a form inside submits. */
export default function SheetTrigger({ label, title, subtitle, className, children }: { label: ReactNode; title: string; subtitle?: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <>
    <button type="button" onClick={() => setOpen(true)} className={className ?? "inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800"}>{label}</button>
    {open && <Sheet title={title} onClose={close}>
      <div onSubmitCapture={() => setTimeout(close, 0)} className="grid gap-3">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="min-w-0">
            <h2 className="break-words text-base font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
          </div>
          <button type="button" onClick={close} aria-label="ปิด" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-white hover:bg-slate-800"><X size={20} /></button>
        </div>
        {children}
      </div>
    </Sheet>}
  </>;
}
