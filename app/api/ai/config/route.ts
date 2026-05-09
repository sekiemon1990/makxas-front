import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

type AiConfig = { id: string; system_prompt: string; updated_at: string };

export async function GET() {
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("ai_config").select("*").eq("id", "default").maybeSingle() as { data: AiConfig | null };
  return NextResponse.json({ system_prompt: data?.system_prompt ?? "" });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null) as { system_prompt?: string } | null;
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("ai_config")
    .upsert({ id: "default", system_prompt: body?.system_prompt ?? "", updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
