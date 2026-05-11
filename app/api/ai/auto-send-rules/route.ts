import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data, error } = await supabase
    .from("auto_send_rules")
    .select("*")
    .order("msg_category");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    msg_category?: string;
    auto_send_enabled?: boolean;
    edit_rate_threshold?: number;
    min_sample_size?: number;
    review_delay_minutes?: number;
  } | null;
  if (!body?.msg_category) return NextResponse.json({ error: "msg_category required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.auto_send_enabled !== undefined) update.auto_send_enabled = body.auto_send_enabled;
  if (body.edit_rate_threshold !== undefined) update.edit_rate_threshold = body.edit_rate_threshold;
  if (body.min_sample_size !== undefined) update.min_sample_size = body.min_sample_size;
  if (body.review_delay_minutes !== undefined) update.review_delay_minutes = body.review_delay_minutes;

  const { data, error } = await supabase
    .from("auto_send_rules")
    .upsert({ msg_category: body.msg_category, ...update }, { onConflict: "msg_category" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
