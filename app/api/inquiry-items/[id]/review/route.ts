import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// POST /api/inquiry-items/[id]/review
// body: { action: "approve" | "needs_correction", note?: string, reviewer_staff_id: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as {
    action: "approve" | "needs_correction";
    note?: string;
    reviewer_staff_id: string;
  };

  if (!body.action || !body.reviewer_staff_id) {
    return NextResponse.json({ error: "action and reviewer_staff_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const newStatus = body.action === "approve" ? "approved" : "needs_correction";

  const { data: item, error } = await supabase
    .from("inquiry_items")
    .update({
      quote_status: newStatus,
      quote_reviewed_by: body.reviewer_staff_id,
      quote_reviewed_at: new Date().toISOString(),
      quote_review_note: body.note ?? null,
    })
    .eq("id", id)
    .select("*, inquiries(id, internal_note)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 要修正の場合 → 反響の internal_note に追記
  if (body.action === "needs_correction" && item) {
    const inq = item.inquiries as { id: string; internal_note: string | null } | null;
    if (inq?.id) {
      const addedNote = `⚠️ [査定要修正] ${body.note ? body.note : "事前査定金額を確認してください。"}`;
      const existing = inq.internal_note ?? "";
      const newNote = existing ? `${existing}\n${addedNote}` : addedNote;
      await supabase
        .from("inquiries")
        .update({ internal_note: newNote })
        .eq("id", inq.id);
    }
  }

  return NextResponse.json(item);
}
