import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data } = await service
    .from("reminders")
    .select("*, staff(name)")
    .eq("inquiry_id", id)
    .order("remind_at", { ascending: true });

  return NextResponse.json({ reminders: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    remind_at?: string;
    note?: string;
  } | null;

  if (!body?.remind_at) {
    return NextResponse.json({ error: "remind_at is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: staff } = await service
    .from("staff")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 403 });

  const { data, error } = await service
    .from("reminders")
    .insert({
      inquiry_id: id,
      staff_id: staff.id,
      remind_at: body.remind_at,
      note: body.note ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: inquiryId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reminder_id } = (await request.json().catch(() => ({}))) as { reminder_id?: string };
  if (!reminder_id) return NextResponse.json({ error: "reminder_id required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("reminders")
    .delete()
    .eq("id", reminder_id)
    .eq("inquiry_id", inquiryId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
