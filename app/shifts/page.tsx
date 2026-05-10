import { AppShell } from "@/components/app-shell";
import { createServiceClient } from "@/lib/supabase/service";
import type { Staff } from "@/types/database";
import { ShiftsClient } from "./ShiftsClient";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const service = createServiceClient();
  const { data: staffData } = await service
    .from("staff")
    .select("id,name,email,role,is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <AppShell>
      <ShiftsClient staff={(staffData ?? []) as Staff[]} />
    </AppShell>
  );
}
