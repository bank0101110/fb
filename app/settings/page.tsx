import { PageHeader } from "@/components/form";
import { SettingsEditor } from "@/components/SettingsEditor";
import { DATA_DIR, getConfig } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="ตั้งค่า" sub={`ค่าการอ่านกลุ่มและคัดผล · เก็บใน data/config.json · โฟลเดอร์ข้อมูล: ${DATA_DIR}`} />
      <SettingsEditor initial={getConfig()} />
    </>
  );
}
