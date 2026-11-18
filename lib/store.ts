import "server-only";
import { prisma } from "./db";
import type { Prisma } from "./generated/prisma/client";
import type { Config, Group, GroupState, Market, MatchRow, Post, Seen, Wanted } from "./types";

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

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);
const json = (v: unknown) => v as Prisma.InputJsonValue;

// ---------------------------------------------------------------- settings
export async function getConfig(): Promise<Config> {
  const s = await prisma.setting.findUnique({ where: { id: 1 } });
  return { ...DEFAULT_CONFIG, ...((s?.config as Partial<Config>) ?? {}) };
}
export async function saveConfig(c: Config) {
  await prisma.setting.upsert({ where: { id: 1 }, create: { id: 1, config: json(c) }, update: { config: json(c) } });
}

// ---------------------------------------------------------------- groups
export async function getGroups(): Promise<Group[]> {
  const rows = await prisma.group.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  return rows.map((g) => ({ id: g.id, url: g.url, games: g.games, mode: g.mode === "search" ? "search" : "feed", enabled: g.enabled }));
}
export async function saveGroups(list: Group[]) {
  await prisma.$transaction([
    prisma.group.deleteMany({ where: { id: { notIn: list.map((g) => g.id) } } }),
    ...list.map((g, i) =>
      prisma.group.upsert({
        where: { id: g.id },
        create: { ...g, position: i },
        update: { url: g.url, games: g.games, mode: g.mode, enabled: g.enabled, position: i },
      }),
    ),
  ]);
}

// ---------------------------------------------------------------- wanted
export async function getWanted(): Promise<Wanted[]> {
  const rows = await prisma.wanted.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  return rows.map((w) => ({
    id: w.id, enabled: w.enabled, game: w.game, name: w.name,
    keywords: w.keywords, must: w.must, nice: w.nice, exclude: w.exclude, transfer: w.transfer,
    price: { min: w.priceMin, max: w.priceMax, market: w.priceMarket },
    max_post_age_days: w.maxPostAgeDays,
    groups: Array.isArray(w.groups) ? (w.groups as string[]) : "all",
    notes: w.notes,
  }));
}
export async function saveWanted(list: Wanted[]) {
  const data = (w: Wanted, i: number) => ({
    enabled: w.enabled, game: w.game, name: w.name, keywords: w.keywords, must: w.must, nice: w.nice,
    exclude: w.exclude, transfer: w.transfer, priceMin: w.price.min, priceMax: w.price.max,
    priceMarket: w.price.market, maxPostAgeDays: w.max_post_age_days, groups: json(w.groups), notes: w.notes, position: i,
  });
  await prisma.$transaction([
    prisma.wanted.deleteMany({ where: { id: { notIn: list.map((w) => w.id) } } }),
    ...list.map((w, i) => prisma.wanted.upsert({ where: { id: w.id }, create: { id: w.id, ...data(w, i) }, update: data(w, i) })),
  ]);
}

// ---------------------------------------------------------------- market
export async function getMarket(): Promise<Market> {
  const [s, track] = await Promise.all([
    prisma.setting.findUnique({ where: { id: 1 } }),
    prisma.trackItem.findMany({ orderBy: [{ position: "asc" }, { key: "asc" }] }),
  ]);
  return { discover: s?.discover ?? true, track: track.map((t) => ({ key: t.key, game: t.game, name: t.name, aliases: t.aliases })) };
}
export async function saveMarket(m: Market) {
  await prisma.$transaction([
    prisma.setting.upsert({ where: { id: 1 }, create: { id: 1, config: json(DEFAULT_CONFIG), discover: m.discover }, update: { discover: m.discover } }),
    prisma.trackItem.deleteMany({ where: { key: { notIn: m.track.map((t) => t.key) } } }),
    ...m.track.map((t, i) =>
      prisma.trackItem.upsert({ where: { key: t.key }, create: { ...t, position: i }, update: { game: t.game, name: t.name, aliases: t.aliases, position: i } }),
    ),
  ]);
}

