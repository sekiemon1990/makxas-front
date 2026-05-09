import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: lead } = await supabase.from("leads").select("phone, email").eq("id", id).maybeSingle();
  if (!lead) return NextResponse.json({ duplicates: [] });

  const conditions: string[] = [];
  if (lead.phone) conditions.push(`phone.eq.${lead.phone}`);
  if (lead.email) conditions.push(`email.eq.${lead.email}`);
  if (conditions.length === 0) return NextResponse.json({ duplicates: [] });

  const { data: duplicates } = await supabase
    .from("leads")
    .select("id, display_name, phone, email, first_channel, created_at")
    .or(conditions.join(","))
    .neq("id", id)
    .limit(5);

  return NextResponse.json({ duplicates: duplicates ?? [] });
}
