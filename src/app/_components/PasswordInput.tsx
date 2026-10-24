"use client";
import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

const base = "min-h-12 w-full rounded-xl border border-slate-300 bg-white pl-3 pr-12 text-base font-normal text-slate-900 outline-none focus:border-violet-700 focus:ring-2 focus:ring-violet-200";

/** Password field with a show/hide eye button; every other input prop passes through. */
export default function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return <span className="relative block">
    <input {...props} type={visible ? "text" : "password"} className={className ?? base} />
    <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={visible} title={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
      className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center rounded-r-xl text-slate-500 hover:text-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700">
      {visible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
    </button>
  </span>;
}
