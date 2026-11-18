import { PageHeader } from "@/components/form";
import { MarketEditor } from "@/components/MarketEditor";
import { discoveredItems } from "@/lib/stats";
import { getLog, getMarket } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const [market, log] = await Promise.all([getMarket(), getLog()]);
  return (
    <>
      <PageHeader title="รายการติดตามความนิยม" sub="ของที่ให้นับในรายงาน · เก็บในฐานข้อมูล" />
      <MarketEditor initial={market} discovered={discoveredItems(log, market)} />
    </>
  );
}
