import type { ReactNode } from "react";

export function Modal({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl sm:p-6" onClick={e => e.stopPropagation()}>{children}</section>
  </div>;
}
export function Sheet({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-4" role="presentation" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6" onClick={e => e.stopPropagation()}>{children}</section>
  </div>;
}
