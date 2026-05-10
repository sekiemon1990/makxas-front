import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data, error } = await supabase
    .from("assignment_rules")
    .select("*, staff:assigned_staff_id(id,name)")
    .order("priority", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    channel?: string | null;
    keyword?: string | null;
    assigned_staff_id?: string | null;
    priority?: number;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data, error } = await supabase
    .from("assignment_rules")
    .insert({
      name: body.name.trim(),
      channel: body.channel ?? null,
      keyword: body.keyword?.trim() || null,
      assigned_staff_id: body.assigned_staff_id ?? null,
      priority: body.priority ?? 0,
    })
    .select("*, staff:assigned_staff_id(id,name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}
