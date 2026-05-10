import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type MonthlyGoalRow = {
  id: string;
  month: string;
  goal_type: string;
  target: number;
  label: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service as any)
    .from("monthly_goals")
    .select("*")
    .order("month", { ascending: false }) as { data: MonthlyGoalRow[] | null; error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goals: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    month?: string;      // 'YYYY-MM'
    goal_type?: string;
    target?: number;
    label?: string;
  } | null;

  if (!body?.month || !body.goal_type || !body.target) {
    return NextResponse.json({ error: "month, goal_type, target are required" }, { status: 400 });
  }

  // month を 'YYYY-MM-01' 形式に変換
  const monthDate = `${body.month}-01`;

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service as any)
    .from("monthly_goals")
    .upsert(
      {
        month: monthDate,
        goal_type: body.goal_type,
        target: body.target,
        label: body.label ?? null,
      },
      { onConflict: "month,goal_type" },
    )
    .select("*")
    .single() as { data: MonthlyGoalRow | null; error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (service as any).from("monthly_goals").delete().eq("id", id) as { error: { message: string } | null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
