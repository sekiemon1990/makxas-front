import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 30;

type StaffRow = { id: string; name: string };

type ParsedShift = {
  staff_name: string;
  staff_id: string | null;
  shift_date: string;    // YYYY-MM-DD
  start_time: string;    // HH:MM
  end_time: string;      // HH:MM
  break_minutes: number;
  note: string;
  match_error?: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    type: "text" | "image";
    content: string;         // テキストの場合は本文、画像の場合は base64 data URL
    media_type?: string;     // 画像の場合: "image/jpeg" | "image/png" etc.
    year_month?: string;     // "YYYY-MM" (省略時は今月)
  } | null;

  if (!body?.type || !body.content) {
    return NextResponse.json({ error: "type と content は必須です" }, { status: 400 });
  }

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staffList } = await (service as any).from("staff").select("id,name").order("name") as { data: StaffRow[] | null };
  const staff = staffList ?? [];

  const staffListText = staff.map((s) => `- ${s.name} (id: ${s.id})`).join("\n");

  const yearMonth = body.year_month ?? new Date().toISOString().slice(0, 7);
  const [yyyy, mm] = yearMonth.split("-");

  const systemPrompt = `あなたはシフト表解析AIです。
スタッフ一覧と今月の年月を参考に、シフト情報を構造化JSONとして出力してください。

# スタッフ一覧
${staffListText}

# 対象年月
${yyyy}年${mm}月

# 出力形式（JSON配列のみ、説明文不要）
[
  {
    "staff_name": "スタッフ名（原文のまま）",
    "staff_id": "一覧から一致するID、不明なら null",
    "shift_date": "YYYY-MM-DD",
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "break_minutes": 60,
    "note": "メモがあれば、なければ空文字"
  }
]

# ルール
- 日付が「10/1」形式なら対象年月を補完して「${yyyy}-${mm}-01」形式に変換
- 日付が「1日」「1」のみなら対象年月で補完
- 時間が「10時〜19時」「10:00-19:00」「10〜19」等いずれも「HH:MM」形式に正規化
- break_minutes はシフト表に記載がなければ 0
- スタッフ名が一覧にない場合、staff_id は null のまま（削除しない）`;

  const client = new Anthropic();

  let messageContent: Anthropic.MessageParam["content"];

  if (body.type === "image") {
    // base64 data URL から base64 部分を抽出
    const base64Match = body.content.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json({ error: "画像形式が不正です（base64 data URL が必要です）" }, { status: 400 });
    }
    const mediaType = base64Match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const base64Data = base64Match[2]!;

    messageContent = [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64Data },
      },
      {
        type: "text",
        text: "上記のシフト表画像を解析し、指定のJSON形式で出力してください。",
      },
    ];
  } else {
    messageContent = [
      {
        type: "text",
        text: `以下のシフトテキストを解析してください:\n\n${body.content}`,
      },
    ];
  }

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: messageContent }],
  });

  const rawText = response.content[0]?.type === "text" ? response.content[0].text : "";
  const jsonMatch = rawText.match(/\[[\s\S]+\]/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "AIが有効なJSONを返しませんでした", raw: rawText }, { status: 422 });
  }

  const parsed = JSON.parse(jsonMatch[0]) as ParsedShift[];

  // staff_id が null のものは名前から再マッチ試みる
  const resolved = parsed.map((row) => {
    if (!row.staff_id) {
      const match = staff.find((s) => s.name === row.staff_name || s.name.includes(row.staff_name) || row.staff_name.includes(s.name));
      if (match) {
        return { ...row, staff_id: match.id };
      }
      return { ...row, match_error: `スタッフ「${row.staff_name}」が登録されていません` };
    }
    return row;
  });

  return NextResponse.json({ rows: resolved });
}
