import { AppShell } from "@/components/app-shell";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  ComparisonSiteAccount,
  EmailAccount,
  LineAccount,
  Staff,
  StaffStoreAccess,
  Store,
} from "@/types/database";

import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createServiceClient();
  const [
    storesResult,
    lineAccountsResult,
    emailAccountsResult,
    comparisonAccountsResult,
    staffResult,
    staffAccessResult,
  ] = await Promise.all([
    supabase.from("stores").select("*").order("created_at", { ascending: false }),
    supabase
      .from("line_accounts")
      .select("*, stores(id,name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("email_accounts")
      .select("*, stores(id,name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("comparison_site_accounts")
      .select("*, stores(id,name)")
      .order("created_at", { ascending: false }),
    supabase.from("staff").select("*").order("created_at", { ascending: false }),
    supabase
      .from("staff_store_access")
      .select("*, staff(id,name,email), stores(id,name)")
      .order("store_id", { ascending: true }),
  ]);

  return (
    <AppShell>
      <SettingsClient
        comparisonAccounts={
          (comparisonAccountsResult.data ?? []) as Array<
            ComparisonSiteAccount & { stores: Pick<Store, "id" | "name"> | null }
          >
        }
        emailAccounts={
          (emailAccountsResult.data ?? []) as Array<
            EmailAccount & { stores: Pick<Store, "id" | "name"> | null }
          >
        }
        lineAccounts={
          (lineAccountsResult.data ?? []) as Array<
            LineAccount & { stores: Pick<Store, "id" | "name"> | null }
          >
        }
        staff={(staffResult.data ?? []) as Staff[]}
        staffAccess={
          (staffAccessResult.data ?? []) as Array<
            StaffStoreAccess & {
              staff: Pick<Staff, "id" | "name" | "email"> | null;
              stores: Pick<Store, "id" | "name"> | null;
            }
          >
        }
        stores={(storesResult.data ?? []) as Store[]}
      />
    </AppShell>
  );
}
