import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    brand_id?: string | null;
    store_id?: string | null;
    channel_id?: string;
    channel_secret?: string;
    channel_access_token?: string;
    destination?: string;
  } | null;

  if (
    !body?.name?.trim() ||
    !body.store_id ||
    !body.channel_id?.trim() ||
    !body.channel_secret?.trim() ||
    !body.channel_access_token?.trim()
  ) {
    return NextResponse.json(
      { error: "name, store_id, channel_id, channel_secret and token are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("line_accounts")
    .insert({
      name: body.name.trim(),
      brand_id: body.brand_id || null,
      store_id: body.store_id,
      channel_id: body.channel_id.trim(),
      channel_secret: body.channel_secret.trim(),
      channel_access_token: body.channel_access_token.trim(),
      destination: body.destination?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ line_account: data });
}
