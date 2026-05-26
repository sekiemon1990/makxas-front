import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { logAiUsage } from "@/lib/ai/usage";
import { requireApiAuth } from "@/lib/auth/requireApiAuth";
import { notifyChatwork } from "@/lib/chatwork";
import { createServiceClient } from "@/lib/supabase/service";

const ANALYZE_MODEL = "claude-haiku-4-5-20251001";
const IMPROVE_MODEL = "claude-sonnet-4-6";

const CATEGORY_LABELS: Record<string, string> = {
  price_inquiry: "価格照会",
  appo_request: "アポ依頼",
  condition_detail: "状態確認",
  photo_submit: "写真送付",
  followup_question: "追加質問",
  initial_contact: "初回問い合わせ",
};

export const runtime = "nodejs";
export const maxDuration = 60;

type MessageRow = {
  id: string;
  inquiry_id: string | null;
  body: string | null;
  ai_original_body: string | null;
  ai_suggested: boolean;
  ai_edited: boolean | null;
  ai_theme: string | null;
  ai_edit_reason: string | null;
  ai_auto_sent: boolean;
  created_at: string;
  inquiries: { msg_category: string | null } | null;
};

type PromptVersionRow = {
  content: string;
  version: number;
};

export async function POST(req: NextRequest) {
  // 認証: admin 以上、または CRON_SECRET (cron/ai-learning から呼び出し)
  // Anthropic 課金が走るので role 制限を厳格化。
  const auth = await requireApiAuth(req, {
    requiredRole: "admin",
    allowCronSecret: true,
  });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({})) as { trigger?: string };
  const trigger = body.trigger ?? "manual";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;

  const dateRangeStart = new Date(Date.now() - 7 * 86400000).toISOString();
  const dateRangeEnd = new Date().toISOString();

  const { data: run } = await supabase
    .from("ai_learning_runs")
    .insert({ trigger, status: "running", date_range_start: dateRangeStart, date_range_end: dateRangeEnd })
    .select()
    .single();

  if (!run) return NextResponse.json({ error: "Failed to create run" }, { status: 500 });

  try {
    // ── ステップ0: 編集理由が未分析のメッセージをバッチ補完 ──────────────────
    if (process.env.ANTHROPIC_API_KEY) {
      const { data: unanalyzed } = await supabase
        .from("messages")
        .select("id, body, ai_original_body, inquiries!inner(msg_category)")
        .eq("ai_suggested", true)
        .eq("ai_edited", true)
        .eq("direction", "outbound")
        .is("ai_edit_reason", null)
        .not("ai_original_body", "is", null)
        .limit(20); // 1回のジョブで最大20件補完（APIコスト抑制）

      const anthropic = new Anthropic();
      for (const m of (unanalyzed ?? []) as { id: string; body: string | null; ai_original_body: string | null; inquiries: { msg_category: string | null } | null }[]) {
        if (!m.body || !m.ai_original_body) continue;
        try {
          const prompt = `あなたはAI返信品質分析の専門家です。買取店のカスタマーサポートAIが提案した返信と、スタッフが実際に送った返信を比較して「なぜスタッフが修正したか」を分析してください。

カテゴリ: ${m.inquiries?.msg_category ?? "不明"}

【AIが提案した文章】
${m.ai_original_body.slice(0, 500)}

【スタッフが実際に送った文章】
${m.body.slice(0, 500)}

差分を分析し、以下のJSONのみ返してください（説明文・コードブロック不要）:
{"label":"修正理由を表す短いラベル（5〜15文字の日本語、自由に命名可）","detail":"具体的に何を修正したか（50文字以内）","severity":"minor または major"}`;

          const res = await anthropic.messages.create({
            model: ANALYZE_MODEL,
            max_tokens: 256,
            messages: [{ role: "user", content: prompt }],
          });

          // コスト追跡 (analyze-edit 補完フェーズ)
          await logAiUsage({
            category: "analyze-edit",
            model: ANALYZE_MODEL,
            usage: res.usage,
            endpoint: "/api/ai/learning/run",
            messageId: m.id,
            meta: { phase: "backfill" },
          });

          const text = res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
          const match = text.match(/\{[\s\S]+?\}/);
          if (match) {
            const parsed = JSON.parse(match[0]) as { label?: string; detail?: string; severity?: string };
            await supabase.from("messages").update({
              ai_edit_reason: JSON.stringify({
                label: parsed.label ?? "不明",
                detail: parsed.detail ?? "",
                severity: parsed.severity === "major" ? "major" : "minor",
              }),
            }).eq("id", m.id);
          }
        } catch {
          // 1件失敗しても続行
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const { data: rawMessages } = await supabase
      .from("messages")
      .select("id, inquiry_id, body, ai_original_body, ai_suggested, ai_edited, ai_theme, ai_edit_reason, ai_auto_sent, created_at, inquiries!inner(msg_category)")
      .eq("ai_suggested", true)
      .eq("direction", "outbound")
      .gte("created_at", dateRangeStart)
      .not("body", "is", null);

    const messages = (rawMessages ?? []) as MessageRow[];
    let newExamplesAdded = 0;
    let promptsUpdated = 0;
    const categoriesImproved: string[] = [];
    const summaryData: Record<string, unknown> = {};

    // カテゴリ別集計 → auto_send_rules 更新
    const categoryStats: Record<string, { total: number; edited: number }> = {};
    for (const m of messages) {
      const cat = m.inquiries?.msg_category ?? "initial_contact";
      if (!categoryStats[cat]) categoryStats[cat] = { total: 0, edited: 0 };
      categoryStats[cat].total++;
      if (m.ai_edited) categoryStats[cat].edited++;
    }

    // 品質劣化チェック: 自動送信ONのルールでedit_rate > threshold * 1.5 なら自動停止
    const { data: autoSendRules } = await supabase
      .from("auto_send_rules")
      .select("msg_category, auto_send_enabled, edit_rate_threshold")
      .eq("auto_send_enabled", true);

    const degradedCategories: string[] = [];
    for (const rule of (autoSendRules ?? []) as { msg_category: string; edit_rate_threshold: number }[]) {
      const stats = categoryStats[rule.msg_category];
      if (!stats || stats.total < 10) continue;
      const newEditRate = stats.edited / stats.total;
      if (newEditRate > rule.edit_rate_threshold * 1.5) {
        // 自動送信を停止
        await supabase.from("auto_send_rules")
          .update({ auto_send_enabled: false, updated_at: new Date().toISOString() })
          .eq("msg_category", rule.msg_category);
        degradedCategories.push(rule.msg_category);
      }
    }

    // 品質劣化があればChatwork通知
    if (degradedCategories.length > 0) {
      const lines = degradedCategories.map(cat => {
        const stats = categoryStats[cat];
        const label = CATEGORY_LABELS[cat] ?? cat;
        const rate = stats ? Math.round((stats.edited / stats.total) * 100) : 0;
        return `・${label}（編集率 ${rate}%）`;
      }).join("\n");
      await notifyChatwork(
        `[info][title]🚨 AI自動送信 品質劣化検知 → 自動停止[/title]以下のカテゴリで編集率が閾値を超えたため、自動送信を停止しました。\n\n${lines}\n\n▶ 確認・再設定: https://makxas-front.vercel.app/admin/ai[/info]`
      );
    }

    for (const [cat, stats] of Object.entries(categoryStats)) {
      await supabase.from("auto_send_rules").upsert({
        msg_category: cat,
        current_edit_rate: stats.total > 0 ? Number((stats.edited / stats.total).toFixed(3)) : null,
        current_sample_count: stats.total,
        last_evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "msg_category", ignoreDuplicates: false });
    }

    // カテゴリ×テーマ別グループ化
    const groups: Record<string, MessageRow[]> = {};
    for (const m of messages) {
      const cat = m.inquiries?.msg_category ?? "initial_contact";
      const theme = m.ai_theme ?? "info";
      const key = `${cat}::${theme}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    for (const [groupKey, groupMsgs] of Object.entries(groups)) {
      const [category, theme] = groupKey.split("::");
      const edited = groupMsgs.filter(m => m.ai_edited && m.ai_original_body);
      const unedited = groupMsgs.filter(m => !m.ai_edited && m.body);

      // 無編集例を reply_examples に保存
      for (const m of unedited.slice(0, 5)) {
        if (!m.inquiry_id || !m.body) continue;
        const { data: inbound } = await supabase
          .from("messages")
          .select("body")
          .eq("inquiry_id", m.inquiry_id)
          .eq("direction", "inbound")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inbound?.body) {
          const { error } = await supabase.from("reply_examples").insert({
            msg_category: category,
            theme: theme ?? "info",
            customer_message: inbound.body,
            reply_body: m.body,
            was_ai_generated: true,
            edit_distance: 0,
            was_auto_sent: m.ai_auto_sent,
            quality_score: 0.9,
            message_id: m.id,
            inquiry_id: m.inquiry_id,
          });
          if (!error) newExamplesAdded++;
        }
      }

      // 修正例が5件以上あればプロンプト改善
      if (edited.length >= 5 && process.env.ANTHROPIC_API_KEY) {
        const client = new Anthropic();

        // ai_edit_reason ラベルを集計（上位パターンを抽出）
        const labelCounts: Record<string, number> = {};
        for (const m of edited) {
          if (!m.ai_edit_reason) continue;
          try {
            const parsed = JSON.parse(m.ai_edit_reason) as { label?: string };
            const label = parsed.label ?? "不明";
            labelCounts[label] = (labelCounts[label] ?? 0) + 1;
          } catch { /* JSON以外（旧形式のテキスト）はスキップ */ }
        }
        const topLabels = Object.entries(labelCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([label, count]) => `「${label}」${count}件`);

        const editPatterns = edited.slice(0, 10).map(m => {
          let reasonText = "不明";
          if (m.ai_edit_reason) {
            try {
              const parsed = JSON.parse(m.ai_edit_reason) as { label?: string; detail?: string };
              reasonText = parsed.label ? `${parsed.label}${parsed.detail ? `（${parsed.detail}）` : ""}` : m.ai_edit_reason;
            } catch { reasonText = m.ai_edit_reason; }
          }
          return {
            original: (m.ai_original_body ?? "").slice(0, 300),
            final: (m.body ?? "").slice(0, 300),
            reason: reasonText,
          };
        });

        const { data: currentPromptData } = await supabase
          .from("prompt_versions")
          .select("content, version")
          .eq("msg_category", category)
          .eq("is_active", true)
          .maybeSingle();

        const currentPrompt = currentPromptData as PromptVersionRow | null;

        const analysisPrompt = `あなたはAIシステムのプロンプトエンジニアです。
買取店のLINE返信AIの品質を改善してください。

カテゴリ: ${category} / テーマ: ${theme}
サンプル数: ${groupMsgs.length}件（修正あり: ${edited.length}件、修正率: ${Math.round(edited.length / groupMsgs.length * 100)}%）
${topLabels.length > 0 ? `\n頻出修正ラベル TOP${topLabels.length}:\n${topLabels.join("\n")}\n` : ""}
修正パターン（最大10件）:
${editPatterns.map((p, i) => `[${i + 1}] 理由: ${p.reason}\nAI案: ${p.original}\n実際: ${p.final}`).join("\n---\n")}

現在のシステムプロンプト:
${currentPrompt?.content ?? "（初期プロンプト使用中）"}

上記を分析し、以下のJSONのみ返してください（説明文不要）:
{"analysis":"修正が多い理由の要約（2〜3文）","improved_prompt":"改善されたシステムプロンプト全文（日本語）"}`;

        const response = await client.messages.create({
          model: IMPROVE_MODEL,
          max_tokens: 1024,
          messages: [{ role: "user", content: analysisPrompt }],
        });

        // コスト追跡 (learning 改善フェーズ)
        await logAiUsage({
          category: "learning",
          model: IMPROVE_MODEL,
          usage: response.usage,
          endpoint: "/api/ai/learning/run",
          meta: { phase: "improve-prompt", category, theme },
        });

        const text = response.content[0]?.type === "text" ? response.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]+\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { analysis?: string; improved_prompt?: string };
          if (parsed.improved_prompt) {
            const nextVersion = (currentPrompt?.version ?? 0) + 1;
            await supabase.from("prompt_versions").insert({
              msg_category: category,
              theme: theme ?? null,
              prompt_type: "force_theme_system",
              content: parsed.improved_prompt,
              version: nextVersion,
              is_active: false,
              created_by: "auto_learning",
              note: parsed.analysis ?? "",
            });
            promptsUpdated++;
            if (!categoriesImproved.includes(category)) categoriesImproved.push(category);
            summaryData[groupKey] = {
              analysis: parsed.analysis,
              editRate: edited.length > 0 ? (edited.length / groupMsgs.length).toFixed(2) : "0",
            };
          }
        }
      }
    }

    const runRow = run as { id: string };

    await supabase.from("ai_learning_runs").update({
      status: "completed",
      messages_analyzed: messages.length,
      categories_improved: categoriesImproved,
      new_examples_added: newExamplesAdded,
      prompts_updated: promptsUpdated,
      summary: summaryData,
      completed_at: new Date().toISOString(),
    }).eq("id", runRow.id);

    // 新しいプロンプト候補があればChatwork通知
    if (promptsUpdated > 0) {
      const improvementLines = categoriesImproved.map(cat => {
        const label = CATEGORY_LABELS[cat] ?? cat;
        const stats = categoryStats[cat];
        const rate = stats ? Math.round((stats.edited / stats.total) * 100) : 0;
        return `・${label}（編集率 ${rate}%）`;
      }).join("\n");
      await notifyChatwork(
        `[info][title]🤖 AI学習完了 — プロンプト候補 ${promptsUpdated}件[/title]以下のカテゴリで改善プロンプト候補が生成されました。\n管理画面で内容を確認し、問題なければ「有効化」してください。\n\n${improvementLines}\n\n解析対象: ${messages.length}件（過去7日間）\n新規返信例: ${newExamplesAdded}件\n\n▶ プロンプト管理: https://makxas-front.vercel.app/admin/ai[/info]`
      );
    }

    return NextResponse.json({
      success: true, run_id: runRow.id,
      messages_analyzed: messages.length,
      new_examples_added: newExamplesAdded,
      prompts_updated: promptsUpdated,
      degraded_categories: degradedCategories,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const runRow = run as { id: string };
    await supabase.from("ai_learning_runs").update({
      status: "failed", error_message: msg, completed_at: new Date().toISOString(),
    }).eq("id", runRow.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
