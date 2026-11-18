import { PageHeader } from "@/components/form";
import { WantedEditor } from "@/components/WantedEditor";
import { getGroups, getMarket, getWanted, listImages } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function WantedPage() {
  const [wanted, groups, market] = await Promise.all([getWanted(), getGroups(), getMarket()]);
  const images = await listImages(wanted.map((w) => w.id));
  const games = [...new Set([...groups.flatMap((g) => g.games), ...wanted.map((w) => w.game), ...market.track.map((t) => t.game)].filter(Boolean))];
  return (
    <>
      <PageHeader title="สินค้าที่ต้องการ" sub="สินค้าที่ให้ไปหาในกลุ่ม · เก็บในฐานข้อมูล" />
      <WantedEditor initial={wanted} images={images} groupIds={groups.map((g) => g.id)} games={games} />
    </>
  );
}
