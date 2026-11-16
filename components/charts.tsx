import { fmt } from "@/lib/stats";

export function DemandChart({ buy, sell, xLabels }: { buy: number[]; sell: number[]; xLabels: string[] }) {
  const max = Math.max(1, ...buy, ...sell);
  const top = Math.ceil(max / 4) * 4;
  const n = buy.length;
  const pts = (a: number[]) =>
    a.map((v, i) => `${((i / Math.max(1, n - 1)) * 600).toFixed(1)},${(200 - (v / top) * 200).toFixed(1)}`).join(" ");
  const buyPts = pts(buy);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-[250px]">
        <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
          {[4, 3, 2, 1, 0].map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-7 text-right text-[11px] text-muted">{(top * k) / 4}</span>
              <span className="h-px flex-1 bg-elevated" />
            </div>
          ))}
        </div>
        <svg
          role="img"
          aria-label="กราฟจำนวนโพสต์ตามหาและโพสต์ขายรายวัน"
          viewBox="0 0 600 200"
          preserveAspectRatio="none"
          className="absolute left-9 top-[7px] h-[calc(100%-14px)] w-[calc(100%-36px)] overflow-visible"
        >
          <defs>
            <linearGradient id="buyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7C3AED" stopOpacity="0.55" />
              <stop offset="1" stopColor="#7C3AED" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,200 ${buyPts} 600,200`} fill="url(#buyFill)" />
          <polyline points={pts(sell)} fill="none" stroke="#22D3EE" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          <polyline points={buyPts} fill="none" stroke="#A78BFA" strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex justify-between pl-9 text-[11px] text-muted">
        {xLabels.map((x, i) => <span key={i}>{x}</span>)}
      </div>
    </div>
  );
}

export function Donut({ total, segs }: { total: number; segs: { name: string; color: string; count: number }[] }) {
  const C = 2 * Math.PI * 54;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-[150px] shrink-0">
        <svg role="img" aria-label="สัดส่วนโพสต์แต่ละเกม" width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
          <circle cx="75" cy="75" r="54" fill="none" stroke="#1F2937" strokeWidth={20} />
          {total > 0 &&
            segs.map((s) => {
              const len = (s.count / total) * C;
              const el = (
                <circle key={s.name} cx="75" cy="75" r="54" fill="none" stroke={s.color} strokeWidth={20}
                  strokeDasharray={`${Math.max(0, len - (segs.length > 1 ? 3 : 0))} ${C}`} strokeDashoffset={-acc} />
              );
              acc += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{fmt(total)}</span>
          <span className="text-xs text-muted">โพสต์</span>
        </div>
      </div>
      <div className="flex min-w-[120px] flex-1 flex-col gap-3">
        {segs.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-[13px]">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 text-soft">{s.name}</span>
            <span className="font-semibold">{total ? Math.round((s.count / total) * 100) : 0}%</span>
            <span className="text-xs text-muted">({fmt(s.count)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Bars({ values, labels, height = 110 }: { values: (number | null)[]; labels: string[]; height?: number }) {
  const known = values.filter((v): v is number => v != null);
  const max = Math.max(...known, 1), min = known.length ? Math.min(...known) * 0.8 : 0;
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          title={v != null ? `${labels[i]} · ฿${fmt(v)}` : `${labels[i]} · ไม่มีข้อมูล`}
          className="min-h-1 flex-1 rounded-t"
          style={{
            height: v == null ? "4px" : `${Math.max(4, ((v - min) / Math.max(1, max - min)) * 100)}%`,
            background: v == null ? "#1F2937" : i === values.length - 1 ? "#A78BFA" : "#334155",
          }}
        />
      ))}
    </div>
  );
}

export function PairBars({ a, b, labels }: { a: number[]; b: number[]; labels: string[] }) {
  const max = Math.max(1, ...a, ...b);
  return (
    <div className="flex h-[180px] items-end gap-1.5 border-b border-elevated">
      {a.map((v, i) => (
        <div key={i} title={`${labels[i]} · ลงขาย ${v} · ขายออก ${b[i]}`} className="flex h-full flex-1 items-end gap-0.5">
          <div className="min-h-0.5 flex-1 rounded-t-[3px] bg-line" style={{ height: `${(v / max) * 100}%` }} />
          <div className="min-h-0.5 flex-1 rounded-t-[3px] bg-primary-light" style={{ height: `${(b[i] / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}
