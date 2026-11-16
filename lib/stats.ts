import type { Config, Group, GroupState, Market, Post, Seen } from "./types";

const DAY = 86_400_000;
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const GAME_COLORS = ["#7C3AED", "#22D3EE", "#10B981", "#F59E0B", "#F472B6", "#60A5FA", "#A3E635"];

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const ts = (s?: string | null) => (s ? Date.parse(s) : NaN);
/** Bangkok calendar day index (days since epoch in UTC+7). */
const dayIdx = (t: number) => Math.floor((t + 7 * 3600_000) / DAY);
export const thDate = (t: number) => {
  const d = new Date(t + 7 * 3600_000);
  return `${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]}`;
};
export const thDateTime = (s?: string) => {
  const t = ts(s);
  if (Number.isNaN(t)) return "–";
  const d = new Date(t + 7 * 3600_000);
  return `${thDate(t)} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
export const ago = (s?: string | null, now = Date.now()) => {
  const t = ts(s);
  if (Number.isNaN(t)) return "–";
  const h = (now - t) / 3600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} นาทีที่แล้ว`;
  if (h < 48) return `${Math.round(h)} ชม.ที่แล้ว`;
  return `${Math.round(h / 24)} วันที่แล้ว`;
};

export const postTime = (p: Post) => {
  const t = ts(p.posted_at);
  return Number.isNaN(t) ? ts(p.seen_at) : t;
};
const isSell = (p: Post) => p.kind === "sell" || p.kind === "sold";
const gameOf = (p: Post) => (p.game || p.items?.[0]?.split(":")[0] || "ไม่ระบุ").trim();

export function prettyItem(key: string, market: Market) {
  const t = market.track.find((x) => x.key === key);
  if (t?.name) return t.name;
  const slug = key.includes(":") ? key.split(":")[1] : key;
  return slug.replace(/-/g, " ");
}

// ---------------------------------------------------------------- groups
export function groupTier(cfg: Config, st?: GroupState[string]) {
  if (!st || st.runs < cfg.new_group_free_runs) return { tier: "A", interval: 0, hit: null as number | null };
  const hit = (st.matches + 1) / (st.posts_read + 20);
  const tiers = [...cfg.group_tiers].sort((a, b) => b.min_hit_rate - a.min_hit_rate);
  const t = tiers.find((x) => hit >= x.min_hit_rate) ?? tiers[tiers.length - 1];
  return { tier: t.tier, interval: t.interval_hours, hit };
}

export function groupRows(groups: Group[], state: GroupState, cfg: Config, now = Date.now()) {
  return groups.map((g) => {
    const st = state[g.id];
    const { tier, interval, hit } = groupTier(cfg, st);
    const last = ts(st?.last_read_at);
    const due = Number.isNaN(last) ? now : last + interval * 3600_000;
    const left = (due - now) / 3600_000;
    return {
      id: g.id,
      enabled: g.enabled,
      games: g.games,
      tier,
      hit: hit === null ? "ใหม่" : `${(hit * 100).toFixed(1)}%`,
      ppd: st?.posts_per_day != null ? String(st.posts_per_day) : "–",
      lastRead: st?.last_read_at ? ago(st.last_read_at, now) : "ยังไม่เคย",
      next: !g.enabled ? "ปิดอยู่" : left <= 0 ? "ถึงรอบแล้ว" : `อีก ${Math.ceil(left)} ชม.`,
    };
  });
}

// ---------------------------------------------------------------- dashboard
export type Sort = "score" | "sold" | "fast";

export function listGames(log: Post[], groups: Group[], market: Market) {
  const counts = new Map<string, number>();
  for (const p of log) counts.set(gameOf(p), (counts.get(gameOf(p)) ?? 0) + 1);
  for (const g of [...groups.flatMap((x) => x.games), ...market.track.map((t) => t.game)])
    if (g && !counts.has(g)) counts.set(g, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name], i) => ({ name, color: GAME_COLORS[i % GAME_COLORS.length] }));
}

