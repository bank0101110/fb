import "server-only";
import { prisma } from "./db";
import type { Prisma } from "./generated/prisma/client";
import { groupTier } from "./stats";
import { getConfig, getGroups, getGroupState, getWanted } from "./store";
import type { Match, Post } from "./types";

const H = 3_600_000;
const bkkStamp = (d: Date) => {
  const t = new Date(d.getTime() + 7 * H);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}-${p(t.getUTCHours())}${p(t.getUTCMinutes())}`;
};
const parse = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ---------------------------------------------------------------- plan
export async function plan(opts: { all?: boolean } = {}) {
  const [cfg, groups, state, wanted] = await Promise.all([getConfig(), getGroups(), getGroupState(), getWanted()]);
  const now = new Date();
  const active = wanted.filter((w) => w.enabled);
  const due: Record<string, unknown>[] = [];
  const skipped: Record<string, unknown>[] = [];
  for (const g of groups.filter((g) => g.enabled)) {
    const st = state[g.id];
    const { tier, interval, hit } = groupTier(cfg, st);
    const last = parse(st?.last_read_at);
    const nextDue = last ? new Date(last.getTime() + interval * H) : null;
    const info = { id: g.id, tier, hit_rate: hit != null ? +hit.toFixed(4) : null, posts_per_day: st?.posts_per_day ?? null };
    if (nextDue && now < nextDue && !opts.all) {
      skipped.push({ ...info, next_due: nextDue.toISOString() });
      continue;
    }
    const prods = active.filter((w) => w.groups === "all" || w.groups.includes(g.id)).map((w) => w.id);
    due.push({
      ...info, weight: { A: 3, B: 2, C: 1 }[tier] ?? 1, url: g.url,
      feed_url: `${g.url.replace(/\/$/, "")}/?sorting_setting=CHRONOLOGICAL`, mode: g.mode, products: prods,
      stop_at_post_ids: (st?.recent_post_ids ?? []).slice(0, 30),
      keywords: [...new Set(active.filter((w) => prods.includes(w.id)).flatMap((w) => w.keywords))].sort(),
    });
  }
  const wsum = due.reduce((s, d) => s + (d.weight as number), 0) || 1;
  for (const d of due) {
    const n = Math.round((cfg.run_post_budget * (d.weight as number)) / wsum);
    d.max_posts = Math.max(cfg.per_group_min_posts, Math.min(cfg.per_group_max_posts, n));
    delete d.weight;
  }
  const maxAge = Math.max(cfg.max_post_age_days, ...active.map((w) => w.max_post_age_days ?? cfg.max_post_age_days));
  return {
    run_id: bkkStamp(now),
    cutoff_posted_after: new Date(now.getTime() - maxAge * 24 * H).toISOString(),
    stop_after_consecutive_seen: cfg.stop_after_consecutive_seen,
    active_products: active.map((w) => w.id),
    due_groups: due,
    skipped_groups: skipped,
  };
}

// ---------------------------------------------------------------- ingest
export type IngestInput = { run_id?: string; posts: Post[]; meta?: Record<string, string> };

export async function ingest(input: IngestInput) {
  if (!Array.isArray(input.posts)) throw new Error("posts must be an array");
  const [cfg, wantedList] = await Promise.all([getConfig(), getWanted()]);
  const wanted = new Map(wantedList.map((w) => [w.id, w]));
  const now = new Date();
  const runId = input.run_id || bkkStamp(now);

  const ids = [...new Set(input.posts.map((p) => String(p.post_id)))];
  const existing = new Map(
    (await prisma.post.findMany({ where: { postId: { in: ids } }, select: { postId: true, reported: true, soldAt: true } })).map((r) => [r.postId, r]),
  );

  const creates: Prisma.PostCreateManyInput[] = [];
  const soldUpdates: string[] = [];
  const reported = new Map<string, string[]>(); // postId -> products reported (incl. old)
  const perGroup = new Map<string, { n: number; fresh: number; matched: number; ids: string[]; newest: Date | null }>();
  type Cand = { m: Match & { price?: number | null }; p: Post; pid: string; price: number | null; vs: number | null; flags: string[] };
  const cand = new Map<string, Cand[]>();

  for (const p of input.posts) {
    const pid = String(p.post_id);
    const g = p.group;
    const pg = perGroup.get(g) ?? { n: 0, fresh: 0, matched: 0, ids: [], newest: null };
    perGroup.set(g, pg);
    pg.n++;
    pg.ids.push(pid);
    const pt = parse(p.posted_at);
    if (pt && (!pg.newest || pt > pg.newest)) pg.newest = pt;

    const prev = existing.get(pid);
    if (!prev && !creates.some((c) => c.postId === pid)) {
      pg.fresh++;
      creates.push({
        postId: pid, group: g, url: p.url, author: p.author, authorUrl: p.author_url, postedAt: pt,
        postedAtRaw: p.posted_at_raw, kind: p.kind, game: p.game, items: p.items ?? [], attrs: p.attrs ?? [],
        price: p.price ?? null, comments: p.comments ?? null, reactions: p.reactions ?? null, text: p.text?.slice(0, 1000),
        matches: (p.matches ?? undefined) as Prisma.InputJsonValue | undefined, runId, firstSeen: now,
        soldAt: p.kind === "sold" ? now : null, reported: [],
      });
    } else if (prev && p.kind === "sold" && !prev.soldAt) {
      soldUpdates.push(pid);
    }
    if (!reported.has(pid)) reported.set(pid, [...(prev?.reported ?? [])]);

    if (p.kind && p.kind !== "sell") continue;
    let any = false;
    for (const m of p.matches ?? []) {
      const w = wanted.get(m.product);
      if (!w || !w.enabled || (m.fit ?? 0) < cfg.min_fit) continue;
      any = true;
      if (reported.get(pid)!.includes(w.id)) continue;
      const age = w.max_post_age_days ?? cfg.max_post_age_days;
      if (pt && pt.getTime() < now.getTime() - age * 24 * H) continue;
      const mp = m as Match & { price?: number | null };
      const price = "price" in mp && mp.price !== undefined ? mp.price ?? null : p.price ?? null;
      if (price == null) {
        if (!cfg.include_no_price) continue;
      } else if ((w.price.min != null && price < w.price.min) || (w.price.max != null && price > w.price.max)) continue;
      const flags = [...(m.flags ?? []), ...cfg.warn_words.filter((ww) => (p.text ?? "").includes(ww)).map((ww) => `คำเตือน:${ww}`)];
      let vs: number | null = null;
      if (price != null && w.price.market) {
        vs = Math.round((1 - price / w.price.market) * 100);
        if (price < w.price.market * cfg.underpriced_ratio) flags.push("ถูกผิดปกติ");
      }
      const list = cand.get(w.id) ?? [];
      if (!list.some((c) => c.pid === pid)) list.push({ m: mp, p, pid, price, vs, flags });
      cand.set(w.id, list);
    }
    if (any) pg.matched++;
  }

  const results: Prisma.MatchResultCreateManyInput[] = [];
  for (const [prod, list] of cand) {
    list.sort((a, b) => (b.m.fit ?? 0) - (a.m.fit ?? 0) || (a.price ?? 1e12) - (b.price ?? 1e12));
    list.slice(0, cfg.max_results_per_product).forEach((c, i) => {
      reported.get(c.pid)!.push(prod);
      results.push({
        runId, product: prod, rank: i + 1, fit: Math.round(c.m.fit ?? 0), postUrl: c.p.url ?? "", group: c.p.group,
        author: c.p.author ?? null, authorUrl: c.p.author_url ?? null, price: c.price, cheaperPct: c.vs, postedAt: parse(c.p.posted_at),
        has: c.m.has ?? [], missing: c.m.missing ?? [], niceFound: c.m.nice_found ?? [], flags: c.flags, note: c.m.note ?? "",
      });
    });
  }

  const states = new Map((await prisma.groupState.findMany({ where: { groupId: { in: [...perGroup.keys()] } } })).map((s) => [s.groupId, s]));
  const stateOps = [...perGroup].map(([g, pg]) => {
    const st = states.get(g);
    let ppd = st?.postsPerDay ?? null;
    if (st?.lastReadAt) {
      const days = Math.max((now.getTime() - st.lastReadAt.getTime()) / (24 * H), 1 / 24);
      const rate = pg.fresh / days;
      ppd = +(ppd == null ? rate : 0.5 * ppd + 0.5 * rate).toFixed(1);
    }
    const recent = [...pg.ids, ...(st?.recentPostIds ?? []).filter((i) => !pg.ids.includes(i))].slice(0, 60);
    const data = {
      runs: (st?.runs ?? 0) + 1, postsRead: (st?.postsRead ?? 0) + pg.n, matches: (st?.matches ?? 0) + pg.matched,
      recentPostIds: recent, lastReadAt: now, newestPostAt: pg.newest ?? st?.newestPostAt ?? null, postsPerDay: ppd,
      lastStopReason: input.meta?.[g] ?? st?.lastStopReason ?? null,
    };
    return prisma.groupState.upsert({ where: { groupId: g }, create: { groupId: g, ...data }, update: data });
  });

  const reportedOps = [...reported]
    .filter(([pid, list]) => list.length !== (existing.get(pid)?.reported.length ?? 0))
    .map(([pid, list]) => ({ pid, list }));

  await prisma.$transaction([
    prisma.post.createMany({ data: creates, skipDuplicates: true }),
    ...(soldUpdates.length ? [prisma.post.updateMany({ where: { postId: { in: soldUpdates } }, data: { soldAt: now, kind: "sold" } })] : []),
    ...reportedOps.map(({ pid, list }) => prisma.post.update({ where: { postId: pid }, data: { reported: list } })),
    ...(results.length ? [prisma.matchResult.createMany({ data: results })] : []),
    ...stateOps,
  ]);

  return {
    run_id: runId, posts_in: input.posts.length, new_posts: creates.length, marked_sold: soldUpdates.length,
    new_matches: results.length,
    groups: Object.fromEntries([...perGroup].map(([g, pg]) => [g, { n: pg.n, new: pg.fresh, matched: pg.matched }])),
  };
}
