import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

type FeedbackLog = {
  id: string;
  type: string;
  author: string | null;
  title: string;
  body: string;
  page_href: string | null;
  status: string;
  created_at: string;
};

export async function GET() {
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("feedback_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100) as { data: FeedbackLog[] | null; error: { message: string } | null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedbacks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    type?: string; author?: string; title?: string; body?: string; page_href?: string;
  } | null;
  if (!body?.type || !body.title || !body.body) {
    return NextResponse.json({ error: "type, title, body required" }, { status: 400 });
  }
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("feedback_logs")
    .insert({ type: body.type, author: body.author ?? null, title: body.title, body: body.body, page_href: body.page_href ?? null, status: "open" })
    .select()
    .single() as { data: FeedbackLog | null; error: { message: string } | null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id || !body.status) return NextResponse.json({ error: "id, status required" }, { status: 400 });
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("feedback_logs")
    .update({ status: body.status })
    .eq("id", body.id)
    .select()
    .single() as { data: FeedbackLog | null; error: { message: string } | null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data });
}
