import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { InquiryItem } from "@/types/database";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const body = await request.json() as {
    inquiry_id: string;
    lead_id?: string | null;
    message_id?: string | null;
    text?: string | null;
    image_urls?: string[];
  };

  if (!body.inquiry_id) {
    return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });
  }
  if (!body.text && (!body.image_urls || body.image_urls.length === 0)) {
    return NextResponse.json({ error: "text or image_urls required" }, { status: 400 });
  }

  const systemPrompt = `あなたは買取査定の専門AIです。顧客から送られてきたメッセージや画像から、査定対象の商品情報を抽出してください。

抽出するフィールド:
- item_name: 商品名（必須。不明な場合は「不明な商品」）
- brand: ブランド名（任意）
- model_number: 型番・品番（任意）
- condition: 状態（N=新品未使用/S=未使用に近い/A=目立った傷なし/B=少し傷あり/C=傷や汚れあり/D=かなり傷あり/J=ジャンク/不明/その他）
- accessories: 付属品（箱、保証書、ストラップ等。カンマ区切り）
- notes: その他の補足情報

複数の商品が含まれる場合は配列で返してください。
商品情報が見つからない場合（挨拶のみ、質問のみ等）は空の配列を返してください。

必ず以下のJSON形式のみで返答してください（説明文不要）:
{"items": [{"item_name": "...", "brand": "...", "model_number": "...", "condition": "A", "accessories": "...", "notes": "..."}]}`;

  const messageContent: Anthropic.MessageParam["content"] = [];

  if (body.image_urls && body.image_urls.length > 0) {
    for (const url of body.image_urls) {
      try {
        // 画像をbase64に変換
        const imgResp = await fetch(url);
        if (imgResp.ok) {
          const buffer = await imgResp.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";
          const mediaType = (contentType.startsWith("image/") ? contentType : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
          messageContent.push({
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          });
        }
      } catch {
        // 画像取得失敗は無視
      }
    }
  }

  if (body.text) {
    messageContent.push({ type: "text", text: body.text });
  }

  if (messageContent.length === 0) {
    return NextResponse.json({ items: [], saved: [] });
  }

  let extractedItems: Array<{
    item_name: string;
    brand?: string | null;
    model_number?: string | null;
    condition?: string | null;
    accessories?: string | null;
    notes?: string | null;
  }> = [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: messageContent }],
    });

    const text = response.content.find((c) => c.type === "text")?.text ?? "{}";
    // JSONブロックを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { items?: typeof extractedItems };
      extractedItems = parsed.items ?? [];
    }
  } catch {
    return NextResponse.json({ error: "AI extraction failed" }, { status: 500 });
  }

  if (extractedItems.length === 0) {
    return NextResponse.json({ items: [], saved: [] });
  }

  // DBに保存
  const supabase = createServiceClient();
  const conditionValues = ['N', 'S', 'A', 'B', 'C', 'D', 'J', '不明', 'その他'] as const;
  const savedItems: InquiryItem[] = [];
  for (const item of extractedItems) {
    const condition = conditionValues.includes(item.condition as typeof conditionValues[number])
      ? (item.condition as typeof conditionValues[number])
      : null;
    const { data, error } = await supabase
      .from("inquiry_items")
      .insert({
        inquiry_id: body.inquiry_id,
        lead_id: body.lead_id ?? null,
        item_name: item.item_name ?? "不明な商品",
        brand: item.brand ?? null,
        model_number: item.model_number ?? null,
        condition,
        accessories: item.accessories ?? null,
        notes: item.notes ?? null,
        ai_extracted: true,
        source_message_id: body.message_id ?? null,
      })
      .select()
      .single();
    if (!error && data) savedItems.push(data);
  }

  return NextResponse.json({ items: extractedItems, saved: savedItems });
}
