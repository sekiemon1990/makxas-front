import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { InquiryItemCondition, InquiryItemQuoteType } from "@/types/database";

// GET /api/inquiry-items?inquiry_id=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const inquiryId = searchParams.get("inquiry_id");
  if (!inquiryId) {
    return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("inquiry_items")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/inquiry-items
export async function POST(request: Request) {
  const body = await request.json() as {
    inquiry_id: string;
    lead_id?: string | null;
    item_name: string;
    brand?: string | null;
    model_number?: string | null;
    condition?: InquiryItemCondition | null;
    accessories?: string | null;
    estimated_price_min?: number | null;
    estimated_price_max?: number | null;
    quote_type?: InquiryItemQuoteType | null;
    quote_price_min?: number | null;
    quote_price_max?: number | null;
    notes?: string | null;
    ai_extracted?: boolean;
    source_message_id?: string | null;
  };
  if (!body.inquiry_id || !body.item_name) {
    return NextResponse.json({ error: "inquiry_id and item_name required" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("inquiry_items")
    .insert({
      inquiry_id: body.inquiry_id,
      lead_id: body.lead_id ?? null,
      item_name: body.item_name,
      brand: body.brand ?? null,
      model_number: body.model_number ?? null,
      condition: body.condition ?? null,
      accessories: body.accessories ?? null,
      estimated_price_min: body.estimated_price_min ?? null,
      estimated_price_max: body.estimated_price_max ?? null,
      quote_type: body.quote_type ?? null,
      quote_price_min: body.quote_price_min ?? null,
      quote_price_max: body.quote_price_max ?? null,
      notes: body.notes ?? null,
      ai_extracted: body.ai_extracted ?? false,
      source_message_id: body.source_message_id ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
