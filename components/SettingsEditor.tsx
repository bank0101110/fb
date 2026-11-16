"use client";

import { saveConfigAction } from "@/app/actions";
import type { Config } from "@/lib/types";
import { Field, ListInput, SaveBar, Toggle } from "./form";
import { useDraft } from "./useDraft";

type NumKey = { [K in keyof Config]: Config[K] extends number ? K : never }[keyof Config];

const NUMS: { k: NumKey; label: string; hint?: string; step?: number }[] = [
  { k: "max_post_age_days", label: "อายุโพสต์สูงสุด (วัน)" },
  { k: "run_post_budget", label: "งบโพสต์ต่อรอบ", hint: "โพสต์รวมทุกกลุ่ม" },
  { k: "per_group_min_posts", label: "โพสต์ขั้นต่ำต่อกลุ่ม" },
  { k: "per_group_max_posts", label: "โพสต์สูงสุดต่อกลุ่ม" },
  { k: "stop_after_consecutive_seen", label: "หยุดเมื่อเจอโพสต์เก่าติดกัน", hint: "กันโพสต์ปักหมุด" },
  { k: "max_results_per_product", label: "ผลลัพธ์สูงสุดต่อสินค้า" },
  { k: "min_fit", label: "คะแนนตรงขั้นต่ำ (0-100)" },
  { k: "underpriced_ratio", label: "ธงถูกผิดปกติ ถ้าต่ำกว่า × ราคาตลาด", step: 0.05 },
  { k: "max_images_per_post", label: "รูปสูงสุดที่เปิดดูต่อโพสต์" },
  { k: "new_group_free_runs", label: "กลุ่มใหม่อ่านทุกรอบกี่รอบแรก" },
  { k: "market_report_days", label: "ช่วงรายงานความนิยม (วัน)" },
];

export function SettingsEditor({ initial }: { initial: Config }) {
  const { draft, setDraft, dirty, save } = useDraft(initial, saveConfigAction);
  const set = (patch: Partial<Config>) => setDraft({ ...draft, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <section className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {NUMS.map((n) => (
          <Field key={n.k} label={n.label} hint={n.hint}>
            <input className="field" type="number" step={n.step ?? 1} value={draft[n.k]} onChange={(e) => set({ [n.k]: e.target.value === "" ? "" : Number(e.target.value) } as Partial<Config>)} />
          </Field>
        ))}
        <Field label="การเปิดดูรูปในโพสต์">
          <select className="field" value={draft.view_images} onChange={(e) => set({ view_images: e.target.value as Config["view_images"] })}>
            <option value="shortlist_only">เฉพาะโพสต์ที่ผ่านเงื่อนไขข้อความ</option>
            <option value="none">ไม่เปิดดูรูป</option>
            <option value="all">ทุกโพสต์ (กินโทเค็นมาก)</option>
          </select>
        </Field>
        <div className="flex items-end">
          <Toggle checked={draft.include_no_price} onChange={(v) => set({ include_no_price: v })} label="รวมโพสต์ที่ไม่ระบุราคา" />
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <Field label="คำเตือนภัย" hint="เจอในโพสต์จะติดธงเตือน · คั่นด้วย ,">
          <ListInput rows={2} value={draft.warn_words} onChange={(v) => set({ warn_words: v })} />
        </Field>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-semibold">ระดับกลุ่ม</h2>
          <p className="text-sm text-muted">hit rate = (เจอของ+1) ÷ (โพสต์ที่อ่าน+20) · กลุ่มที่เจอของบ่อยอ่านถี่กว่า</p>
        </div>
        {draft.group_tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-3 gap-4">
            <Field label="ระดับ"><input className="field" value={t.tier} onChange={(e) => set({ group_tiers: draft.group_tiers.map((x, k) => (k === i ? { ...x, tier: e.target.value } : x)) })} /></Field>
            <Field label="hit rate ขั้นต่ำ"><input className="field" type="number" step={0.01} value={t.min_hit_rate} onChange={(e) => set({ group_tiers: draft.group_tiers.map((x, k) => (k === i ? { ...x, min_hit_rate: Number(e.target.value) } : x)) })} /></Field>
            <Field label="อ่านทุกกี่ชั่วโมง"><input className="field" type="number" value={t.interval_hours} onChange={(e) => set({ group_tiers: draft.group_tiers.map((x, k) => (k === i ? { ...x, interval_hours: Number(e.target.value) } : x)) })} /></Field>
          </div>
        ))}
      </section>
      <SaveBar dirty={dirty} onSave={save} />
    </div>
  );
}
