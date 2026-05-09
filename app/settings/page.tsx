import { AppShell } from "@/components/app-shell";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  Brand,
  ComparisonSiteAccount,
  EmailAccount,
  LineAccount,
  Staff,
  StaffBrandAccess,
  Store,
} from "@/types/database";

import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createServiceClient();
  const [
    brandsResult,
    storesResult,
    lineAccountsResult,
    emailAccountsResult,
    comparisonAccountsResult,
    staffResult,
    staffBrandAccessResult,
  ] = await Promise.all([
    supabase.from("brands").select("*").order("created_at", { ascending: false }),
    supabase
      .from("stores")
      .select("*, brands(id,name,brand_code)")
      .order("created_at", { ascending: false }),
    supabase
      .from("line_accounts")
      .select("*, brands(id,name,brand_code), stores(id,name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("email_accounts")
      .select("*, brands(id,name,brand_code), stores(id,name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("comparison_site_accounts")
      .select("*, brands(id,name,brand_code), stores(id,name)")
      .order("created_at", { ascending: false }),
    supabase.from("staff").select("*").order("created_at", { ascending: false }),
    supabase
      .from("staff_brand_access")
      .select("*, staff(id,name,email), brands(id,name,brand_code)")
      .order("brand_id", { ascending: true }),
  ]);

  return (
    <AppShell>
      <SettingsClient
        brands={(brandsResult.data ?? []) as Brand[]}
        comparisonAccounts={
          (comparisonAccountsResult.data ?? []) as Array<
            ComparisonSiteAccount & {
              brands: Pick<Brand, "id" | "name" | "brand_code"> | null;
              stores: Pick<Store, "id" | "name"> | null;
            }
          >
        }
        emailAccounts={
          (emailAccountsResult.data ?? []) as Array<
            EmailAccount & {
              brands: Pick<Brand, "id" | "name" | "brand_code"> | null;
              stores: Pick<Store, "id" | "name"> | null;
            }
          >
        }
        lineAccounts={
          (lineAccountsResult.data ?? []) as Array<
            LineAccount & {
              brands: Pick<Brand, "id" | "name" | "brand_code"> | null;
              stores: Pick<Store, "id" | "name"> | null;
            }
          >
        }
        staff={(staffResult.data ?? []) as Staff[]}
        staffBrandAccess={
          (staffBrandAccessResult.data ?? []) as Array<
            StaffBrandAccess & {
              staff: Pick<Staff, "id" | "name" | "email"> | null;
              brands: Pick<Brand, "id" | "name" | "brand_code"> | null;
            }
          >
        }
        stores={
          (storesResult.data ?? []) as Array<
            Store & {
              brands: Pick<Brand, "id" | "name" | "brand_code"> | null;
            }
          >
        }
      />
    </AppShell>
  );
}
