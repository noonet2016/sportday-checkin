"use client";
import { useRef, useState } from "react";

/**
 * A destructive submit button that asks first in a modal (not window.confirm, not a toast).
 * Checks the surrounding form's validity before opening, then submits that form on confirm.
 */
export default function ConfirmSubmit({ label, title, message, confirmLabel, className }: { label: string; title: string; message: string; confirmLabel: string; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={ref} type="button" className={className} onClick={() => { const form = ref.current?.form; if (form && !form.reportValidity()) return; setOpen(true); }}>{label}</button>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4">
          <div className="grid w-full max-w-sm gap-3 rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-sm text-slate-700 break-words">{message}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded-lg bg-slate-600 px-3 py-2 font-semibold text-white hover:bg-slate-700" onClick={() => setOpen(false)}>ยกเลิก</button>
              <button type="button" className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700" onClick={() => { setOpen(false); ref.current?.form?.requestSubmit(); }}>{confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
