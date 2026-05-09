import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, leads(display_name,phone,email), staff:staff_id(name)")
    .order("scheduled_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const headers = ["査定日時", "顧客名", "電話番号", "メール", "品目カテゴリ", "品物説明", "住所", "方法", "担当者", "ステータス", "作成日"];
  const escape = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => {
      const lead = r.leads as { display_name?: string | null; phone?: string | null; email?: string | null } | null;
      const staffMember = r.staff as { name?: string | null } | null;
      return [
        r.scheduled_at ? new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(r.scheduled_at)) : "",
        lead?.display_name,
        lead?.phone,
        lead?.email,
        r.item_category,
        r.item_description,
        r.address,
        r.preferred_method === "delivery" ? "宅配査定" : "訪問査定",
        staffMember?.name,
        r.status,
        r.created_at ? new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(r.created_at)) : "",
      ].map(escape).join(",");
    }),
  ];

  const csv = "﻿" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointments_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
