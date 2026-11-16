import Link from "next/link";
import { Bars, DemandChart, Donut, PairBars } from "@/components/charts";
import { Icon, type IconName } from "@/components/Icon";
import { ago, dashboard, fmt, groupRows, thDate, type Sort } from "@/lib/stats";
import { getConfig, getGroups, getGroupState, getLog, getMarket, getMatchRuns, getSeen, getWanted } from "@/lib/store";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const days = one(sp.days) === "7" ? 7 : 14;
  const sort = (["score", "sold", "fast"].includes(one(sp.sort) ?? "") ? one(sp.sort) : "score") as Sort;
  const log = getLog();
  const groups = getGroups();
  const cfg = getConfig();
  const d = dashboard({
    log, seen: getSeen(), market: getMarket(), groups,
    game: one(sp.game) ?? "", days, sort, item: one(sp.item),
  });
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { game: d.game, days: String(days), sort, item: d.selected ?? undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/?${q.toString()}#${patch.item ? "detail" : "top"}`;
  };

  const wantedGames = new Map(getWanted().map((w) => [w.id, w.game]));
  const matches = getMatchRuns()
    .flatMap((r) => r.rows)
    .filter((m) => !d.game || wantedGames.get(m.product) === d.game)
    .slice(0, 4);
  const gRows = groupRows(groups, getGroupState(), cfg).filter((g) => !d.game || g.games.length === 0 || g.games.includes(d.game));
  const dayLabels = d.buyD.map((_, i) => thDate(Date.now() - (d.days - 1 - i) * 86_400_000));

  return (
    <>
      <div id="top" className="flex flex-wrap items-center gap-3">
        <nav aria-label="เลือกเกม" className="flex flex-1 flex-wrap gap-2">
          {d.games.map((g) => {
            const on = g.name === d.game;
            return (
              <Link
                key={g.name}
                href={href({ game: g.name, item: undefined })}
                aria-current={on ? "page" : undefined}
                className={
                  "flex min-h-11 items-center gap-2.5 rounded-xl border px-4 text-sm " +
                  (on ? "border-primary-edge bg-primary-deep font-semibold" : "border-elevated bg-surface text-soft hover:bg-elevated")
                }
              >
                <span className="size-2.5 rounded-[3px]" style={{ background: g.color }} />
                {g.name}
              </Link>
            );
          })}
          {d.games.length === 0 && <span className="text-sm text-muted">ยังไม่มีเกม — เพิ่มกลุ่มหรือรายการติดตามก่อน</span>}
        </nav>
        <Segment
          label="ช่วงเวลา"
          items={[
            { label: "7 วัน", href: href({ days: "7" }), on: days === 7 },
            { label: "14 วัน", href: href({ days: "14" }), on: days === 14 },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold tracking-tight">ภาพรวมตลาด{d.game ? ` · ${d.game}` : ""}</h1>
          <p className="text-sm text-muted">ความต้องการ ของในตลาด และราคาจากกลุ่มซื้อขายบน Facebook</p>
        </div>
        <span className="text-xs text-muted">ข้อมูลทั้งหมด {fmt(log.length)} โพสต์</span>
      </div>

      {!d.hasData && (
        <div className="card flex flex-col gap-2 p-6">
          <span className="font-semibold">ยังไม่มีข้อมูลของ{d.game ? ` ${d.game}` : "เกมไหน"}ในช่วงนี้</span>
          <span className="text-sm text-muted">
            ตั้งค่ากลุ่มที่หน้า "กลุ่ม Facebook" แล้วสั่ง Claude ว่า "รัน fb" ข้อมูลจะเข้ามาที่ data/log/market_log.jsonl
          </span>
        </div>
      )}

      <section aria-label="ตัวเลขสรุป" className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        <Kpi featured icon="search" tile="#7C3AED" stroke="#fff" label="โพสต์ตามหา" {...d.kpi.buy} />
        <Kpi icon="tag" tile="#0E3A44" stroke="#22D3EE" label="โพสต์ขาย" {...d.kpi.sell} />
        <Kpi icon="check" tile="#0D3B2E" stroke="#10B981" label="ขายออกแล้ว" {...d.kpi.sold} />
        <Kpi icon="scale" tile="#3B2A0A" stroke="#F59E0B" label="ความต้องการ / ของ" {...d.kpi.ratio} />
      </section>

      <div className="flex flex-wrap gap-4">
        <section className="card flex min-w-0 flex-[999_1_520px] flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold">คนตามหา เทียบกับ โพสต์ขาย</h2>
              <p className="text-[13px] text-muted">ม่วงอยู่เหนือฟ้า = ของขาดตลาด น่าเอามาขาย</p>
            </div>
            <div className="flex gap-4 text-xs text-soft">
              <Legend color="#A78BFA">ตามหา / วัน</Legend>
              <Legend color="#22D3EE">โพสต์ขาย / วัน</Legend>
            </div>
          </div>
          <DemandChart buy={d.buyD} sell={d.sellD} xLabels={d.xLabels} />
        </section>
        <section className="card flex min-w-0 flex-[1_1_300px] flex-col gap-5 p-6">
          <h2 className="text-[17px] font-semibold">สัดส่วนโพสต์ตามเกม</h2>
          <Donut total={d.donut.total} segs={d.donut.segs} />
        </section>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <section className="card flex min-w-0 flex-[999_1_600px] flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold">อันดับสินค้า{d.game ? ` · ${d.game}` : ""}</h2>
              <p className="text-xs text-muted">กดชื่อสินค้าเพื่อดูรายละเอียด · คะแนน = ตามหา×3 + ขายออก×2 + โพสต์ขาย×0.5</p>
            </div>
            <Segment
              label="เรียงตาม"
              items={[
                { label: "คะแนน", href: href({ sort: "score" }), on: sort === "score" },
                { label: "ขายออกมากสุด", href: href({ sort: "sold" }), on: sort === "sold" },
                { label: "ขายเร็วสุด", href: href({ sort: "fast" }), on: sort === "fast" },
              ]}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-sunken text-left text-xs text-muted">
                  {["#", "สินค้า", "คะแนน", "ตามหา", "ขาย", "ขายออก", "ความต้องการ / ของ", "ราคากลาง", "แนวโน้ม", "ขายออกใน"].map((h, i) => (
                    <th key={h} className={"px-2.5 py-3 font-semibold " + (i >= 2 && i !== 6 ? "text-right" : "")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.items.map((it) => (
                  <tr key={it.key} className={it.key === d.selected ? "bg-[#241B45]" : ""}>
                    <td className="border-b border-elevated px-2.5 py-3 text-muted">{it.rank}</td>
                    <td className="border-b border-elevated px-2.5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={href({ item: it.key })} className="font-semibold text-ink underline decoration-primary-edge underline-offset-4">
                          {it.name}
                        </Link>
                        {it.hot && <Pill tone="green">น่าเอามาขาย</Pill>}
                      </div>
                    </td>
                    <td className="border-b border-elevated px-2.5 py-3 text-right font-bold">{it.score.toFixed(1)}</td>
                    <td className="border-b border-elevated px-2.5 py-3 text-right text-primary-pale">{it.buy}</td>
                    <td className="border-b border-elevated px-2.5 py-3 text-right text-cyan-300">{it.sell}</td>
                    <td className="border-b border-elevated px-2.5 py-3 text-right font-semibold">{it.sold}</td>
                    <td className="border-b border-elevated px-2.5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-[90px] overflow-hidden rounded-full bg-elevated">
                          <div className="h-full rounded-full bg-primary-light" style={{ width: `${Math.min(100, (it.ratio / 2) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-soft">{it.ratio.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="border-b border-elevated px-2.5 py-3 text-right">{it.median != null ? `฿${fmt(it.median)}` : "–"}</td>
                    <td className={"border-b border-elevated px-2.5 py-3 text-right font-semibold " + (it.trend == null ? "text-muted" : it.trend >= 0 ? "text-success-text" : "text-danger-text")}>
                      {it.trend == null ? "–" : `${it.trend >= 0 ? "+" : ""}${it.trend}%`}
                    </td>
                    <td className="border-b border-elevated px-2.5 py-3 text-right text-soft">{it.hours != null ? `${Math.round(it.hours)} ชม.` : "–"}</td>
                  </tr>
                ))}
                {d.items.length === 0 && (
                  <tr><td colSpan={10} className="px-2.5 py-8 text-center text-muted">ยังไม่มีรายการในช่วงนี้</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section className="card flex flex-col gap-3 p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[17px] font-semibold">ผลค้นหาใหม่</h2>
              <Link href="/results" className="text-[13px] text-primary-light no-underline">ดูทั้งหมด</Link>
            </div>
            {matches.map((m) => (
              <a key={m.run_id + m.post_url + m.product} href={m.post_url} target="_blank" rel="noreferrer"
                className="flex flex-col gap-1.5 rounded-xl border border-elevated bg-sunken p-3.5 text-ink no-underline hover:border-line">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{m.product}</span>
                  <span className="font-bold">{m.price != null ? `฿${fmt(m.price)}` : "ไม่ระบุราคา"}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  <span>ตรง {m.fit}%</span><span>{m.group}</span><span>{ago(m.posted_at)}</span>
                </div>
                {m.flags.length > 0 && <div className="flex flex-wrap gap-1.5">{m.flags.map((f) => <Pill key={f} tone="red">{f}</Pill>)}</div>}
              </a>
            ))}
            {matches.length === 0 && <span className="text-sm text-muted">ยังไม่มีผลค้นหาของเกมนี้</span>}
          </section>

          <section className="card flex flex-col gap-3 p-6">
            <h2 className="text-[17px] font-semibold">ราคากลางรายวัน</h2>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[26px] font-bold">{d.price.now != null ? `฿${fmt(d.price.now)}` : "–"}</span>
              {d.price.change != null && (
                <span className={"text-xs font-semibold " + (d.price.change >= 0 ? "text-success-text" : "text-danger-text")}>
                  {d.price.change >= 0 ? "▲" : "▼"} {Math.abs(d.price.change)}% ใน {d.days} วัน
                </span>
              )}
            </div>
            <Bars values={d.price.series} labels={dayLabels} />
            <div className="flex justify-between text-[11px] text-muted"><span>{d.firstDayLabel}</span><span>วันนี้</span></div>
          </section>

          <section className="card flex flex-col gap-2 p-6">
            <h2 className="mb-1 text-[17px] font-semibold">กลุ่มที่อ่าน</h2>
            {gRows.map((g) => (
              <div key={g.id} className="flex items-center gap-3 border-b border-elevated py-2.5">
                <span className="grid size-[34px] place-items-center rounded-[10px] bg-primary-deep text-sm font-bold text-primary-pale">{g.tier}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-semibold">{g.id}</span>
                  <span className="text-xs text-muted">{g.ppd} โพสต์/วัน · เจอของ {g.hit}</span>
                </div>
                <span className="text-right text-xs text-soft">{g.next}</span>
              </div>
            ))}
            {gRows.length === 0 && <Link href="/groups" className="text-sm text-primary-light">เพิ่มกลุ่ม Facebook</Link>}
          </section>
        </div>
      </div>

      {d.detail && (
        <section id="detail" className="card flex flex-col gap-6 p-7">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-muted">รายละเอียดสินค้า · {d.game} · อันดับ {d.detail.rank}</span>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold">{d.detail.name}</h2>
              {d.detail.hot && <Pill tone="green">น่าเอามาขาย</Pill>}
            </div>
            <p className="max-w-3xl text-sm text-soft">{d.detail.summary}</p>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            {d.detail.stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-1.5 rounded-xl border border-elevated bg-sunken p-4">
                <span className="text-[13px] text-muted">{s.label}</span>
                <span className="text-[22px] font-bold">{s.value}</span>
                <span className="text-xs text-muted">{s.sub}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-7">
            <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold">ลงขาย เทียบ ขายออก รายวัน</h3>
                <div className="flex gap-3.5 text-xs text-soft">
                  <Legend color="#334155" square>ลงขาย</Legend>
                  <Legend color="#A78BFA" square>ขายออก</Legend>
                </div>
              </div>
              <PairBars a={d.detail.listed} b={d.detail.sold} labels={dayLabels} />
              <div className="flex justify-between text-[11px] text-muted"><span>{d.firstDayLabel}</span><span>วันนี้</span></div>
            </div>
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
              <h3 className="text-[15px] font-semibold">ช่วงราคาที่ขายออก</h3>
              {d.detail.bands.length === 0 && <span className="text-sm text-muted">ยังไม่มีราคาพอแบ่งช่วง</span>}
              {(() => {
                const bestRate = Math.max(0, ...d.detail.bands.filter((b) => b.listed).map((b) => b.rate));
                return d.detail.bands.map((b) => (
                  <div key={b.range} className="flex flex-col gap-1.5">
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span>{b.range}</span>
                      <span className="text-muted">{b.listed ? `ขายออก ${b.rate}% · ${b.hours}` : "ไม่มีโพสต์"}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-elevated">
                      <div className="h-full rounded-full" style={{ width: `${b.rate}%`, background: b.listed && b.rate === bestRate ? "#A78BFA" : "#4C3A8C" }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="flex flex-wrap gap-7">
            <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-3">
              <h3 className="text-[15px] font-semibold">จุดเด่นที่เจอในโพสต์ที่ขายออก</h3>
              <p className="text-xs text-muted">เทียบสัดส่วนในโพสต์ที่ขายออก กับในโพสต์ขายทั้งหมด ยิ่งห่างกันมาก ยิ่งเป็นจุดขาย</p>
              {d.detail.attrs.length === 0 && <span className="text-sm text-muted">ยังไม่มีข้อมูลจุดเด่น (ช่อง attrs ในโพสต์)</span>}
              {d.detail.attrs.map((a) => (
                <div key={a.name} className="grid grid-cols-[minmax(120px,1.2fr)_minmax(0,2fr)_56px] items-center gap-3 text-[13px]">
                  <span className="text-slate-200">{a.name}</span>
                  <div className="flex flex-col gap-[3px]">
                    <div className="h-[7px] overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-primary-light" style={{ width: `${a.sold}%` }} /></div>
                    <div className="h-[7px] overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-slate-600" style={{ width: `${a.all}%` }} /></div>
                  </div>
                  <span className={"text-right font-bold " + (a.lift >= 15 ? "text-primary-pale" : "text-muted")}>{a.lift >= 0 ? "+" : ""}{a.lift}%</span>
                </div>
              ))}
              {d.detail.attrs.length > 0 && (
                <div className="flex gap-3.5 text-xs text-soft">
                  <Legend color="#A78BFA">ในโพสต์ที่ขายออก</Legend>
                  <Legend color="#475569">ในโพสต์ขายทั้งหมด</Legend>
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
              <h3 className="text-[15px] font-semibold">โพสต์ที่ขายออกล่าสุด</h3>
              {d.detail.recent.length === 0 && <span className="text-sm text-muted">ยังไม่มีโพสต์ที่ขายออก</span>}
              {d.detail.recent.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-elevated bg-sunken px-3.5 py-3 text-ink no-underline hover:border-line">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-semibold">{r.text || d.detail!.name}</span>
                    <span className="text-xs text-muted">{r.group} · ลงขาย {r.when}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-bold">{r.price != null ? `฿${fmt(r.price)}` : "–"}</span>
                    <Pill tone="green">ขายออกใน {r.hours} ชม.</Pill>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function Kpi({ label, value, text, up, icon, tile, stroke, featured }: {
  label: string; value: string; text: string; up: boolean; icon: IconName; tile: string; stroke: string; featured?: boolean;
}) {
  return (
    <div className={"flex items-start gap-4 rounded-2xl border p-5 " + (featured ? "border-primary-edge bg-primary-deep" : "border-elevated bg-surface")}>
      <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ background: tile, color: stroke }}>
        <Icon name={icon} size={22} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13px] text-soft">{label}</span>
        <span className="text-[28px] font-bold tracking-tight">{value}</span>
        <span className={"text-xs font-semibold " + (text === "–" ? "text-muted" : up ? "text-success-text" : "text-danger-text")}>{text}</span>
      </div>
    </div>
  );
}

function Segment({ label, items }: { label: string; items: { label: string; href: string; on: boolean }[] }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl border border-elevated bg-surface p-1">
      {items.map((i) => (
        <Link key={i.label} href={i.href} aria-current={i.on ? "true" : undefined}
          className={"flex min-h-10 items-center rounded-[9px] px-4 text-[13px] " + (i.on ? "bg-primary font-semibold text-white" : "text-soft hover:bg-elevated")}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

function Legend({ color, square, children }: { color: string; square?: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={square ? "size-2.5 rounded-[3px]" : "size-2 rounded-full"} style={{ background: color }} />
      {children}
    </span>
  );
}

function Pill({ tone, children }: { tone: "green" | "red"; children: React.ReactNode }) {
  return (
    <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold " + (tone === "green" ? "bg-[#0D3B2E] text-success-text" : "bg-[#3F1418] text-red-300")}>
      {children}
    </span>
  );
}
