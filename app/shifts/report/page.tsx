import { AppShell } from "@/components/app-shell";
import { createServiceClient } from "@/lib/supabase/service";
import type { Shift, Staff } from "@/types/database";
import { ReportClient } from "./ReportClient";

export const dynamic = "force-dynamic";

type ShiftWithStaff = Shift & { staff?: Pick<Staff, "id" | "name"> | null };

export default async function ShiftReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month =
    params.month ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(year!, mon!, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  const service = createServiceClient();

  const [{ data: staffData }, { data: shiftData }] = await Promise.all([
    service
      .from("staff")
      .select("id,name,email,role,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)
      .from("shifts")
      .select("*, staff(id,name)")
      .gte("shift_date", from)
      .lte("shift_date", to),
  ]);

  return (
    <AppShell>
      <ReportClient
        month={month}
        shifts={(shiftData ?? []) as ShiftWithStaff[]}
        staff={(staffData ?? []) as Staff[]}
      />
    </AppShell>
  );
}
