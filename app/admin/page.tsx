import { AppShell } from "@/components/app-shell";
import { createServiceClient } from "@/lib/supabase/service";
import type { AssignmentRule, Staff, TagMaster } from "@/types/database";
import { AdminClient } from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServiceClient();

  const [staffRes, tagsRes, rulesRes] = await Promise.all([
    supabase
      .from("staff")
      .select("id,name,email,role,is_active,created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("tag_master")
      .select("*")
      .order("sort_order", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("assignment_rules")
      .select("*, staff:assigned_staff_id(id,name)")
      .order("priority", { ascending: true }),
  ]);

  return (
    <AppShell>
      <AdminClient
        initialStaff={(staffRes.data ?? []) as Staff[]}
        initialTags={(tagsRes.data ?? []) as TagMaster[]}
        initialRules={(rulesRes.data ?? []) as Array<AssignmentRule & { staff: Pick<Staff, "id" | "name"> | null }>}
        allStaff={(staffRes.data ?? []) as Staff[]}
      />
    </AppShell>
  );
}