// ---------------------------------------------------------------- posts / state (read side, for the dashboard)
/** Posts seen within the last `days` days (by post time, falling back to first seen). */
export async function getLog(days = 60): Promise<Post[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.post.findMany({
    where: { OR: [{ postedAt: { gte: since } }, { postedAt: null, firstSeen: { gte: since } }] },
  });
  return rows.map(toPost);
}
export async function getSeen(days = 60): Promise<Seen> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.post.findMany({
    where: { OR: [{ postedAt: { gte: since } }, { soldAt: { not: null } }] },
    select: { postId: true, group: true, url: true, postedAt: true, firstSeen: true, kind: true, items: true, reported: true, soldAt: true },
  });
  return Object.fromEntries(
    rows.map((r) => [r.postId, {
      group: r.group, url: r.url ?? undefined, posted_at: iso(r.postedAt), first_seen: r.firstSeen.toISOString(),
      kind: r.kind ?? undefined, items: r.items, reported: r.reported, sold_at: iso(r.soldAt) ?? null,
    }]),
  );
}
export function toPost(r: Awaited<ReturnType<typeof prisma.post.findFirstOrThrow>>): Post {
  return {
    post_id: r.postId, group: r.group, url: r.url ?? undefined, author: r.author ?? undefined, author_url: r.authorUrl ?? undefined,
    posted_at: iso(r.postedAt), posted_at_raw: r.postedAtRaw ?? undefined, kind: (r.kind as Post["kind"]) ?? undefined,
    game: r.game ?? undefined, items: r.items, attrs: r.attrs, price: r.price, comments: r.comments, reactions: r.reactions,
    text: r.text ?? undefined, matches: (r.matches as Post["matches"]) ?? undefined, seen_at: r.firstSeen.toISOString(), run_id: r.runId ?? undefined,
  };
}

export async function getGroupState(): Promise<GroupState> {
  const rows = await prisma.groupState.findMany();
  return Object.fromEntries(
    rows.map((s) => [s.groupId, {
      runs: s.runs, posts_read: s.postsRead, matches: s.matches, recent_post_ids: s.recentPostIds,
      last_read_at: iso(s.lastReadAt), newest_post_at: iso(s.newestPostAt), posts_per_day: s.postsPerDay ?? undefined,
      last_stop_reason: s.lastStopReason ?? undefined,
    }]),
  );
}

export async function getMatchRuns(limitRuns = 20): Promise<{ run_id: string; rows: MatchRow[] }[]> {
  const runs = await prisma.matchResult.findMany({ distinct: ["runId"], select: { runId: true }, orderBy: { runId: "desc" }, take: limitRuns });
  const rows = await prisma.matchResult.findMany({ where: { runId: { in: runs.map((r) => r.runId) } }, orderBy: [{ runId: "desc" }, { product: "asc" }, { rank: "asc" }] });
  return runs.map(({ runId }) => ({
    run_id: runId,
    rows: rows.filter((r) => r.runId === runId).map((r) => ({
      product: r.product, rank: r.rank, fit: r.fit, post_url: r.postUrl, group: r.group, author: r.author, author_url: r.authorUrl,
      price: r.price, cheaper_than_market_pct: r.cheaperPct, posted_at: iso(r.postedAt) ?? null,
      has: r.has, missing: r.missing, nice_found: r.niceFound, flags: r.flags, note: r.note, run_id: r.runId,
    })),
  }));
}

// ---------------------------------------------------------------- images
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
export const isSafeName = (s: string) => SAFE.test(s) && !s.includes("..");

export async function listImages(productIds: string[]): Promise<Record<string, string[]>> {
  const rows = await prisma.image.findMany({ where: { productId: { in: productIds } }, select: { productId: true, fileName: true }, orderBy: { id: "asc" } });
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.productId] ??= []).push(r.fileName);
  return out;
}
export async function saveImage(productId: string, fileName: string, mime: string, bytes: Buffer) {
  if (!isSafeName(productId) || !isSafeName(fileName)) throw new Error("ชื่อไฟล์ไม่ถูกต้อง");
  await prisma.image.create({ data: { productId, fileName, mime, data: new Uint8Array(bytes) } });
}
export async function deleteImage(productId: string, fileName: string) {
  await prisma.image.deleteMany({ where: { productId, fileName } });
}
export async function readImage(productId: string, fileName: string) {
  if (!isSafeName(productId) || !isSafeName(fileName)) return null;
  return prisma.image.findUnique({ where: { productId_fileName: { productId, fileName } } });
}
