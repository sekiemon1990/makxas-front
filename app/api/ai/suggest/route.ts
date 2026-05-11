import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5";

export const THEMES = [
  { key: "photo", label: "📸 写真を依頼する" },
  { key: "price", label: "💰 価格の目安を伝える" },
  { key: "appo",  label: "📅 アポを提案する" },
  { key: "info",  label: "❓ 追加情報を確認する" },
] as const;

export type ThemeKey = typeof THEMES[number]["key"];

export type AiSuggestResult = {
  mode: "auto" | "themes";
  msg_category: string;
  theme: ThemeKey | null;
  body: string | null;
  themes: { key: ThemeKey; label: string; confidence: number }[];
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { inquiry_id?: string } | null;
  if (!body?.inquiry_id) {
    return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 反響・リード・メッセージ履歴を取得
  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("*, leads(*), stores(name), brands(name), inquiry_tags(*)")
    .eq("id", body.inquiry_id)
    .maybeSingle();

  if (!inquiry) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: rawMessages } = await supabase
    .from("messages")
    .select("direction, body, created_at")
    .eq("inquiry_id", body.inquiry_id)
    .order("created_at", { ascending: true })
    .limit(20);

  const messages = rawMessages ?? [];
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");

  // 受信メッセージがない場合はテーマ選択モードを返す
  if (!lastInbound?.body) {
    return NextResponse.json({
      mode: "themes",
      msg_category: "initial_contact",
      theme: null,
      body: null,
      themes: THEMES.map((t, i) => ({ ...t, confidence: 1 - i * 0.1 })),
    } satisfies AiSuggestResult);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    // APIキー未設定時はフォールバック
    return NextResponse.json({
      mode: "themes",
      msg_category: "initial_contact",
      theme: null,
      body: null,
      themes: THEMES.map((t, i) => ({ ...t, confidence: 1 - i * 0.1 })),
    } satisfies AiSuggestResult);
  }

  const client = new Anthropic();

  const storeName  = (inquiry.stores  as { name: string } | null)?.name  ?? "未設定";
  const brandName  = (inquiry.brands  as { name: string } | null)?.name  ?? "未設定";
  const leadName   = (inquiry.leads   as { display_name?: string; phone?: string; email?: string } | null)?.display_name
    ?? (inquiry.leads as { phone?: string } | null)?.phone
    ?? (inquiry.leads as { email?: string } | null)?.email
    ?? "不明";
  const tags = ((inquiry.inquiry_tags as { tag: string }[] | null) ?? []).map((t) => t.tag).join(", ") || "なし";

  const convHistory = messages
    .map((m) => `[${m.direction === "inbound" ? "顧客" : "スタッフ"}] ${m.body ?? ""}`)
    .join("\n");

  const systemPrompt = `あなたは買取店のインサイドセールスAIアシスタントです。
顧客からのメッセージを分析し、最適な返信案を提案します。

必ず以下のJSON形式のみを返してください（説明文不要）：
{
  "mode": "auto" または "themes",
  "msg_category": "price_inquiry|appo_request|condition_detail|photo_submit|followup_question|initial_contact" のいずれか,
  "theme": "photo|price|appo|info" のいずれか（modeがautoの場合のみ）,
  "body": "返信文（modeがautoの場合のみ、丁寧な敬語で）",
  "themes": [
    { "key": "photo|price|appo|info", "confidence": 0〜1の数値 }
  ]
}

mode判定基準:
- auto: 意図が明確で最適な返信がほぼ1通りに決まる場合
  例）「いくらになりますか」→ price, 「来てもらえますか」→ appo
- themes: 複数のアプローチが考えられる場合、または初回問い合わせ

themes配列は確信度の高い順に並べること。

買取スタッフの返信文ルール:
- 敬称は「〇〇様」
- 落ち着いた・丁寧な文体
- 感謝の言葉から始める
- ブランド名を明記する
- 署名不要`;

  const userContent = `## 反響情報
- 顧客名: ${leadName}
- チャネル: ${inquiry.channel ?? "不明"}
- ブランド: ${brandName} / 店舗: ${storeName}
- 件名: ${inquiry.subject ?? "なし"}
- タグ: ${tags}

## 会話履歴
${convHistory}

## 最新の顧客メッセージ（分析対象）
${lastInbound.body}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) throw new Error("JSON not found in response");
    const parsed = JSON.parse(jsonMatch[0]) as {
      mode?: string;
      msg_category?: string;
      theme?: string;
      body?: string;
      themes?: { key: string; confidence: number }[];
    };

    // msg_category を inquiries に保存
    const category = parsed.msg_category ?? "initial_contact";
    await supabase
      .from("inquiries")
      .update({ msg_category: category })
      .eq("id", body.inquiry_id);

    // themes を正規化（ラベル補完・順序保持）
    const rawThemes = parsed.themes ?? [];
    const normalizedThemes = THEMES.map((t) => {
      const found = rawThemes.find((r) => r.key === t.key);
      return { ...t, confidence: found?.confidence ?? 0 };
    }).sort((a, b) => b.confidence - a.confidence);

    const result: AiSuggestResult = {
      mode: parsed.mode === "auto" ? "auto" : "themes",
      msg_category: category,
      theme: (parsed.theme as ThemeKey | undefined) ?? null,
      body: parsed.body ?? null,
      themes: normalizedThemes,
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error("[ai/suggest] error:", e);
    // フォールバック
    return NextResponse.json({
      mode: "themes",
      msg_category: "initial_contact",
      theme: null,
      body: null,
      themes: THEMES.map((t, i) => ({ ...t, confidence: 1 - i * 0.1 })),
    } satisfies AiSuggestResult);
  }
}
