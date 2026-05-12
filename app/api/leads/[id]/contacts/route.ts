import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Params = { params: Promise<{ id: string }> };

// GET: リードの連絡先一覧取得
export async function GET(_req: Request, { params }: Params) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("lead_contacts")
    .select("*")
    .eq("lead_id", id)
    .order("type")
    .order("is_primary", { ascending: false })
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [] });
}

// POST: 連絡先追加
export async function POST(req: Request, { params }: Params) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    type: "line" | "phone" | "email" | "other";
    value: string;
    label?: string;
    is_primary?: boolean;
  };

  if (!body.type || !body.value?.trim()) {
    return NextResponse.json({ error: "type と value は必須です" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // is_primaryをtrueにする場合、同じtypeの既存primaryをfalseに
  if (body.is_primary) {
    await supabase
      .from("lead_contacts")
      .update({ is_primary: false })
      .eq("lead_id", id)
      .eq("type", body.type)
      .eq("is_primary", true);
  }

  const { data, error } = await supabase
    .from("lead_contacts")
    .insert({
      lead_id: id,
      type: body.type,
      value: body.value.trim(),
      label: body.label ?? null,
      is_primary: body.is_primary ?? false,
      source: "manual",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "この連絡先はすでに登録されています" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data });
}

// DELETE: 連絡先削除（クエリパラメータ contact_id を使用）
export async function DELETE(req: Request, { params }: Params) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const contactId = url.searchParams.get("contact_id");

  if (!contactId) return NextResponse.json({ error: "contact_id は必須です" }, { status: 400 });

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("lead_contacts")
    .delete()
    .eq("id", contactId)
    .eq("lead_id", id); // セキュリティ: 指定リードの連絡先のみ削除可

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
