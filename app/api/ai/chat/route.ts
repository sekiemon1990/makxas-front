import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";

import { logAiUsage } from "@/lib/ai/usage";
import { createServiceClient } from "@/lib/supabase/service";
import { buildHelpDocsContext } from "@/lib/help/manual";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

const tools: Anthropic.Tool[] = [
  {
    name: "get_summary",
    description:
      "反響・リード・アポイントメントの集計サマリーを取得する。現状把握やレポート作成時に使う。",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "search_data",
    description:
      "反響・リードをキーワードや条件で検索する。顧客名・件名・電話番号などで絞り込める。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "検索キーワード" },
        target: {
          type: "string",
          enum: ["inquiries", "leads"],
          description: "検索対象: inquiries（反響）または leads（リード）",
        },
        status: { type: "string", description: "ステータスで絞り込む（任意）" },
      },
      required: ["query", "target"],
    },
  },
];

async function runTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const supabase = createServiceClient();

  if (name === "get_summary") {
    const [
      { count: newCount },
      { count: inProgressCount },
      { count: apptCount },
      { count: leadCount },
    ] = await Promise.all([
      supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
      supabase.from("appointments").select("id", { count: "exact", head: true }),
      supabase.from("leads").select("id", { count: "exact", head: true }),
    ]);
    return JSON.stringify({
      新着反響: newCount ?? 0,
      対応中反響: inProgressCount ?? 0,
      累計アポ数: apptCount ?? 0,
      登録リード数: leadCount ?? 0,
    });
  }

  if (name === "search_data") {
    const query = String(input.query ?? "");
    const target = String(input.target ?? "inquiries");
    const status = input.status ? String(input.status) : null;

    if (target === "inquiries") {
      let q = supabase
        .from("inquiries")
        .select("id, subject, channel, status, created_at, leads(display_name, phone)")
        .or(`subject.ilike.%${query}%`)
        .limit(10);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (status) q = q.eq("status", status as any);
      const { data } = await q;
      return JSON.stringify(data ?? []);
    } else {
      const { data } = await supabase
        .from("leads")
        .select("id, display_name, phone, email, first_channel, created_at")
        .or(`display_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);
      return JSON.stringify(data ?? []);
    }
  }

  return JSON.stringify({ error: "unknown tool" });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    pageContext?: string;
    systemExtra?: string;
    context?: {
      subject?: string | null;
      channel?: string;
      status?: string;
      customerName?: string | null;
      storeName?: string | null;
      brandName?: string | null;
      recentMessages?: Array<{ direction: string; body: string }>;
      internalNote?: string | null;
      tags?: string[];
    };
  } | null;

  if (!body?.messages || body.messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // インボックスの反響コンテキスト（AiChatWidget から）
  const ctx = body.context;
  const contextLines: string[] = [];
  if (ctx) {
    if (ctx.customerName) contextLines.push(`顧客名: ${ctx.customerName}`);
    if (ctx.subject) contextLines.push(`件名: ${ctx.subject}`);
    if (ctx.channel) contextLines.push(`チャネル: ${ctx.channel}`);
    if (ctx.status) contextLines.push(`ステータス: ${ctx.status}`);
    if (ctx.storeName) contextLines.push(`店舗: ${ctx.storeName}`);
    if (ctx.brandName) contextLines.push(`ブランド: ${ctx.brandName}`);
    if (ctx.tags?.length) contextLines.push(`タグ: ${ctx.tags.join(", ")}`);
    if (ctx.internalNote) contextLines.push(`内部メモ: ${ctx.internalNote}`);
    if (ctx.recentMessages?.length) {
      const msgLines = ctx.recentMessages
        .map((m) => `${m.direction === "inbound" ? "顧客" : "担当者"}: ${m.body}`)
        .join("\n");
      contextLines.push(`\n直近のメッセージ:\n${msgLines}`);
    }
  }

  // 静的なシステムプロンプト (リクエスト間で同一 → Anthropic prompt caching 対象)
  // Sonnet 4.6 の最小キャッシュ要件 2048 tokens を満たす想定。
  const staticSystemPrompt = [
    "あなたは買取マクサスのインサイドセールスチームをサポートするAIアシスタントです。",
    "買取マクサス・銀座リパール・ブックリバー・カグウルなど複数の買取ブランドを運営する会社の、",
    "LINE・Webフォーム・メール・電話・比較サイトからの反響を管理し、アポイントメント（査定予約）取得を支援するシステムです。",
    "",
    "スタッフからの質問に対して、以下の能力を活用して的確なサポートをしてください：",
    "- get_summary ツールでシステム全体の現状を把握",
    "- search_data ツールで顧客・反響を検索",
    "- 返信案の作成、会話要約、次のアクション提案",
    "- 常に日本語で回答する",
    "",
    "【追加買取（レバー2）の2軸フレームワーク — 最重要】",
    "追加買取は最重要の営業行動です。返信案・声掛け文・提案を作る際は必ず以下の順序で考えてください。",
    "",
    "1. 顧客属性を読む（年齢・収入/資産・売却動機の3要素の掛け算）",
    "   - 売却動機の強さ: 遺品整理（強）> 引越し > 片付け > 買い換え（弱）",
    "   - 顧客単価目安 = 年齢が高い × 収入/資産が高い × 売却動機が強い",
    "",
    "2. ニーズ（なぜ売りたいか）で提案の切り口・言葉を決める",
    "   - 遺品整理 → 丁寧に寄り添う。急かさず、感情に配慮しながら「お家にある貴金属・ブランド品」を自然に聞く",
    "   - 引越し → まとめて手放したい心理。効率重視で「スマホ・PC・ブランド品も一緒にどうですか」",
    "   - 片付け → 時間をかけて整理中。次回以降の提案余地を作る関係構築を重視",
    "   - 買い換え → 入口商品に集中しつつ、古い機器や周辺アクセサリーも確認",
    "",
    "3. 属性×ニーズで絞った商材の中で高単価から狙う（中古¥5,000未満は対象外）",
    "   - 中高年・高所得・動機強 → 貴金属、ブランドバッグ、時計、骨董品を優先",
    "   - 若年層・一般所得 → スマートフォン、PC・タブレット、ゲーム機を優先",
    "   - 全年代共通 → カメラ、楽器、使っていない電子機器",
    "",
    "4. 返信文に追加買取のヒントを自然な形で含める（押し売りは禁止）",
    "   - 顧客が後悔しない取引を最優先にしながら、声掛けの機会を作る",
  ].join("\n") + buildHelpDocsContext();

  // 動的部分 (リクエスト毎に変動 → キャッシュ対象外)
  const dynamicSystemParts: string[] = [];
  if (body.pageContext) dynamicSystemParts.push(`【現在のページ】${body.pageContext}`);
  if (body.systemExtra) dynamicSystemParts.push(`【業務コンテキスト】\n${body.systemExtra}`);
  if (contextLines.length > 0)
    dynamicSystemParts.push(`\n【現在の反響情報】\n${contextLines.join("\n")}`);

  // system は配列形式: 静的部分に cache_control: ephemeral を付け、
  // 動的部分は別ブロックに分離 (これにより cache_read として再利用される)。
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: staticSystemPrompt,
      cache_control: { type: "ephemeral" },
    },
    ...(dynamicSystemParts.length > 0
      ? [{ type: "text" as const, text: dynamicSystemParts.join("\n") }]
      : []),
  ];

  try {
    const anthropic = new Anthropic({ apiKey });
    let messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let reply = "";
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemBlocks,
        tools,
        messages,
      });

      // キャッシュ効率の可視化 (Vercel logs から確認)
      // 初回呼び出しは cache_creation > 0、5分以内の再呼び出しで cache_read > 0 を期待
      const u = response.usage;
      console.info(
        `[ai/chat] usage iter=${i + 1}`,
        JSON.stringify({
          input: u.input_tokens,
          output: u.output_tokens,
          cache_creation: u.cache_creation_input_tokens ?? 0,
          cache_read: u.cache_read_input_tokens ?? 0,
        }),
      );

      // コスト追跡: tool_use ループの各 iteration を記録
      await logAiUsage({
        category: "chat",
        model: MODEL,
        usage: response.usage,
        endpoint: "/api/ai/chat",
        meta: { iteration: i + 1, stop_reason: response.stop_reason },
      });

      if (response.stop_reason === "end_turn") {
        reply = response.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("")
          .trim();
        break;
      }

      if (response.stop_reason === "tool_use") {
        const toolUses = response.content.filter(
          (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
        );

        messages = [
          ...messages,
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: await Promise.all(
              toolUses.map(async (tu) => ({
                type: "tool_result" as const,
                tool_use_id: tu.id,
                content: await runTool(tu.name, tu.input as Record<string, unknown>),
              })),
            ),
          },
        ];
        continue;
      }

      // その他の stop_reason（max_tokens など）
      reply = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("")
        .trim();
      break;
    }

    return NextResponse.json({ reply: reply || "応答を生成できませんでした。" });
  } catch (err) {
    console.error("AI chat error", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
