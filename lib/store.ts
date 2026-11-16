import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Config, Group, GroupState, Market, MatchRow, Post, Seen, Wanted } from "./types";

/** All data lives in ./data (committed to git). Override with FB_DATA_DIR. */
export const DATA_DIR = process.env.FB_DATA_DIR
  ? path.resolve(process.env.FB_DATA_DIR)
  : path.join(process.cwd(), "data");

const p = (...a: string[]) => path.join(DATA_DIR, ...a);

export const DEFAULT_CONFIG: Config = {
  timezone_offset: "+07:00",
  max_post_age_days: 3,
  run_post_budget: 200,
  per_group_min_posts: 10,
  per_group_max_posts: 60,
  stop_after_consecutive_seen: 3,
  max_results_per_product: 15,
  min_fit: 60,
  include_no_price: true,
  underpriced_ratio: 0.5,
  view_images: "shortlist_only",
  max_images_per_post: 3,
  warn_words: ["โอนก่อน", "ไม่ผ่านกลาง", "ไม่ใช้คนกลาง", "ด่วนมาก", "เฉพาะวันนี้"],
  group_tiers: [
    { tier: "A", min_hit_rate: 0.05, interval_hours: 0 },
    { tier: "B", min_hit_rate: 0.01, interval_hours: 48 },
    { tier: "C", min_hit_rate: 0, interval_hours: 72 },
  ],
  new_group_free_runs: 3,
  market_report_days: 7,
};

function readJson<T>(file: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  const out: T[] = [];
  for (const line of fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s) as T);
    } catch {
      /* skip a broken line rather than failing the whole page */
    }
  }
  return out;
}

export const getConfig = () => ({ ...DEFAULT_CONFIG, ...readJson<Partial<Config>>(p("config.json"), {}) });
export const getGroups = () => readJson<Group[]>(p("groups.json"), []);
export const getWanted = () => readJson<Wanted[]>(p("wanted.json"), []);
export const getMarket = () => readJson<Market>(p("market.json"), { discover: true, track: [] });
export const getSeen = () => readJson<Seen>(p("state", "seen_posts.json"), {});
export const getGroupState = () => readJson<GroupState>(p("state", "groups_state.json"), {});
export const getLog = () => readJsonl<Post>(p("log", "market_log.jsonl"));

export const saveConfig = (c: Config) => writeJson(p("config.json"), c);
export const saveGroups = (g: Group[]) => writeJson(p("groups.json"), g);
export const saveWanted = (w: Wanted[]) => writeJson(p("wanted.json"), w);
export const saveMarket = (m: Market) => writeJson(p("market.json"), m);

/** Match results written by `fbscan.py ingest` as results/<run_id>_matches.json, newest run first. */
export function getMatchRuns(): { run_id: string; rows: MatchRow[] }[] {
  const dir = p("results");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith("_matches.json"))
    .sort()
    .reverse()
    .map((f) => {
      const run_id = f.replace(/_matches\.json$/, "");
      const rows = readJson<MatchRow[]>(path.join(dir, f), []).map((r) => ({ ...r, run_id }));
      return { run_id, rows };
    });
}

// ---- reference images per wanted product: data/images/<product_id>/<file>
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
export const isSafeName = (s: string) => SAFE.test(s) && !s.includes("..");

export function listImages(productId: string): string[] {
  if (!isSafeName(productId)) return [];
  const dir = p("images", productId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f));
}

export function saveImage(productId: string, fileName: string, bytes: Buffer) {
  if (!isSafeName(productId) || !isSafeName(fileName)) throw new Error("ชื่อไฟล์ไม่ถูกต้อง");
  const dir = p("images", productId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), bytes);
}

export function deleteImage(productId: string, fileName: string) {
  if (!isSafeName(productId) || !isSafeName(fileName)) return;
  const f = p("images", productId, fileName);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

export function readImage(productId: string, fileName: string): Buffer | null {
  if (!isSafeName(productId) || !isSafeName(fileName)) return null;
  const f = p("images", productId, fileName);
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
}
