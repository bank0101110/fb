"use client";

import { useRef, useState, useTransition } from "react";
import { deleteImageAction, saveWantedAction, uploadImagesAction } from "@/app/actions";
import type { Wanted } from "@/lib/types";
import { Field, ListInput, SaveBar, Toggle } from "./form";
import { Icon } from "./Icon";
import { useDraft } from "./useDraft";

const blank = (n: number): Wanted => ({
  id: `item-${n}`,
  enabled: true,
  game: "",
  name: "",
  keywords: [],
  must: [],
  nice: [],
  exclude: [],
  transfer: [],
  price: { min: null, max: null, market: null },
  max_post_age_days: null,
  groups: "all",
  notes: "",
});

const num = (s: string) => (s === "" ? null : Number(s));

export function WantedEditor({ initial, images, groupIds, games }: {
  initial: Wanted[]; images: Record<string, string[]>; groupIds: string[]; games: string[];
}) {
  const { draft, setDraft, dirty, save } = useDraft(initial, saveWantedAction);
  const [open, setOpen] = useState<number | null>(initial.length ? null : 0);
  const savedIds = new Set(initial.map((w) => w.id));
  // stable React keys so per-field text state survives deletes
  const [keys, setKeys] = useState(() => initial.map((_, i) => i));
  const nextKey = useRef(initial.length);

  const update = (i: number, patch: Partial<Wanted>) =>
    setDraft(draft.map((w, k) => (k === i ? { ...w, ...patch } : w)));

  return (
    <div className="flex flex-col gap-3">
      <datalist id="games">{games.map((g) => <option key={g} value={g} />)}</datalist>
      {draft.length === 0 && (
        <div className="card p-8 text-center text-muted">ยังไม่มีสินค้า กด "เพิ่มสินค้า" เพื่อเริ่ม</div>
      )}
      {draft.map((w, i) => (
        <section key={keys[i]} className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className={"size-2.5 shrink-0 rounded-full " + (w.enabled ? "bg-success" : "bg-line")} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{w.name || "สินค้าใหม่"}</span>
                <span className="block truncate text-xs text-muted">
                  {w.id} · {w.game || "ไม่ระบุเกม"} · ราคา {w.price.min ?? "–"}–{w.price.max ?? "–"} บาท
                </span>
              </span>
            </button>
            <Toggle checked={w.enabled} onChange={(v) => update(i, { enabled: v })} label={w.enabled ? "กำลังหา" : "ปิด"} />
          </div>

          {open === i && (
            <div className="flex flex-col gap-5 border-t border-elevated px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="id" hint="a-z 0-9 - _ · ใช้เป็นชื่อโฟลเดอร์รูป">
                  <input className="field font-mono" value={w.id} onChange={(e) => update(i, { id: e.target.value.toLowerCase() })} />
                </Field>
                <Field label="เกม">
                  <input className="field" list="games" value={w.game} onChange={(e) => update(i, { game: e.target.value })} />
                </Field>
                <Field label="ชื่อสินค้า">
                  <input className="field" value={w.name} onChange={(e) => update(i, { name: e.target.value })} />
                </Field>
              </div>

              <Field label="คำค้น" hint="คั่นด้วย , หรือขึ้นบรรทัดใหม่ · ใส่ทั้งไทย อังกฤษ คำย่อ">
                <ListInput value={w.keywords} onChange={(v) => update(i, { keywords: v })} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ต้องมี"><ListInput rows={2} value={w.must} onChange={(v) => update(i, { must: v })} /></Field>
                <Field label="มีแล้วดี (ใช้จัดอันดับ)"><ListInput rows={2} value={w.nice} onChange={(v) => update(i, { nice: v })} /></Field>
                <Field label="ห้ามมี / ตัดทิ้ง"><ListInput rows={2} value={w.exclude} onChange={(v) => update(i, { exclude: v })} /></Field>
                <Field label="เงื่อนไขการโอนไอดี"><ListInput rows={2} value={w.transfer} onChange={(v) => update(i, { transfer: v })} /></Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="ราคาต่ำสุด (บาท)">
                  <input className="field" type="number" min={0} value={w.price.min ?? ""} onChange={(e) => update(i, { price: { ...w.price, min: num(e.target.value) } })} />
                </Field>
                <Field label="ราคาสูงสุด (บาท)">
                  <input className="field" type="number" min={0} value={w.price.max ?? ""} onChange={(e) => update(i, { price: { ...w.price, max: num(e.target.value) } })} />
                </Field>
                <Field label="ราคาตลาด (บาท)" hint="ใช้คำนวณ % ถูกกว่าตลาด">
                  <input className="field" type="number" min={0} value={w.price.market ?? ""} onChange={(e) => update(i, { price: { ...w.price, market: num(e.target.value) } })} />
                </Field>
                <Field label="อายุโพสต์สูงสุด (วัน)" hint="ว่าง = ใช้ค่าในตั้งค่า">
                  <input className="field" type="number" min={1} value={w.max_post_age_days ?? ""} onChange={(e) => update(i, { max_post_age_days: num(e.target.value) })} />
                </Field>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="label mb-1.5">กลุ่มที่ต้องหา</legend>
                <div className="flex flex-wrap gap-2">
                  <Chip on={w.groups === "all"} onClick={() => update(i, { groups: "all" })}>ทุกกลุ่ม</Chip>
                  {groupIds.map((g) => {
                    const on = w.groups !== "all" && w.groups.includes(g);
                    return (
                      <Chip
                        key={g}
                        on={on}
                        onClick={() => {
                          const cur = w.groups === "all" ? [] : w.groups;
                          const next = on ? cur.filter((x) => x !== g) : [...cur, g];
                          update(i, { groups: next.length ? next : "all" });
                        }}
                      >
                        {g}
                      </Chip>
                    );
                  })}
                  {groupIds.length === 0 && <span className="text-xs text-muted">ยังไม่มีกลุ่ม — เพิ่มที่หน้า "กลุ่ม Facebook"</span>}
                </div>
              </fieldset>

              <Field label="หมายเหตุ">
                <textarea className="field" rows={2} value={w.notes} onChange={(e) => update(i, { notes: e.target.value })} />
              </Field>

              <Images productId={w.id} files={images[w.id] ?? []} saved={savedIds.has(w.id)} />

              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    if (confirm(`ลบ "${w.name || w.id}"? (ต้องกดบันทึกด้วย)`)) {
                      setDraft(draft.filter((_, k) => k !== i));
                      setKeys(keys.filter((_, k) => k !== i));
                      setOpen(null);
                    }
                  }}
                >
                  <Icon name="trash" size={16} /> ลบสินค้า
                </button>
              </div>
            </div>
          )}
        </section>
      ))}

      <button
        type="button"
        className="btn-ghost self-start"
        onClick={() => {
          setDraft([...draft, blank(draft.length + 1)]);
          setKeys([...keys, nextKey.current++]);
          setOpen(draft.length);
        }}
      >
        <Icon name="plus" size={18} /> เพิ่มสินค้า
      </button>

      <SaveBar dirty={dirty} onSave={save} />
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        "min-h-10 rounded-full border px-4 text-sm " +
        (on ? "border-primary-edge bg-primary-deep font-semibold text-primary-pale" : "border-line text-soft hover:bg-elevated")
      }
    >
      {children}
    </button>
  );
}

