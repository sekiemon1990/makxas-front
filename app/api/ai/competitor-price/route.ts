/**
 * PR31: 競合他社相場AI参照
 *
 * POST /api/ai/competitor-price
 * Body: { item_name, brand?, model_number?, condition?, category? }
 *
 * 主要競合（コメ兵・なんぼや・ブランディア・買取大吉・大黒屋 等）の
 * 中古買取相場を AI が推定して提示する。あくまで参考値として、
 * 自社の査定戦略策定に活用する。
 *
 * MAKXAS思想：レバー1（入口商品買い切り）の交渉武装を目的とする
 * ツール。レバー2優先という前提は変わらない。
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { logAiUsage } from "@/lib/ai/usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001" as const;

const SYSTEM_PROMPT = `あなたは買取業界の相場分析AIです。
日本の中古買取市場における競合他社（コメ兵・なんぼや・ブランディア・買取大吉・大黒屋・2nd STREET・BOOKOFF 等）の
買取相場レンジを推定し、JSON で返してください。

## 出力フォーマット（JSON のみ・説明文不要）
{
  "price_range_min": 数値（円・最低買取見込み）,
  "price_range_max": 数値（円・最高買取見込み）,
  "median_price": 数値（円・中央値）,
  "confidence": "high" | "medium" | "low",
  "reasoning": "なぜこの相場かの根拠（80文字以内）",
  "comparables": [
    { "competitor": "店名", "estimated_price": 数値, "note": "備考（30文字以内）" },
    ...
  ],
  "negotiation_hint": "マクサスとして打ち出すべき買取額アドバイス（80文字以内）"
}

## 注意
- 実際のリアルタイム価格は知らないため、知識ベースに基づく目安として明示する
- 不明な場合は confidence: "low" にする
- comparables は最大3件
- マクサスは出張買取主軸 → 店頭買取より物量取れるため強気の提示が可能`;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    item_name?: string;
    brand?: string;
    model_number?: string;
    condition?: string;
    category?: string;
    inquiry_id?: string;
  } | null;
  if (!body?.item_name) {
    return NextResponse.json({ error: "item_name required" }, { status: 400 });
  }

  const itemDesc = [
    `品名: ${body.item_name}`,
    body.brand ? `ブランド: ${body.brand}` : null,
    body.model_number ? `型番: ${body.model_number}` : null,
    body.condition ? `状態: ${body.condition}` : null,
    body.category ? `カテゴリ: ${body.category}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `以下の品物の競合相場を推定してください。\n\n${itemDesc}`,
        },
      ],
    });

    await logAiUsage({
      category: "suggest", // 暫定: competitor 専用カテゴリ未追加のため近接を流用
      model: MODEL,
      usage: response.usage,
      endpoint: "/api/ai/competitor-price",
      inquiryId: body.inquiry_id ?? null,
      messageId: null,
      meta: { item_name: body.item_name, brand: body.brand ?? null },
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI returned invalid JSON", raw: text },
        { status: 500 },
      );
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "competitor-price failed" },
      { status: 500 },
    );
  }
}
