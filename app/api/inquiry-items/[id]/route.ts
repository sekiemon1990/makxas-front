import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { InquiryItemCondition, InquiryItemQuoteType } from "@/types/database";

// PATCH /api/inquiry-items/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as {
    item_name?: string;
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
  };
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("inquiry_items")
    .update(body)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/inquiry-items/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from("inquiry_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