function Images({ productId, files, saved }: { productId: string; files: string[]; saved: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <span className="label">รูปอ้างอิง</span>
      <div className="flex flex-wrap gap-3">
        {files.map((f) => (
          <div key={f} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/${productId}/${f}`} alt={f} className="size-24 rounded-xl border border-line object-cover" />
            <button
              type="button"
              aria-label={`ลบรูป ${f}`}
              onClick={() => start(async () => void (await deleteImageAction(productId, f)))}
              className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full border border-line bg-surface text-danger-text"
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
        <label
          className={
            "grid size-24 cursor-pointer place-items-center rounded-xl border border-dashed border-line text-center text-xs text-muted hover:bg-elevated " +
            (!saved ? "pointer-events-none opacity-50" : "")
          }
        >
          <span className="flex flex-col items-center gap-1">
            <Icon name="image" size={20} />
            {pending ? "กำลังอัปโหลด" : "เพิ่มรูป"}
          </span>
          <input
            ref={ref}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            disabled={!saved}
            onChange={(e) => {
              const fd = new FormData();
              Array.from(e.target.files ?? []).forEach((f) => fd.append("files", f));
              start(async () => {
                const r = await uploadImagesAction(productId, fd);
                setErr(r.ok ? "" : r.error);
                if (ref.current) ref.current.value = "";
              });
            }}
          />
        </label>
      </div>
      {!saved && <span className="text-xs text-muted">บันทึกสินค้าก่อน แล้วค่อยเพิ่มรูป</span>}
      {err && <span className="text-xs text-danger-text">{err}</span>}
    </div>
  );
}