export function dashboard(opts: {
  log: Post[]; seen: Seen; market: Market; groups: Group[];
  game: string; days: number; sort: Sort; item?: string; now?: number;
}) {
  const { log, seen, market, days, sort } = opts;
  const now = opts.now ?? Date.now();
  const today = dayIdx(now);
  const start = today - days + 1, prevStart = start - days;
  const soldAt = (p: Post) => ts(seen[p.post_id]?.sold_at);

  const games = listGames(log, opts.groups, market);
  const game = games.find((g) => g.name === opts.game)?.name ?? games[0]?.name ?? "";
  const gameColor = games.find((g) => g.name === game)?.color ?? GAME_COLORS[0];

  const inGame = log.filter((p) => gameOf(p) === game);
  const win = (p: Post, a: number, b: number) => {
    const d = dayIdx(postTime(p));
    return d >= a && d <= b;
  };
  const cur = inGame.filter((p) => win(p, start, today));
  const prev = inGame.filter((p) => win(p, prevStart, start - 1));
  const soldIn = (ps: Post[], a: number, b: number) =>
    ps.filter((p) => { const t = soldAt(p); return !Number.isNaN(t) && dayIdx(t) >= a && dayIdx(t) <= b; }).length;

  // daily series
  const buyD = Array(days).fill(0), sellD = Array(days).fill(0);
  const priceByDay: number[][] = Array.from({ length: days }, () => []);
  for (const p of cur) {
    const i = dayIdx(postTime(p)) - start;
    if (p.kind === "buy") buyD[i]++;
    else if (isSell(p)) {
      sellD[i]++;
      if (p.price != null) priceByDay[i].push(p.price);
    }
  }

  const delta = (a: number, b: number) => {
    if (!b) return { text: a ? "ใหม่ในช่วงนี้" : "–", up: true };
    const d = Math.round(((a - b) / b) * 100);
    return { text: `${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}% จากช่วงก่อน`, up: d >= 0 };
  };
  const nBuy = sum(buyD), nSell = sum(sellD);
  const pBuy = prev.filter((p) => p.kind === "buy").length, pSell = prev.filter(isSell).length;
  const nSold = soldIn(inGame, start, today), pSold = soldIn(inGame, prevStart, start - 1);
  const ratio = nBuy / (nSell + 1);
  const kpi = {
    buy: { value: fmt(nBuy), ...delta(nBuy, pBuy) },
    sell: { value: fmt(nSell), ...delta(nSell, pSell) },
    sold: { value: fmt(nSold), ...delta(nSold, pSold) },
    ratio: { value: ratio.toFixed(2), text: ratio >= 1 ? "ของขาดตลาด" : "ของล้นตลาด", up: ratio >= 1 },
  };

  // donut across games (current window)
  const perGame = games.map((g) => ({
    ...g,
    count: log.filter((p) => gameOf(p) === g.name && win(p, start, today)).length,
  }));
  const donutTotal = sum(perGame.map((g) => g.count));

  // items
  type Agg = { key: string; buy: number; sell: number; sold: number; prices: number[]; early: number[]; late: number[]; hours: number[]; posts: Post[] };
  const agg = new Map<string, Agg>();
  const tracked = new Set(market.track.map((t) => t.key));
  const mid = start + days / 2;
  for (const p of cur) {
    for (const key of p.items ?? []) {
      if (!market.discover && !tracked.has(key)) continue;
      const a = agg.get(key) ?? { key, buy: 0, sell: 0, sold: 0, prices: [], early: [], late: [], hours: [], posts: [] };
      a.posts.push(p);
      if (p.kind === "buy") a.buy++;
      else if (isSell(p)) {
        a.sell++;
        if (p.price != null) {
          a.prices.push(p.price);
          (dayIdx(postTime(p)) < mid ? a.early : a.late).push(p.price);
        }
      }
      const s = soldAt(p);
      if (!Number.isNaN(s)) {
        a.sold++;
        a.hours.push((s - postTime(p)) / 3600_000);
      }
      agg.set(key, a);
    }
  }
  const scored = [...agg.values()].map((a) => {
    const med = median(a.prices);
    const e = median(a.early), l = median(a.late);
    const trend = e && l ? Math.round(((l - e) / e) * 100) : null;
    const r = a.buy / (a.sell + 1);
    const score = a.buy * 3 + a.sold * 2 + a.sell * 0.5;
    const hrs = median(a.hours);
    return {
      key: a.key, name: prettyItem(a.key, market), buy: a.buy, sell: a.sell, sold: a.sold,
      score, ratio: r, hot: r >= 1 && a.buy > 0, median: med, trend, hours: hrs, posts: a.posts,
    };
  });
  scored.sort((a, b) =>
    sort === "sold" ? b.sold - a.sold || b.score - a.score
      : sort === "fast" ? (a.hours ?? 1e9) - (b.hours ?? 1e9)
      : b.score - a.score,
  );
  const items = scored.map((x, i) => ({ ...x, rank: i + 1 }));

  // price per day
  const priceMed = priceByDay.map((a) => median(a));
  const knownPrices = priceMed.filter((x): x is number => x != null);
  const firstP = knownPrices[0], lastP = knownPrices[knownPrices.length - 1];

  // detail
  const sel = items.find((x) => x.key === opts.item) ?? items[0] ?? null;
  let detail = null as null | ReturnType<typeof itemDetail>;
  if (sel) detail = itemDetail(sel, { start, days, soldAt, now });

  return {
    game, gameColor, games, days,
    xLabels: [0, 0.25, 0.5, 0.75, 1].map((f) => thDate((start + Math.round((days - 1) * f)) * DAY - 7 * 3600_000 + 12 * 3600_000)),
    firstDayLabel: thDate(start * DAY),
    buyD, sellD, kpi,
    donut: { total: donutTotal, segs: perGame },
    items: items.map(({ posts, ...rest }) => rest),
    price: { series: priceMed, now: lastP ?? null, change: firstP && lastP ? Math.round(((lastP - firstP) / firstP) * 100) : null },
    selected: sel?.key ?? null,
    detail,
    hasData: inGame.length > 0,
  };
}

