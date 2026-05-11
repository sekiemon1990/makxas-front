import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type ImportRow = {
  staff_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  note?: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { rows?: ImportRow[] } | null;
  if (!body?.rows || body.rows.length === 0) {
    return NextResponse.json({ error: "rows は必須です" }, { status: 400 });
  }

  const service = createServiceClient();
  const errors: string[] = [];
  let inserted = 0;

  // バッチサイズ 50 で分割して upsert
  const chunkSize = 50;
  for (let i = 0; i < body.rows.length; i += chunkSize) {
    const chunk = body.rows.slice(i, i + chunkSize).map((r) => ({
      staff_id: r.staff_id,
      shift_date: r.shift_date,
      start_time: r.start_time,
      end_time: r.end_time,
      break_minutes: r.break_minutes ?? 0,
      note: r.note ?? null,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (service as any)
      .from("shifts")
      .upsert(chunk, { onConflict: "staff_id,shift_date", returning: "minimal" });

    if (error) {
      errors.push(`チャンク ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
    } else {
      inserted += count ?? chunk.length;
    }
  }

  return NextResponse.json({ inserted, errors });
}
