import { PageHeader } from "@/components/form";
import { MarketEditor } from "@/components/MarketEditor";
import { discoveredItems } from "@/lib/stats";
import { getLog, getMarket } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function MarketPage() {
  const market = getMarket();
  return (
    <>
      <PageHeader title="รายการติดตามความนิยม" sub="ของที่ให้นับในรายงาน · เก็บใน data/market.json" />
      <MarketEditor initial={market} discovered={discoveredItems(getLog(), market)} />
    </>
  );
}
