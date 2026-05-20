/**
 * PR43: 担当者引継ぎノート（AI要約）
 *
 * POST /api/ai/handover-summary
 * Body: { inquiry_id: string }
 *
 * 反響の会話履歴 + 内部メモ + 査定品目 + アポ情報を Haiku で要約し、
 * 次の担当者がすぐに状況を把握できる「引継ぎノート」を生成する。
 *
 * MAKXAS思想:
 * 引継ぎ漏れで「追加買取のヒントが消える」のを防ぐため、レバー2 観点
 * （顧客プロファイル・追加提案候補・売却動機）を必ず含める。
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAiUsage } from "@/lib/ai/usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001" as const;

const SYSTEM_PROMPT = `あなたはマクサスのインサイドセールス引継ぎ支援AIです。
別スタッフへ反響を引き継ぐ際の「引継ぎノート」を作成します。

## 出力フォーマット (Markdown のみ・余計な前置きや説明なし)
### 1行サマリー
（顧客が何を売りたく、現在どの段階か - 50文字以内）

### 重要ポイント
- （箇条書き 3-5 件・接客上の注意・好み・約束ごと）

### 顧客プロファイル (レバー2観点)
- 推定属性: （年齢層・所得感・売却動機）
- 追加買取候補: （高単価から優先・なければ「未確認」）

### 次のアクション
- （箇条書き 1-3 件・最優先タスク）

### 注意事項 / リスク
- （あれば箇条書き・なければ「なし」）

出力は上記 Markdown のみ。前置きや「了解しました」等は不要。`;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    inquiry_id?: string;
  } | null;
  if (!body?.inquiry_id) {
    return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 反響本体 + リード + メモ + プロファイル
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (supabase as any)
    .from("inquiries")
    .select(
      "id, channel, status, internal_note, customer_profile, suggested_items, approach_hint, leads(display_name), brands(name), inquiry_tags(tag)",
    )
    .eq("id", body.inquiry_id)
    .maybeSingle();
  if (!inquiry) {
    return NextResponse.json({ error: "inquiry not found" }, { status: 404 });
  }

  // 会話履歴
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (supabase as any)
    .from("messages")
    .select("direction, body, is_auto, created_at")
    .eq("inquiry_id", body.inquiry_id)
    .order("created_at", { ascending: true })
    .limit(50);

  // 査定品目
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase as any)
    .from("inquiry_items")
    .select("item_name, brand, condition, estimated_price_min, quote_price_min")
    .eq("inquiry_id", body.inquiry_id);

  // 関連アポ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appts } = await (supabase as any)
    .from("appointments")
    .select("scheduled_at, item_category, item_description, address, preferred_method, status")
    .eq("inquiry_id", body.inquiry_id);

  const conversation = (messages ?? [])
    .map((m: { direction: string; body: string; is_auto: boolean }) => {
      const who = m.direction === "inbound" ? "顧客" : m.is_auto ? "システム" : "スタッフ";
      return `${who}: ${m.body ?? ""}`;
    })
    .join("\n");

  const context = {
    brand: inquiry.brands?.name ?? null,
    channel: inquiry.channel,
    status: inquiry.status,
    customer_name: inquiry.leads?.display_name ?? null,
    tags: (inquiry.inquiry_tags ?? []).map((t: { tag: string }) => t.tag),
    internal_note: inquiry.internal_note,
    customer_profile: inquiry.customer_profile,
    suggested_items: inquiry.suggested_items,
    approach_hint: inquiry.approach_hint,
    items: items ?? [],
    appointments: appts ?? [],
  };

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `以下の反響情報から引継ぎノートを Markdown で作成してください。\n\n## 文脈\n${JSON.stringify(context, null, 2)}\n\n## 会話履歴\n${conversation || "（メッセージなし）"}`,
        },
      ],
    });

    await logAiUsage({
      category: "suggest",
      model: MODEL,
      usage: response.usage,
      endpoint: "/api/ai/handover-summary",
      inquiryId: body.inquiry_id,
      messageId: null,
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();

    return NextResponse.json({ summary: text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "handover-summary failed" },
      { status: 500 },
    );
  }
}
