"use client";

import { useRef, useState } from "react";
import { saveGroupsAction } from "@/app/actions";
import type { Group } from "@/lib/types";
import { Field, ListInput, SaveBar, Toggle } from "./form";
import { Icon } from "./Icon";
import { useDraft } from "./useDraft";

export type GroupStat = { tier: string; hit: string; ppd: string; lastRead: string; next: string };

export function GroupsEditor({ initial, stats }: { initial: Group[]; stats: Record<string, GroupStat> }) {
  const { draft, setDraft, dirty, save } = useDraft(initial, saveGroupsAction);
  const [keys, setKeys] = useState(() => initial.map((_, i) => i));
  const nextKey = useRef(initial.length);
  const update = (i: number, patch: Partial<Group>) => setDraft(draft.map((g, k) => (k === i ? { ...g, ...patch } : g)));

  return (
    <div className="flex flex-col gap-3">
      {draft.length === 0 && <div className="card p-8 text-center text-muted">ยังไม่มีกลุ่ม กด "เพิ่มกลุ่ม" แล้ววางลิงก์กลุ่ม</div>}
      {draft.map((g, i) => {
        const st = stats[g.id];
        return (
          <section key={keys[i]} className="card flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-[10px] bg-primary-deep font-bold text-primary-pale">{st?.tier ?? "–"}</span>
                <div className="flex flex-col">
                  <span className="font-semibold">{g.id || "กลุ่มใหม่"}</span>
                  <span className="text-xs text-muted">
                    {st ? `${st.ppd} โพสต์/วัน · เจอของ ${st.hit} · อ่านล่าสุด ${st.lastRead} · ${st.next}` : "ยังไม่เคยอ่าน"}
                  </span>
                </div>
              </div>
              <Toggle checked={g.enabled} onChange={(v) => update(i, { enabled: v })} label={g.enabled ? "เปิดอ่าน" : "ปิด"} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <Field label="id">
                <input className="field font-mono" value={g.id} onChange={(e) => update(i, { id: e.target.value.toLowerCase() })} />
              </Field>
              <Field label="ลิงก์กลุ่ม" hint="บัญชี Facebook ในเบราว์เซอร์ของแอป Claude ต้องเป็นสมาชิกกลุ่มนี้">
                <input className="field" placeholder="https://www.facebook.com/groups/..." value={g.url} onChange={(e) => update(i, { url: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="เกมในกลุ่ม" hint="คั่นด้วย ,">
                <ListInput value={g.games} onChange={(v) => update(i, { games: v })} />
              </Field>
              <Field label="วิธีอ่าน">
                <select className="field" value={g.mode} onChange={(e) => update(i, { mode: e.target.value as Group["mode"] })}>
                  <option value="feed">ไล่ฟีดโพสต์ใหม่สุด</option>
                  <option value="search">ค้นหาด้วยคำค้น (ทดลอง)</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  setDraft(draft.filter((_, k) => k !== i));
                  setKeys(keys.filter((_, k) => k !== i));
                }}
              >
                <Icon name="trash" size={16} /> ลบกลุ่ม
              </button>
            </div>
          </section>
        );
      })}
      <button
        type="button"
        className="btn-ghost self-start"
        onClick={() => {
          setDraft([...draft, { id: `group${draft.length + 1}`, url: "", games: [], mode: "feed", enabled: true }]);
          setKeys([...keys, nextKey.current++]);
        }}
      >
        <Icon name="plus" size={18} /> เพิ่มกลุ่ม
      </button>
      <SaveBar dirty={dirty} onSave={save} />
    </div>
  );
}