function itemDetail(
  sel: { key: string; name: string; rank?: number; buy: number; sell: number; sold: number; hot: boolean; median: number | null; trend: number | null; hours: number | null; ratio: number; posts: Post[] },
  ctx: { start: number; days: number; soldAt: (p: Post) => number; now: number },
) {
  const sells = sel.posts.filter(isSell);
  const listed = Array(ctx.days).fill(0), sold = Array(ctx.days).fill(0);
  for (const p of sells) {
    listed[dayIdx(postTime(p)) - ctx.start]++;
    const s = ctx.soldAt(p);
    if (!Number.isNaN(s)) {
      const i = dayIdx(s) - ctx.start;
      if (i >= 0 && i < ctx.days) sold[i]++;
    }
  }
  const sellThrough = sells.length ? Math.round((sells.filter((p) => !Number.isNaN(ctx.soldAt(p))).length / sells.length) * 100) : 0;

  // price bands relative to median
  const med = sel.median;
  const bands = med
    ? [[0, 0.8], [0.8, 1.0], [1.0, 1.2], [1.2, Infinity]].map(([lo, hi], k) => {
        const inBand = sells.filter((p) => p.price != null && p.price >= med * lo && p.price < med * hi);
        const soldB = inBand.filter((p) => !Number.isNaN(ctx.soldAt(p)));
        const hrs = median(soldB.map((p) => (ctx.soldAt(p) - postTime(p)) / 3600_000));
        const a = Math.round((med * lo) / 10) * 10, b = Math.round((med * hi) / 10) * 10;
        return {
          range: k === 0 ? `ต่ำกว่า ฿${fmt(b)}` : k === 3 ? `฿${fmt(a)} ขึ้นไป` : `฿${fmt(a)} – ${fmt(b)}`,
          listed: inBand.length,
          rate: inBand.length ? Math.round((soldB.length / inBand.length) * 100) : 0,
          hours: hrs != null ? `${Math.round(hrs)} ชม.` : "–",
        };
      })
    : [];
  const best = bands.filter((b) => b.listed > 0).sort((a, b) => b.rate - a.rate)[0];

  // attributes lift
  const soldPosts = sells.filter((p) => !Number.isNaN(ctx.soldAt(p)));
  const attrCount = (ps: Post[]) => {
    const m = new Map<string, number>();
    for (const p of ps) for (const a of new Set(p.attrs ?? [])) m.set(a, (m.get(a) ?? 0) + 1);
    return m;
  };
  const allC = attrCount(sells), soldC = attrCount(soldPosts);
  const attrs = [...allC.entries()]
    .map(([name, c]) => {
      const all = Math.round((c / (sells.length || 1)) * 100);
      const s = soldPosts.length ? Math.round(((soldC.get(name) ?? 0) / soldPosts.length) * 100) : 0;
      return { name, all, sold: s, lift: s - all };
    })
    .sort((a, b) => b.lift - a.lift)
    .slice(0, 8);

  const recent = soldPosts
    .map((p) => ({ p, s: ctx.soldAt(p) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map(({ p, s }) => ({
      url: p.url, group: p.group, price: p.price, when: ago(p.posted_at, ctx.now),
      hours: Math.max(1, Math.round((s - postTime(p)) / 3600_000)),
      text: p.text?.slice(0, 80) ?? "",
    }));

  const parts = [`ขายออก ${sel.sold} ชิ้นใน ${ctx.days} วัน`];
  if (best) parts.push(`ช่วงราคา ${best.range} ขายออกได้มากที่สุด (${best.rate}%)`);
  if (attrs[0] && attrs[0].lift > 0) parts.push(`โพสต์ที่มี "${attrs[0].name}" ขายออกบ่อยกว่าค่าเฉลี่ย +${attrs[0].lift}%`);

  return {
    key: sel.key, name: sel.name, rank: sel.rank ?? 1, hot: sel.hot,
    summary: parts.join(" · "),
    stats: [
      { label: "ขายออก", value: String(sel.sold), sub: `ใน ${ctx.days} วันล่าสุด` },
      { label: "อัตราขายออก", value: `${sellThrough}%`, sub: "ของโพสต์ที่ลงขาย" },
      { label: "ขายออกเฉลี่ยใน", value: sel.hours != null ? `${Math.round(sel.hours)} ชม.` : "–", sub: "นับจากเวลาโพสต์" },
      { label: "ราคากลาง", value: sel.median != null ? `฿${fmt(sel.median)}` : "–", sub: sel.trend != null ? `แนวโน้ม ${sel.trend >= 0 ? "+" : ""}${sel.trend}%` : "ข้อมูลยังไม่พอดูแนวโน้ม" },
      { label: "คนตามหา", value: String(sel.buy), sub: `สัดส่วนต่อของ ${sel.ratio.toFixed(2)}` },
    ],
    listed, sold, bands, attrs, recent,
  };
}

export function discoveredItems(log: Post[], market: Market) {
  const m = new Map<string, { key: string; game: string; posts: number }>();
  for (const p of log)
    for (const k of p.items ?? []) {
      const e = m.get(k) ?? { key: k, game: gameOf(p), posts: 0 };
      e.posts++;
      m.set(k, e);
    }
  const tracked = new Set(market.track.map((t) => t.key));
  return [...m.values()].filter((x) => !tracked.has(x.key)).sort((a, b) => b.posts - a.posts).slice(0, 40);
}
