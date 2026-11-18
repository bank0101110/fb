import { PageHeader } from "@/components/form";
import { GroupsEditor, type GroupStat } from "@/components/GroupsEditor";
import { groupRows } from "@/lib/stats";
import { getConfig, getGroups, getGroupState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const [groups, state, cfg] = await Promise.all([getGroups(), getGroupState(), getConfig()]);
  const rows = groupRows(groups, state, cfg);
  const stats: Record<string, GroupStat> = Object.fromEntries(rows.map((r) => [r.id, r]));
  return (
    <>
      <PageHeader title="กลุ่ม Facebook" sub="กลุ่มที่ให้ Claude ไปอ่าน · เก็บในฐานข้อมูล" />
      <GroupsEditor initial={groups} stats={stats} />
    </>
  );
}
