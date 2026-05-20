/**
 * PR22: AI 反響自動タグ付与
 *
 * POST /api/ai/auto-tag
 * Body: { inquiry_id: string }
 *
 * - 反響本文・既存タグ一覧から Claude Haiku がタグを推奨
 * - 既存の inquiry_tags テーブルに INSERT（重複は無視）
 * - 表記揺れを抑えるため、既存タグ集合に近いものを優先
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAiUsage } from "@/lib/ai/usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001" as const;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    inquiry_id?: string;
  } | null;
  if (!body?.inquiry_id) {
    return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 反響本文 + 既存タグ + 関連メッセージ
  const [{ data: inquiry }, { data: existingTagRows }, { data: msgs }] =
    await Promise.all([
      supabase
        .from("inquiries")
        .select("id, subject, channel, source_site, inquiry_tags(tag)")
        .eq("id", body.inquiry_id)
        .maybeSingle(),
      // システム全体の既存タグ集合（表記揺れ抑制のため）
      supabase
        .from("inquiry_tags")
        .select("tag")
        .limit(500),
      supabase
        .from("messages")
        .select("body, direction")
        .eq("inquiry_id", body.inquiry_id)
        .order("created_at", { ascending: true })
        .limit(20),
    ]);

  if (!inquiry) {
    return NextResponse.json({ error: "inquiry not found" }, { status: 404 });
  }

  const existingTagSet = Array.from(
    new Set((existingTagRows ?? []).map((r) => r.tag)),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentTags = ((inquiry as any).inquiry_tags ?? []).map(
    (t: { tag: string }) => t.tag,
  );

  const conversation = (msgs ?? [])
    .map(
      (m) => `${m.direction === "inbound" ? "顧客" : "スタッフ"}: ${m.body ?? ""}`,
    )
    .join("\n");

  const systemPrompt = `あなたは買取マクサスのインサイドセールスシステムのタグ付与AIです。
反響内容を読んで、業務管理に有用なタグを提案してください。

ルール:
1. タグは2〜6個まで
2. 既存タグ集合 (existing_tags) に同義のものがあればそれを優先（表記揺れ防止）
3. 顧客の状況・売却動機・品目・緊急度などを反映
4. MAKXAS思想（追加買取＝レバー2を最重視）に沿って、追加買取の可能性が高い場合は「追加買取候補」タグを付与
5. JSON のみで返す。説明文や余計な記号は禁止

返却フォーマット:
{
  "suggested_tags": ["タグ1", "タグ2", ...]
}`;

  const userPrompt = `件名: ${inquiry.subject ?? "なし"}
チャネル: ${inquiry.channel}
ソース: ${inquiry.source_site ?? "なし"}

会話履歴:
${conversation || "（メッセージなし）"}

現在付いているタグ: ${currentTags.length > 0 ? currentTags.join(", ") : "なし"}

既存タグ集合 (existing_tags、表記揺れ防止のため優先利用):
${existingTagSet.join(", ") || "なし"}

上記の反響に最も有用なタグを 2〜6 個提案してください。`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });

    await logAiUsage({
      category: "auto-tag",
      model: MODEL,
      usage: response.usage,
      endpoint: "/api/ai/auto-tag",
      inquiryId: body.inquiry_id,
      messageId: null,
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned invalid JSON", raw: text }, { status: 500 });
    }
    const parsed = JSON.parse(jsonMatch[0]) as { suggested_tags?: string[] };
    const newTags = (parsed.suggested_tags ?? [])
      .filter((t) => typeof t === "string" && t.trim().length > 0 && t.length <= 30)
      .map((t) => t.trim())
      .slice(0, 6);

    // 既存タグと差分を計算 → 新規分だけ INSERT
    const tagsToAdd = newTags.filter((t) => !currentTags.includes(t));
    if (tagsToAdd.length > 0) {
      const rows = tagsToAdd.map((tag) => ({ inquiry_id: body.inquiry_id!, tag }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("inquiry_tags").upsert(rows, { onConflict: "inquiry_id,tag" });
    }

    return NextResponse.json({
      suggested_tags: newTags,
      added_tags: tagsToAdd,
      existing_tags_used: newTags.filter((t) => existingTagSet.includes(t)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "auto-tag failed" },
      { status: 500 },
    );
  }
}
