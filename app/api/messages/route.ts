import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/types/database";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    inquiry_id?: string;
    body?: string;
  } | null;

  if (!body?.inquiry_id || !body.body?.trim()) {
    return NextResponse.json(
      { error: "inquiry_id and body are required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      inquiry_id: body.inquiry_id,
      direction: "outbound",
      body: body.body.trim(),
      sent_by: staff?.id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("first_response_at")
    .eq("id", body.inquiry_id)
    .maybeSingle();

  await supabase
    .from("inquiries")
    .update({
      updated_at: now,
      first_response_at: inquiry?.first_response_at ?? now,
    })
    .eq("id", body.inquiry_id);

  return NextResponse.json({ message: message as Message });
}
