/**
 * One-off: copy the old file-based data/ folder into the database.
 *   npx tsx scripts/import-local.ts [path/to/data]
 * Needs DATABASE_URL in .env. Safe to re-run (upserts; match results are replaced per run).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const dir = path.resolve(process.argv[2] ?? "data");
const read = <T>(f: string, d: T): T => {
  const p = path.join(dir, f);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")) as T) : d;
};
const date = (s?: string | null) => (s ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}+07:00`) : null);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const config = read<Record<string, unknown>>("config.json", {});
  const market = read<{ discover: boolean; track: { key: string; game: string; name: string; aliases: string[] }[] }>("market.json", { discover: true, track: [] });
  await prisma.setting.upsert({ where: { id: 1 }, create: { id: 1, config: config as object, discover: market.discover }, update: { config: config as object, discover: market.discover } });

  const groups = read<{ id: string; url: string; games: string[]; mode: string; enabled: boolean }[]>("groups.json", []);
  for (const [i, g] of groups.entries())
    await prisma.group.upsert({ where: { id: g.id }, create: { ...g, position: i }, update: { ...g, position: i } });

  type W = { id: string; enabled: boolean; game: string; name: string; keywords: string[]; must: string[]; nice: string[]; exclude: string[]; transfer: string[]; price: { min: number | null; max: number | null; market: number | null }; max_post_age_days: number | null; groups: unknown; notes: string };
  for (const [i, w] of read<W[]>("wanted.json", []).entries()) {
    const data = { enabled: w.enabled, game: w.game, name: w.name, keywords: w.keywords, must: w.must, nice: w.nice, exclude: w.exclude, transfer: w.transfer,
      priceMin: w.price.min, priceMax: w.price.max, priceMarket: w.price.market, maxPostAgeDays: w.max_post_age_days, groups: (w.groups ?? "all") as object, notes: w.notes ?? "", position: i };
    await prisma.wanted.upsert({ where: { id: w.id }, create: { id: w.id, ...data }, update: data });
  }
  for (const [i, t] of market.track.entries())
    await prisma.trackItem.upsert({ where: { key: t.key }, create: { ...t, position: i }, update: { ...t, position: i } });

  const state = read<Record<string, { runs: number; posts_read: number; matches: number; recent_post_ids: string[]; last_read_at?: string; newest_post_at?: string; posts_per_day?: number; last_stop_reason?: string }>>("state/groups_state.json", {});
  for (const [g, s] of Object.entries(state)) {
    const data = { runs: s.runs, postsRead: s.posts_read, matches: s.matches, recentPostIds: s.recent_post_ids ?? [], lastReadAt: date(s.last_read_at), newestPostAt: date(s.newest_post_at), postsPerDay: s.posts_per_day ?? null, lastStopReason: s.last_stop_reason ?? null };
    await prisma.groupState.upsert({ where: { groupId: g }, create: { groupId: g, ...data }, update: data });
  }

  const seen = read<Record<string, { reported: string[]; sold_at: string | null; first_seen: string }>>("state/seen_posts.json", {});
  const logFile = path.join(dir, "log", "market_log.jsonl");
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
  let posts = 0;
  for (const p of log) {
    const s = seen[String(p.post_id)];
    const data = { group: p.group, url: p.url ?? null, author: p.author ?? null, authorUrl: p.author_url ?? null, postedAt: date(p.posted_at), postedAtRaw: p.posted_at_raw ?? null,
      kind: p.kind ?? null, game: p.game ?? null, items: p.items ?? [], attrs: p.attrs ?? [], price: p.price ?? null, comments: p.comments ?? null, reactions: p.reactions ?? null,
      text: p.text ?? null, matches: p.matches ?? undefined, runId: p.run_id ?? null, firstSeen: date(s?.first_seen ?? p.seen_at) ?? new Date(), soldAt: date(s?.sold_at), reported: s?.reported ?? [] };
    await prisma.post.upsert({ where: { postId: String(p.post_id) }, create: { postId: String(p.post_id), ...data }, update: data });
    posts++;
  }

  const resDir = path.join(dir, "results");
  let results = 0;
  if (fs.existsSync(resDir))
    for (const f of fs.readdirSync(resDir).filter((f) => f.endsWith("_matches.json"))) {
      const runId = f.replace(/_matches\.json$/, "");
      const rows = read<Record<string, never>[]>(path.join("results", f), []);
      await prisma.matchResult.deleteMany({ where: { runId } });
      await prisma.matchResult.createMany({
        data: rows.map((r: Record<string, any>) => ({ runId, product: r.product, rank: r.rank, fit: Math.round(r.fit ?? 0), postUrl: r.post_url ?? "", group: r.group, author: r.author ?? null,
          authorUrl: r.author_url ?? null, price: r.price ?? null, cheaperPct: r.cheaper_than_market_pct ?? null, postedAt: date(r.posted_at), has: r.has ?? [], missing: r.missing ?? [],
          niceFound: r.nice_found ?? [], flags: r.flags ?? [], note: r.note ?? "" })),
      });
      results += rows.length;
    }

  const imgDir = path.join(dir, "images");
  let images = 0;
  if (fs.existsSync(imgDir))
    for (const pid of fs.readdirSync(imgDir)) {
      const d = path.join(imgDir, pid);
      if (!fs.statSync(d).isDirectory() || !(await prisma.wanted.findUnique({ where: { id: pid } }))) continue;
      for (const f of fs.readdirSync(d).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))) {
        const ext = f.split(".").pop()!.toLowerCase();
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
        await prisma.image.upsert({ where: { productId_fileName: { productId: pid, fileName: f } }, create: { productId: pid, fileName: f, mime, data: new Uint8Array(fs.readFileSync(path.join(d, f))) }, update: {} });
        images++;
      }
    }

  console.log(JSON.stringify({ groups: groups.length, wanted: read<W[]>("wanted.json", []).length, track: market.track.length, groupStates: Object.keys(state).length, posts, results, images }));
}

main().finally(() => prisma.$disconnect());
