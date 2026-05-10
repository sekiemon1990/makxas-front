import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Shift } from "@/types/database";

type ShiftRow = Shift & { staff?: { id: string; name: string } | null };

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to   = searchParams.get("to");   // YYYY-MM-DD

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (service as any)
    .from("shifts")
    .select("*, staff(id,name)")
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (from) query = query.gte("shift_date", from);
  if (to)   query = query.lte("shift_date", to);

  const { data, error } = await query as { data: ShiftRow[] | null; error: { message: string } | null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shifts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    staff_id?: string;
    shift_date?: string;
    start_time?: string;
    end_time?: string;
    break_minutes?: number;
    note?: string;
  } | null;

  if (!body?.staff_id || !body.shift_date || !body.start_time || !body.end_time) {
    return NextResponse.json({ error: "staff_id, shift_date, start_time, end_time are required" }, { status: 400 });
  }

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service as any)
    .from("shifts")
    .upsert({
      staff_id: body.staff_id,
      shift_date: body.shift_date,
      start_time: body.start_time,
      end_time: body.end_time,
      break_minutes: body.break_minutes ?? 0,
      note: body.note ?? null,
    }, { onConflict: "staff_id,shift_date" })
    .select("*, staff(id,name)")
    .single() as { data: ShiftRow | null; error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shift: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (service as any).from("shifts").delete().eq("id", id) as { error: { message: string } | null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
