import { PageHeader } from "@/components/form";
import { GroupsEditor, type GroupStat } from "@/components/GroupsEditor";
import { groupRows } from "@/lib/stats";
import { getConfig, getGroups, getGroupState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function GroupsPage() {
  const groups = getGroups();
  const rows = groupRows(groups, getGroupState(), getConfig());
  const stats: Record<string, GroupStat> = Object.fromEntries(rows.map((r) => [r.id, r]));
  return (
    <>
      <PageHeader title="กลุ่ม Facebook" sub="กลุ่มที่ให้ Claude ไปอ่าน · เก็บใน data/groups.json" />
      <GroupsEditor initial={groups} stats={stats} />
    </>
  );
}
