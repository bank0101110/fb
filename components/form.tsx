"use client";

import { useState, useTransition } from "react";
import type { SaveResult } from "@/app/actions";
import { Icon } from "./Icon";

/** "a, b\nc" -> ["a","b","c"] */
export const toList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
export const fromList = (a: string[] | undefined) => (a ?? []).join(", ");

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-1 pt-1">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Text input bound to a string[] — keeps the raw text while typing, commits parsed list. */
export function ListInput({ value, onChange, placeholder, rows = 1 }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; rows?: number;
}) {
  const [text, setText] = useState(fromList(value));
  const common = {
    value: text,
    placeholder,
    className: "field",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setText(e.target.value);
      onChange(toList(e.target.value));
    },
  };
  return rows > 1 ? <textarea rows={rows} {...common} /> : <input {...common} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-center gap-2.5 text-sm text-soft"
    >
      <span className={"relative h-6 w-11 rounded-full transition-colors " + (checked ? "bg-primary" : "bg-line")}>
        <span className={"absolute top-0.5 size-5 rounded-full bg-white transition-all " + (checked ? "left-[22px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

/** Sticky save bar with status. */
export function SaveBar({ dirty, onSave }: { dirty: boolean; onSave: () => Promise<SaveResult> }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="card sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <span role="status" className={"text-sm " + (msg && !msg.ok ? "text-danger-text" : dirty ? "text-warn" : "text-muted")}>
        {msg && !msg.ok ? msg.text : dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกแล้ว"}
      </span>
      <button
        type="button"
        className="btn-primary"
        disabled={pending || !dirty}
        onClick={() =>
          start(async () => {
            const r = await onSave();
            setMsg(r.ok ? { ok: true, text: "บันทึกแล้ว" } : { ok: false, text: r.error });
          })
        }
      >
        <Icon name="save" size={18} />
        {pending ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </div>
  );
}
