"use client";
import { useState } from "react";

export const OTHER = "__other__";

/**
 * Required <select> of fixed options plus "อื่น ๆ"; choosing "อื่น ๆ" reveals a required text box.
 * The final value is posted under `name` (a hidden input), so server actions read one field either way.
 * Controlled use (student page): pass `onChange` to receive the final value.
 */
export default function ChoiceWithOther({ name, options, defaultValue = "", placeholder, otherPlaceholder, onChange, maxLength = 100 }: {
  name?: string; options: readonly string[]; defaultValue?: string; placeholder: string; otherPlaceholder: string; onChange?: (value: string) => void; maxLength?: number;
}) {
  const known = options.includes(defaultValue);
  const [choice, setChoice] = useState(defaultValue === "" ? "" : known ? defaultValue : OTHER);
  const [other, setOther] = useState(known ? "" : defaultValue);
  const value = choice === OTHER ? other.trim() : choice;
  const emit = (nextChoice: string, nextOther: string) => onChange?.(nextChoice === OTHER ? nextOther.trim() : nextChoice);
  return (
    <div className="grid gap-2">
      <select required value={choice} onChange={(event) => { setChoice(event.target.value); emit(event.target.value, other); }} className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900">
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        <option value={OTHER}>อื่น ๆ (ระบุเอง)</option>
      </select>
      {choice === OTHER && <input required maxLength={maxLength} value={other} onChange={(event) => { setOther(event.target.value); emit(OTHER, event.target.value); }} placeholder={otherPlaceholder} className="rounded-lg border border-slate-300 p-2 text-sm" />}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
