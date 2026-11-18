import Link from "next/link";
import { PageHeader } from "@/components/form";
import { Icon } from "@/components/Icon";
import { ago, fmt } from "@/lib/stats";
import { getMatchRuns, getWanted } from "@/lib/store";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ResultsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const product = typeof sp.product === "string" ? sp.product : "";
  const [wanted, allRuns] = await Promise.all([getWanted(), getMatchRuns(50)]);
  const names = new Map(wanted.map((w) => [w.id, w.name]));
  const runs = allRuns
    .map((r) => ({ ...r, rows: r.rows.filter((m) => !product || m.product === product) }))
    .filter((r) => r.rows.length);

  return (
    <>
      <PageHeader title="ผลค้นหาสินค้า" sub="โพสต์ที่ตรงกับสินค้าที่ต้องการ · เปิดลิงก์แล้วทักผู้ขายเอง" />
      <nav aria-label="กรองตามสินค้า" className="flex flex-wrap gap-2">
        <Link href="/results" aria-current={!product ? "page" : undefined}
          className={"flex min-h-10 items-center rounded-full border px-4 text-sm " + (!product ? "border-primary-edge bg-primary-deep font-semibold text-primary-pale" : "border-line text-soft hover:bg-elevated")}>
          ทั้งหมด
        </Link>
        {wanted.map((w) => (
          <Link key={w.id} href={`/results?product=${encodeURIComponent(w.id)}`} aria-current={product === w.id ? "page" : undefined}
            className={"flex min-h-10 items-center rounded-full border px-4 text-sm " + (product === w.id ? "border-primary-edge bg-primary-deep font-semibold text-primary-pale" : "border-line text-soft hover:bg-elevated")}>
            {w.name || w.id}
          </Link>
        ))}
      </nav>

      {runs.length === 0 && <div className="card p-8 text-center text-muted">ยังไม่มีผลค้นหา</div>}

      {runs.map((r) => (
        <section key={r.run_id} className="card flex flex-col gap-3 p-6">
          <h2 className="text-[15px] font-semibold">รอบ {r.run_id} <span className="font-normal text-muted">· {r.rows.length} โพสต์</span></h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-sunken text-left text-xs text-muted">
                  {["สินค้า", "ตรง", "ราคา", "ถูกกว่าตลาด", "ผู้ขาย / กลุ่ม", "โพสต์เมื่อ", "รายละเอียด", ""].map((h, i) => (
                    <th key={i} className="px-2.5 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.rows.map((m, i) => (
                  <tr key={i} className="align-top">
                    <td className="border-b border-elevated px-2.5 py-3 font-semibold">{names.get(m.product) ?? m.product}</td>
                    <td className="border-b border-elevated px-2.5 py-3">{m.fit}%</td>
                    <td className="border-b border-elevated px-2.5 py-3 font-bold">{m.price != null ? `฿${fmt(m.price)}` : "ไม่ระบุ"}</td>
                    <td className="border-b border-elevated px-2.5 py-3">{m.cheaper_than_market_pct != null ? `${m.cheaper_than_market_pct}%` : "–"}</td>
                    <td className="border-b border-elevated px-2.5 py-3">
                      <div className="flex flex-col">
                        {m.author_url ? <a href={m.author_url} target="_blank" rel="noreferrer">{m.author ?? "ผู้ขาย"}</a> : <span>{m.author ?? "–"}</span>}
                        <span className="text-xs text-muted">{m.group}</span>
                      </div>
                    </td>
                    <td className="border-b border-elevated px-2.5 py-3 text-soft">{ago(m.posted_at)}</td>
                    <td className="border-b border-elevated px-2.5 py-3">
                      <div className="flex max-w-[360px] flex-col gap-1 text-xs">
                        {m.has.length > 0 && <span className="text-soft">มี: {m.has.join(", ")}</span>}
                        {m.missing.length > 0 && <span className="text-warn">ขาด: {m.missing.join(", ")}</span>}
                        {m.nice_found.length > 0 && <span className="text-primary-pale">โบนัส: {m.nice_found.join(", ")}</span>}
                        {m.flags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {m.flags.map((f) => <span key={f} className="rounded-full bg-[#3F1418] px-2 py-0.5 text-[11px] font-semibold text-red-300">{f}</span>)}
                          </div>
                        )}
                        {m.note && <span className="text-muted">{m.note}</span>}
                      </div>
                    </td>
                    <td className="border-b border-elevated px-2.5 py-3">
                      <a href={m.post_url} target="_blank" rel="noreferrer" className="btn-ghost min-h-10 px-3 text-xs no-underline">
                        เปิดโพสต์ <Icon name="external" size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
