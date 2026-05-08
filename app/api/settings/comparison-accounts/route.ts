import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    store_id?: string;
    site?: "oikura" | "uridoki" | "hikakaku";
    account_email?: string;
    notification_email?: string;
  } | null;

  if (!body?.store_id || !body.site) {
    return NextResponse.json(
      { error: "store_id and site are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("comparison_site_accounts")
    .insert({
      store_id: body.store_id,
      site: body.site,
      account_email: body.account_email?.trim().toLowerCase() || null,
      notification_email: body.notification_email?.trim().toLowerCase() || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comparison_account: data });
}
