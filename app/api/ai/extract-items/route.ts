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

  // text/image_urls が未指定の場合、DBから反響のメッセージを自動取得
  if (!body.text && (!body.image_urls || body.image_urls.length === 0)) {
    const supabase = createServiceClient();
    const { data: msgs } = await supabase
      .from("messages")
      .select("body, media_urls, direction")
      .eq("inquiry_id", body.inquiry_id)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(10);

    if (msgs && msgs.length > 0) {
      const texts = msgs.map((m) => m.body).filter(Boolean) as string[];
      if (texts.length > 0) body.text = texts.join("\n");
      const imgUrls = msgs.flatMap((m) => (m.media_urls as string[] | null) ?? []).filter(Boolean);
      if (imgUrls.length > 0) body.image_urls = imgUrls;
    }

    if (!body.text && (!body.image_urls || body.image_urls.length === 0)) {
      return NextResponse.json({ error: "No messages found for this inquiry" }, { status: 400 });
    }
  }

  const systemPrompt = `あなたは買取査定の専門AIです。顧客から送られてきたメッセージや画像を解析し、以下の2つを行ってください。

【1. 商品情報の抽出】
items 配列として返す。各フィールド:
- item_name: 商品名（必須。不明な場合は「不明な商品」）
- brand: ブランド名（任意）
- model_number: 型番・品番（任意）
- condition: 状態（N=新品未使用/S=未使用に近い/A=目立った傷なし/B=少し傷あり/C=傷や汚れあり/D=かなり傷あり/J=ジャンク/不明/その他）
- accessories: 付属品（箱、保証書、ストラップ等。カンマ区切り）
- notes: その他の補足情報
- source: "explicit"（顧客が明示した商品）または "suggested"（「他にも〜」「昔買った〜」など示唆があった商品）
- estimated_price_min: 中古相場での最低査定見込み金額（円・整数。不明な場合はnull）

【2. 顧客プロファイリング】
会話内容から以下を推定する。

customer_profile:
- age_group: "middle_senior"（概ね40代以上）/ "young"（概ね10〜30代）/ "unknown"
- income_level: "affluent"（高所得・資産家の雰囲気）/ "general"（一般所得）/ "unknown"
- sell_motivation: "estate"（遺品整理）/ "moving"（引越し）/ "declutter"（片付け・整理）/ "replacement"（買い換え）/ "unknown"
- motivation_strength: "strong"（遺品整理）/ "medium"（引越し・片付け）/ "weak"（買い換え）/ "unknown"

顧客単価の目安 = 年齢が高い × 収入/資産が高い × 売却動機が強い（3要素の掛け算で決まる）。

suggested_items（追加買取候補）:
customer_profile の age_group と income_level に基づいて、顧客が持っていそうな中古品で中古市場価格5,000円以上の商材を最大5つ列挙する。
- middle_senior + affluent → 貴金属・金製品、時計（高級品）、ブランドバッグ・財布、骨董品・美術品、宝石・ダイヤ
- middle_senior + general → 貴金属・金製品、ブランドバッグ、カメラ、楽器、着物・帯
- young + general → スマートフォン、PC・タブレット、ゲーム機、イヤホン・ヘッドホン、カメラ
- unknown → 貴金属・金製品、スマートフォン、ブランドバッグ、ゲーム機、カメラ
中古5,000円未満の商品（消耗品・日用品等）は suggested_items に含めない。

approach_hint:
sell_motivation に基づいて「どう声をかけるか」のスタッフ向けヒント（日本語で1〜2文）。
- estate（遺品整理）: 「丁寧に寄り添いながら、お家にある貴金属・ブランド品についても、お気持ちが落ち着いた時に確認していただくよう促す。」
- moving（引越し）: 「まとめてお売りいただけることを伝え、スマホ・PC・ブランド品なども一緒にご確認いただくよう提案する。」
- declutter（片付け）: 「複数回のご来訪も可能と伝え、今回見つからなくても次回確認できるよう関係を温める。」
- replacement（買い換え）: 「入口商品に加え、古くなったスマホや不要な家電・アクセサリー類もあれば一緒にご確認いただくよう提案する。」
- unknown: 「ご要望を丁寧に聞きながら、他にご不要なお品物がないか自然な流れで確認する。」

【出力形式】
必ず以下のJSON形式のみで返答してください（説明文不要）:
{"items": [{"item_name": "...", "brand": "...", "model_number": "...", "condition": "A", "accessories": "...", "notes": "...", "source": "explicit", "estimated_price_min": null}], "customer_profile": {"age_group": "unknown", "income_level": "unknown", "sell_motivation": "unknown", "motivation_strength": "unknown"}, "suggested_items": ["貴金属・金製品", "スマートフォン"], "approach_hint": "ご要望を丁寧に聞きながら、他にご不要なお品物がないか自然な流れで確認する。"}

複数の商品が含まれる場合はitemsを配列で。商品情報が見つからない場合は空配列。プロファイリングは必ず実施する。`;

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

  type CustomerProfile = {
    age_group: "middle_senior" | "young" | "unknown";
    income_level: "affluent" | "general" | "unknown";
    sell_motivation: "estate" | "moving" | "declutter" | "replacement" | "unknown";
    motivation_strength: "strong" | "medium" | "weak" | "unknown";
  };

  type ExtractedItem = {
    item_name: string;
    brand?: string | null;
    model_number?: string | null;
    condition?: string | null;
    accessories?: string | null;
    notes?: string | null;
    source?: "explicit" | "suggested";
    estimated_price_min?: number | null;
  };

  type AiResponse = {
    items?: ExtractedItem[];
    customer_profile?: CustomerProfile;
    suggested_items?: string[];
    approach_hint?: string;
  };

  let extractedItems: ExtractedItem[] = [];
  let customerProfile: CustomerProfile = {
    age_group: "unknown",
    income_level: "unknown",
    sell_motivation: "unknown",
    motivation_strength: "unknown",
  };
  let suggestedItems: string[] = [];
  let approachHint = "";

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: messageContent }],
    });

    const text = response.content.find((c) => c.type === "text")?.text ?? "{}";
    // JSONブロックを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as AiResponse;
      extractedItems = parsed.items ?? [];
      if (parsed.customer_profile) customerProfile = parsed.customer_profile;
      suggestedItems = parsed.suggested_items ?? [];
      approachHint = parsed.approach_hint ?? "";
    }
  } catch {
    return NextResponse.json({ error: "AI extraction failed" }, { status: 500 });
  }

  if (extractedItems.length === 0) {
    return NextResponse.json({
      items: [],
      saved: [],
      customer_profile: customerProfile,
      suggested_items: suggestedItems,
      approach_hint: approachHint,
    });
  }

  // DBに保存（explicitな商品のみDB保存。suggestedは提案として返すだけ）
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
        estimated_price_min: item.estimated_price_min ?? null,
      })
      .select()
      .single();
    if (!error && data) savedItems.push(data);
  }

  return NextResponse.json({
    items: extractedItems,
    saved: savedItems,
    customer_profile: customerProfile,
    suggested_items: suggestedItems,
    approach_hint: approachHint,
  });
}
