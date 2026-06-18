import { NextResponse, type NextRequest } from "next/server";

import { normalizeEmail } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/** 呼び出し元が有効な admin スタッフか検証する。 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const service = createServiceClient();
  const { data: staff } = await service
    .from("staff")
    .select("role, is_active")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!staff || !staff.is_active || staff.role !== "admin") {
    return { ok: false as const, status: 403, error: "管理者権限が必要です" };
  }
  return { ok: true as const, service };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.service
    .from("auth_allowlist")
    .select("id, email, note, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ allowlist: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    note?: string;
  } | null;
  const email = body?.email ? normalizeEmail(body.email) : "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
  }

  const { data, error } = await auth.service
    .from("auth_allowlist")
    .upsert({ email, note: body?.note ?? null }, { onConflict: "email" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await auth.service.from("auth_allowlist").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
