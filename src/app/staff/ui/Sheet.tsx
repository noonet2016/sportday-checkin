"use client";
import { useEffect, useRef, type ReactNode } from "react";

function useDialog(onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    ref.current?.querySelector<HTMLElement>("input:not([type=hidden]),select,button")?.focus();
    return () => { document.body.style.overflow = old; document.removeEventListener("keydown", key); };
  }, [onClose]);
  return ref;
}

export function Modal({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl sm:p-6" onClick={e => e.stopPropagation()}>{children}</section>
  </div>;
}
export function Sheet({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  const ref = useDialog(onClose);
  return <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50 md:items-center md:justify-center md:p-4" role="presentation" onClick={onClose}>
    <section ref={ref} role="dialog" aria-modal="true" aria-label={title} className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl md:rounded-2xl md:p-6" onClick={e => e.stopPropagation()}>{children}</section>
  </div>;
}
