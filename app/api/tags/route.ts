import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("inquiry_tags")
    .select("tag")
    .order("tag", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 重複除去
  const tags = [...new Set((data ?? []).map((row) => row.tag))];
  return NextResponse.json({ tags });
}
