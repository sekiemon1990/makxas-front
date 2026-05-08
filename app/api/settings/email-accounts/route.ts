import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    store_id?: string;
    email?: string;
    display_name?: string;
    purpose?: "inquiry" | "reply";
  } | null;

  if (!body?.store_id || !body.email?.trim()) {
    return NextResponse.json(
      { error: "store_id and email are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_accounts")
    .insert({
      store_id: body.store_id,
      email: body.email.trim().toLowerCase(),
      display_name: body.display_name?.trim() || null,
      purpose: body.purpose ?? "inquiry",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ email_account: data });
}
