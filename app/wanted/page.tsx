import { PageHeader } from "@/components/form";
import { WantedEditor } from "@/components/WantedEditor";
import { getGroups, getMarket, getWanted, listImages } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function WantedPage() {
  const wanted = getWanted();
  const groups = getGroups();
  const images = Object.fromEntries(wanted.map((w) => [w.id, listImages(w.id)]));
  const games = [...new Set([...groups.flatMap((g) => g.games), ...wanted.map((w) => w.game), ...getMarket().track.map((t) => t.game)].filter(Boolean))];
  return (
    <>
      <PageHeader title="สินค้าที่ต้องการ" sub="สินค้าที่ให้ไปหาในกลุ่ม · เก็บใน data/wanted.json" />
      <WantedEditor initial={wanted} images={images} groupIds={groups.map((g) => g.id)} games={games} />
    </>
  );
}
