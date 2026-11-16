"use client";

import { useRef, useState } from "react";
import { saveMarketAction } from "@/app/actions";
import type { Market } from "@/lib/types";
import { Field, ListInput, SaveBar, Toggle } from "./form";
import { Icon } from "./Icon";
import { useDraft } from "./useDraft";

export function MarketEditor({ initial, discovered }: { initial: Market; discovered: { key: string; game: string; posts: number }[] }) {
  const { draft, setDraft, dirty, save } = useDraft(initial, saveMarketAction);
  const [keys, setKeys] = useState(() => initial.track.map((_, i) => i));
  const nextKey = useRef(initial.track.length);
  const tracked = new Set(draft.track.map((t) => t.key));
  const setTrack = (track: Market["track"]) => setDraft({ ...draft, track });
  const add = (key = "", game = "") => {
    setTrack([...draft.track, { key, game, name: "", aliases: [] }]);
    setKeys([...keys, nextKey.current++]);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">ให้ Claude จับรายการใหม่เอง</span>
          <span className="text-sm text-muted">เปิดไว้ = เจอของที่ไม่อยู่ในรายการ จะตั้ง key ใหม่ให้และนับในรายงานด้วย</span>
        </div>
        <Toggle checked={draft.discover} onChange={(v) => setDraft({ ...draft, discover: v })} label={draft.discover ? "เปิด" : "ปิด"} />
      </section>

      <div className="flex flex-col gap-3">
        {draft.track.map((t, i) => (
          <section key={keys[i]} className="card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
            <Field label="key" hint="game:slug">
              <input className="field font-mono" value={t.key} onChange={(e) => setTrack(draft.track.map((x, k) => (k === i ? { ...x, key: e.target.value.toLowerCase() } : x)))} />
            </Field>
            <Field label="ชื่อที่แสดง">
              <input className="field" value={t.name} onChange={(e) => setTrack(draft.track.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
            </Field>
            <Field label="ชื่ออื่นที่คนใช้เรียก" hint="คั่นด้วย ,">
              <ListInput value={t.aliases} onChange={(v) => setTrack(draft.track.map((x, k) => (k === i ? { ...x, aliases: v } : x)))} />
            </Field>
            <div className="flex items-end gap-2">
              <Field label="เกม">
                <input className="field w-32" value={t.game} onChange={(e) => setTrack(draft.track.map((x, k) => (k === i ? { ...x, game: e.target.value } : x)))} />
              </Field>
              <button
                type="button"
                aria-label={`ลบ ${t.key}`}
                className="btn-danger px-3"
                onClick={() => {
                  setTrack(draft.track.filter((_, k) => k !== i));
                  setKeys(keys.filter((_, k) => k !== i));
                }}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          </section>
        ))}
        <button type="button" className="btn-ghost self-start" onClick={() => add()}>
          <Icon name="plus" size={18} /> เพิ่มรายการติดตาม
        </button>
      </div>

      {discovered.filter((d) => !tracked.has(d.key)).length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">รายการที่ Claude เจอเอง</h2>
          <p className="text-sm text-muted">กดเพื่อเพิ่มเข้ารายการติดตาม แล้วตั้งชื่อให้อ่านง่าย</p>
          <div className="flex flex-wrap gap-2">
            {discovered.filter((d) => !tracked.has(d.key)).map((d) => (
              <button key={d.key} type="button" onClick={() => add(d.key, d.game)} className="min-h-10 rounded-full border border-line px-4 text-sm text-soft hover:bg-elevated">
                <span className="font-mono">{d.key}</span> <span className="text-muted">· {d.posts} โพสต์</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <SaveBar dirty={dirty} onSave={save} />
    </div>
  );
}
