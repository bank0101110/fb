"use server";

import { revalidatePath } from "next/cache";
import {
  DEFAULT_CONFIG, deleteImage, isSafeName, saveConfig, saveGroups, saveImage, saveMarket, saveWanted,
} from "@/lib/store";
import type { Config, Group, Market, Wanted } from "@/lib/types";

export type SaveResult = { ok: true } | { ok: false; error: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strList = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map(str).filter(Boolean))] : [];
const numOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const ID = /^[a-z0-9][a-z0-9_-]{0,40}$/;

function uniqueIds(ids: string[], what: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!ID.test(id)) return `${what} id "${id}" ใช้ได้แค่ a-z 0-9 - _ (ขึ้นต้นด้วยตัวอักษรหรือตัวเลข)`;
    if (seen.has(id)) return `${what} id "${id}" ซ้ำกัน`;
    seen.add(id);
  }
  return null;
}

export async function saveWantedAction(list: Wanted[]): Promise<SaveResult> {
  const clean: Wanted[] = list.map((w) => ({
    id: str(w.id).toLowerCase(),
    enabled: !!w.enabled,
    game: str(w.game),
    name: str(w.name),
    keywords: strList(w.keywords),
    must: strList(w.must),
    nice: strList(w.nice),
    exclude: strList(w.exclude),
    transfer: strList(w.transfer),
    price: { min: numOrNull(w.price?.min), max: numOrNull(w.price?.max), market: numOrNull(w.price?.market) },
    max_post_age_days: numOrNull(w.max_post_age_days),
    groups: w.groups === "all" || !Array.isArray(w.groups) || w.groups.length === 0 ? "all" : strList(w.groups),
    notes: str(w.notes),
  }));
  const err = uniqueIds(clean.map((w) => w.id), "สินค้า");
  if (err) return { ok: false, error: err };
  const bad = clean.find((w) => !w.name || !w.game);
  if (bad) return { ok: false, error: `สินค้า "${bad.id}" ต้องมีชื่อและเกม` };
  await saveWanted(clean);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveGroupsAction(list: Group[]): Promise<SaveResult> {
  const clean: Group[] = list.map((g) => ({
    id: str(g.id).toLowerCase(),
    url: str(g.url),
    games: strList(g.games),
    mode: g.mode === "search" ? "search" : "feed",
    enabled: !!g.enabled,
  }));
  const err = uniqueIds(clean.map((g) => g.id), "กลุ่ม");
  if (err) return { ok: false, error: err };
  const bad = clean.find((g) => !/^https:\/\/(www\.|m\.)?facebook\.com\/groups\/[^/\s]+/.test(g.url));
  if (bad) return { ok: false, error: `ลิงก์กลุ่ม "${bad.id}" ต้องเป็น https://www.facebook.com/groups/...` };
  await saveGroups(clean);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveMarketAction(m: Market): Promise<SaveResult> {
  const track = (m.track ?? []).map((t) => ({
    key: str(t.key).toLowerCase(),
    game: str(t.game),
    name: str(t.name),
    aliases: strList(t.aliases),
  }));
  const keys = new Set<string>();
  for (const t of track) {
    if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(t.key)) return { ok: false, error: `key "${t.key}" ต้องเป็นรูปแบบ game:slug เช่น rov:conqueror-id` };
    if (keys.has(t.key)) return { ok: false, error: `key "${t.key}" ซ้ำกัน` };
    keys.add(t.key);
  }
  await saveMarket({ discover: !!m.discover, track });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveConfigAction(c: Config): Promise<SaveResult> {
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : d);
  const D = DEFAULT_CONFIG;
  const clean: Config = {
    ...D,
    ...c,
    max_post_age_days: n(c.max_post_age_days, D.max_post_age_days),
    run_post_budget: n(c.run_post_budget, D.run_post_budget),
    per_group_min_posts: n(c.per_group_min_posts, D.per_group_min_posts),
    per_group_max_posts: n(c.per_group_max_posts, D.per_group_max_posts),
    stop_after_consecutive_seen: n(c.stop_after_consecutive_seen, D.stop_after_consecutive_seen),
    max_results_per_product: n(c.max_results_per_product, D.max_results_per_product),
    min_fit: n(c.min_fit, D.min_fit),
    include_no_price: !!c.include_no_price,
    underpriced_ratio: n(c.underpriced_ratio, D.underpriced_ratio),
    view_images: ["shortlist_only", "none", "all"].includes(c.view_images) ? c.view_images : D.view_images,
    max_images_per_post: n(c.max_images_per_post, D.max_images_per_post),
    warn_words: strList(c.warn_words),
    group_tiers: (c.group_tiers?.length ? c.group_tiers : D.group_tiers).map((t) => ({
      tier: str(t.tier) || "?",
      min_hit_rate: n(t.min_hit_rate, 0),
      interval_hours: n(t.interval_hours, 0),
    })),
    new_group_free_runs: n(c.new_group_free_runs, D.new_group_free_runs),
    market_report_days: n(c.market_report_days, D.market_report_days),
  };
  if (clean.per_group_min_posts > clean.per_group_max_posts)
    return { ok: false, error: "โพสต์ขั้นต่ำต่อกลุ่ม ต้องไม่มากกว่าขั้นสูงสุด" };
  await saveConfig(clean);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uploadImagesAction(productId: string, form: FormData): Promise<SaveResult> {
  if (!isSafeName(productId)) return { ok: false, error: "บันทึกสินค้าก่อนอัปโหลดรูป" };
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of files) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return { ok: false, error: `${f.name}: รองรับแค่ png/jpg/webp/gif` };
    if (f.size > 3 * 1024 * 1024) return { ok: false, error: `${f.name}: ใหญ่เกิน 3MB` };
    const ext = f.type === "image/jpeg" ? "jpg" : f.type.split("/")[1];
    const base = f.name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "img";
    try {
      await saveImage(productId, `${base}-${Date.now().toString(36)}.${ext}`, f.type, Buffer.from(await f.arrayBuffer()));
    } catch {
      return { ok: false, error: "บันทึกสินค้าก่อนอัปโหลดรูป" };
    }
  }
  revalidatePath("/wanted");
  return { ok: true };
}

export async function deleteImageAction(productId: string, file: string): Promise<SaveResult> {
  await deleteImage(productId, file);
  revalidatePath("/wanted");
  return { ok: true };
}
