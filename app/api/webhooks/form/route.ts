import { NextResponse, type NextRequest } from "next/server";

import { updateInquirySuggestedReply } from "@/lib/ai/suggest-reply";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    phone?: string;
    email?: string;
    item_category?: string;
    item_description?: string;
  } | null;

  if (!body?.name || !body.email || !body.item_description) {
    return NextResponse.json(
      { error: "name, email and item_description are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const normalizedEmail = body.email.trim().toLowerCase();

  const { data: existingLead } = await supabase
    .from("leads")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  const leadPayload = {
    display_name: body.name.trim(),
    phone: body.phone?.trim() || null,
    email: normalizedEmail,
    first_channel: "web_form" as const,
  };

  const { data: lead, error: leadError } = existingLead
    ? await supabase
        .from("leads")
        .update(leadPayload)
        .eq("id", existingLead.id)
        .select("*")
        .single()
    : await supabase
        .from("leads")
        .insert(leadPayload)
        .select("*")
        .single();

  if (leadError || !lead) {
    return NextResponse.json(
      { error: leadError?.message ?? "Failed to save lead" },
      { status: 500 },
    );
  }

  const { data: inquiry, error: inquiryError } = await supabase
    .from("inquiries")
    .insert({
      lead_id: lead.id,
      channel: "web_form",
      status: "new",
      subject: `${body.item_category ?? "その他"}の査定依頼`,
      flow_data: {
        item_category: body.item_category ?? null,
        item_description: body.item_description,
      },
    })
    .select("*")
    .single();

  if (inquiryError || !inquiry) {
    return NextResponse.json(
      { error: inquiryError?.message ?? "Failed to save inquiry" },
      { status: 500 },
    );
  }

  const messageBody = [
    `氏名: ${body.name}`,
    `電話番号: ${body.phone ?? ""}`,
    `メール: ${normalizedEmail}`,
    `品目カテゴリ: ${body.item_category ?? ""}`,
    "",
    body.item_description,
  ].join("\n");

  const { error: messageError } = await supabase.from("messages").insert({
    inquiry_id: inquiry.id,
    direction: "inbound",
    body: messageBody,
  });

  if (messageError) {
    return NextResponse.json(
      { error: messageError.message },
      { status: 500 },
    );
  }

  void updateInquirySuggestedReply(supabase, inquiry.id).catch((error) => {
    console.error("Form AI reply suggestion failed", error);
  });

  return NextResponse.json({ ok: true, lead, inquiry });
}
