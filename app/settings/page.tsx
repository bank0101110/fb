import { PageHeader } from "@/components/form";
import { SettingsEditor } from "@/components/SettingsEditor";
import { getConfig } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  return (
    <>
      <PageHeader title="ตั้งค่า" sub="ค่าการอ่านกลุ่มและคัดผล · เก็บในฐานข้อมูล Supabase" />
      <SettingsEditor initial={await getConfig()} />
    </>
  );
}
