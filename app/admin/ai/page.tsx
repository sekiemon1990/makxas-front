"use client";

import { useEffect, useState, useCallback } from "react";
import { Brain, Settings, BookOpen, History, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { PromptVersion, AutoSendRule, AiLearningRun } from "@/types/database";

// カテゴリ日本語マッピング
const CAT_LABELS: Record<string, string> = {
  price_inquiry: "価格照会",
  appo_request: "アポ依頼",
  condition_detail: "状態確認",
  photo_submit: "写真送付",
  followup_question: "フォローアップ",
  initial_contact: "初回問い合わせ",
  unknown: "不明",
};

type CategoryStat = {
  msg_category: string;
  total_ai_sent: number;
  edit_rate: number | null;
  theme_change_rate: number | null;
  auto_sent_count: number;
  edit_reasons: Record<string, number>;
  auto_send_rule: AutoSendRule | null;
  is_auto_eligible: boolean;
};

type AnalyticsData = {
  categories: CategoryStat[];
  recent_runs: AiLearningRun[];
  total_ai_sent_30d: number;
  overall_edit_rate: number | null;
};

/** /api/ai/usage が返す集計レスポンス */
type UsageBucket = {
  total_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
};
type UsageData = {
  period_days: number;
  since: string;
  overall: UsageBucket;
  by_category: Record<string, UsageBucket>;
  by_model: Record<string, UsageBucket>;
  by_day: Record<string, UsageBucket>;
};

/** モデル別単価 (USD per 1M tokens) - UI 表示用 */
const MODEL_COST: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
};

const USAGE_CATEGORY_LABELS: Record<string, string> = {
  suggest: "返信サジェスト",
  chat: "AIチャット",
  "extract-items": "商品抽出",
  "analyze-edit": "修正理由分析",
  learning: "プロンプト学習",
};

type Tab = "analytics" | "auto_send" | "prompts" | "history" | "examples" | "ops_guide";

type ReplyExample = {
  id: string;
  msg_category: string;
  theme: string;
  customer_message: string;
  reply_body: string;
  was_ai_generated: boolean;
  quality_score: number | null;
  created_at: string;
};

export default function AiAdminPage() {
  const [tab, setTab] = useState<Tab>("analytics");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [rules, setRules] = useState<AutoSendRule[]>([]);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [examples, setExamples] = useState<ReplyExample[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [runningLearning, setRunningLearning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      // analytics と usage を並列取得 (usage 失敗時もダッシュボードは動作継続)
      const [analyticsResult, usageResult] = await Promise.allSettled([
        fetch("/api/ai/analytics").then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return (await r.json()) as AnalyticsData;
        }),
        fetch("/api/ai/usage?days=30").then(async (r) => {
          if (!r.ok) throw new Error(`usage ${r.status}`);
          return (await r.json()) as UsageData;
        }),
      ]);
      if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value);
      if (usageResult.status === "fulfilled") {
        setUsage(usageResult.value);
      } else {
        console.info("[admin/ai] usage unavailable:", usageResult.reason);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/ai/auto-send-rules");
    const data = await res.json() as AutoSendRule[];
    setRules(Array.isArray(data) ? data : []);
  }, []);

  const loadPrompts = useCallback(async () => {
    const res = await fetch("/api/ai/prompts");
    const data = await res.json() as PromptVersion[];
    setPrompts(Array.isArray(data) ? data : []);
  }, []);

  const loadExamples = useCallback(async () => {
    // reply_examples は supabase から直接取得する想定だが、
    // 現時点では空配列で初期化（analytics エンドポイント経由では取得不可）
    setExamples([]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAnalytics();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRules();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPrompts();
  }, [loadAnalytics, loadRules, loadPrompts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "examples") void loadExamples();
  }, [tab, loadExamples]);

  const handleToggleRule = async (rule: AutoSendRule) => {
    const res = await fetch("/api/ai/auto-send-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_category: rule.msg_category, auto_send_enabled: !rule.auto_send_enabled }),
    });
    if (res.ok) {
      const updated = await res.json() as AutoSendRule;
      setRules(prev => prev.map(r => r.msg_category === rule.msg_category ? updated : r));
      showToast(`${CAT_LABELS[rule.msg_category] ?? rule.msg_category} の自動送信を${!rule.auto_send_enabled ? "有効" : "無効"}にしました`);
    }
  };

  const handleUpdateRule = async (rule: AutoSendRule, patch: Partial<AutoSendRule>) => {
    const res = await fetch("/api/ai/auto-send-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_category: rule.msg_category, ...patch }),
    });
    if (res.ok) {
      const updated = await res.json() as AutoSendRule;
      setRules(prev => prev.map(r => r.msg_category === rule.msg_category ? updated : r));
      showToast("設定を保存しました");
    }
  };

  const handleActivatePrompt = async (id: string) => {
    const res = await fetch(`/api/ai/prompts/${id}/activate`, { method: "PATCH" });
    if (res.ok) {
      await loadPrompts();
      showToast("プロンプトを有効化しました");
    }
  };

  const handleRunLearning = async () => {
    setRunningLearning(true);
    try {
      const res = await fetch("/api/ai/learning/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual" }),
      });
      const data = await res.json() as { success?: boolean; messages_analyzed?: number; new_examples_added?: number; prompts_updated?: number; error?: string };
      if (data.success) {
        showToast(`学習完了: ${data.messages_analyzed ?? 0}件分析、${data.prompts_updated ?? 0}プロンプト更新`);
        await loadAnalytics();
        await loadPrompts();
      } else {
        showToast(`エラー: ${data.error ?? "不明なエラー"}`);
      }
    } catch {
      showToast("学習実行に失敗しました");
    } finally {
      setRunningLearning(false);
    }
  };

  const toggleExpandPrompt = (id: string) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // プロンプトをカテゴリ×テーマ別にグループ化
  const promptGroups: Record<string, PromptVersion[]> = {};
  for (const p of prompts) {
    const key = `${p.msg_category}::${p.theme ?? "（テーマなし）"}`;
    if (!promptGroups[key]) promptGroups[key] = [];
    promptGroups[key].push(p);
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          {/* ヘッダー */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">AI管理</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">AI学習・自動化</h1>
          </div>

          {/* タブ */}
          <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
            {[
              { id: "analytics" as Tab, label: "アナリティクス", icon: Brain },
              { id: "auto_send" as Tab, label: "自動送信設定", icon: Settings },
              { id: "prompts" as Tab, label: "プロンプト管理", icon: BookOpen },
              { id: "history" as Tab, label: "学習履歴", icon: History },
              { id: "examples" as Tab, label: "返信例", icon: Sparkles },
              { id: "ops_guide" as Tab, label: "運用ガイド", icon: BookOpen },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  tab === id
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* ─── アナリティクスタブ ─── */}
          {tab === "analytics" && (
            <div className="space-y-4">
              {loadingAnalytics ? (
                <p className="text-sm text-zinc-500">読み込み中...</p>
              ) : analytics ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
                      <CardContent className="p-5">
                        <p className="text-xs text-zinc-500">総AI送信（30日）</p>
                        <p className="mt-1 text-3xl font-semibold">{analytics.total_ai_sent_30d}件</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
                      <CardContent className="p-5">
                        <p className="text-xs text-zinc-500">全体修正率（30日）</p>
                        <p className="mt-1 text-3xl font-semibold">
                          {analytics.overall_edit_rate !== null
                            ? `${(analytics.overall_edit_rate * 100).toFixed(1)}%`
                            : "—"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* AI API コスト & キャッシュ効率セクション (Issue: recording から横展開) */}
                  {usage && <UsageCostSection usage={usage} />}

                  <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-sm">カテゴリ別集計（30日）</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-100">
                            <th className="py-3 pl-6 text-left text-xs font-semibold text-zinc-500">カテゴリ</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">送信数</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">修正率</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500">自動化可否</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.categories.map(cat => (
                            <tr key={cat.msg_category} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                              <td className="py-3 pl-6 font-medium">
                                {CAT_LABELS[cat.msg_category] ?? cat.msg_category}
                              </td>
                              <td className="px-4 py-3 text-right text-zinc-600">{cat.total_ai_sent}</td>
                              <td className="px-4 py-3 text-right">
                                {cat.edit_rate !== null ? (
                                  <span className={cat.edit_rate > 0.2 ? "text-red-600 font-medium" : "text-zinc-600"}>
                                    {(cat.edit_rate * 100).toFixed(1)}%
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-6 py-3 text-right">
                                {cat.is_auto_eligible ? (
                                  <Badge className="bg-green-100 text-green-700 border-green-200">✅ 可能（条件達成）</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-zinc-400">
                                    ⚠️ 未達（閾値{cat.auto_send_rule ? `${(cat.auto_send_rule.edit_rate_threshold * 100).toFixed(0)}%` : "—"}）
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                          {analytics.categories.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-sm text-zinc-400">データがありません</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </div>
          )}

          {/* ─── 自動送信設定タブ ─── */}
          {tab === "auto_send" && (
            <div className="space-y-4">
              {rules.map(rule => {
                const catStat = analytics?.categories.find(c => c.msg_category === rule.msg_category);
                return (
                  <Card key={rule.msg_category} className="rounded-xl border-zinc-200 bg-white shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {CAT_LABELS[rule.msg_category] ?? rule.msg_category}
                        </CardTitle>
                        <div className="flex items-center gap-3">
                          {catStat?.is_auto_eligible && !rule.auto_send_enabled && (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                              自動化可能になりました
                            </Badge>
                          )}
                          <Switch
                            checked={rule.auto_send_enabled}
                            onCheckedChange={() => void handleToggleRule(rule)}
                          />
                        </div>
                      </div>
                      <CardDescription>
                        現在の修正率: {rule.current_edit_rate !== null ? `${(rule.current_edit_rate * 100).toFixed(1)}%` : "データなし"}
                        {" "}/ サンプル数: {rule.current_sample_count ?? 0}件
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-500">修正率閾値</label>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            defaultValue={rule.edit_rate_threshold}
                            className="h-8 w-full rounded-md border border-zinc-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-300"
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v !== rule.edit_rate_threshold) {
                                void handleUpdateRule(rule, { edit_rate_threshold: v });
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-500">最小サンプル数</label>
                          <input
                            type="number"
                            min={1}
                            defaultValue={rule.min_sample_size}
                            className="h-8 w-full rounded-md border border-zinc-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-300"
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v) && v !== rule.min_sample_size) {
                                void handleUpdateRule(rule, { min_sample_size: v });
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-500">送信前確認時間(分)</label>
                          <input
                            type="number"
                            min={0}
                            defaultValue={rule.review_delay_minutes}
                            className="h-8 w-full rounded-md border border-zinc-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-300"
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v) && v !== rule.review_delay_minutes) {
                                void handleUpdateRule(rule, { review_delay_minutes: v });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {rules.length === 0 && (
                <p className="text-sm text-zinc-400">ルールがありません</p>
              )}
            </div>
          )}

          {/* ─── プロンプト管理タブ ─── */}
          {tab === "prompts" && (
            <div className="space-y-4">
              {Object.entries(promptGroups).map(([groupKey, groupPrompts]) => {
                const [category, theme] = groupKey.split("::");
                return (
                  <Card key={groupKey} className="rounded-xl border-zinc-200 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {CAT_LABELS[category] ?? category}
                        {theme && theme !== "（テーマなし）" && (
                          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{theme}</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {groupPrompts.map(p => (
                        <div key={p.id} className="border-b border-zinc-100 last:border-0">
                          <div className="flex items-center gap-3 px-5 py-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-zinc-700">v{p.version}</span>
                                {p.is_active ? (
                                  <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">アクティブ</Badge>
                                ) : p.created_by === "auto_learning" ? (
                                  <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">候補（自動生成）</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-zinc-400 text-[10px]">非アクティブ</Badge>
                                )}
                                <span className="text-[10px] text-zinc-400">
                                  {new Date(p.created_at).toLocaleDateString("ja-JP")}
                                </span>
                              </div>
                              {p.note && (
                                <p className="mt-0.5 text-xs text-zinc-500 truncate">{p.note}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {!p.is_active && (
                                <Button
                                  size="sm"
                                  className="h-7 px-3 text-xs"
                                  onClick={() => void handleActivatePrompt(p.id)}
                                >
                                  有効化
                                </Button>
                              )}
                              <button
                                onClick={() => toggleExpandPrompt(p.id)}
                                className="text-zinc-400 hover:text-zinc-700"
                                type="button"
                              >
                                {expandedPrompts.has(p.id) ? (
                                  <ChevronUp className="size-4" />
                                ) : (
                                  <ChevronDown className="size-4" />
                                )}
                              </button>
                            </div>
                          </div>
                          {expandedPrompts.has(p.id) && (
                            <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-3">
                              <pre className="whitespace-pre-wrap text-xs text-zinc-700 font-mono">{p.content}</pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
              {Object.keys(promptGroups).length === 0 && (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-400">
                  プロンプトがまだありません。学習を実行するとAIが自動生成します。
                </div>
              )}
            </div>
          )}

          {/* ─── 学習履歴タブ ─── */}
          {tab === "history" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => void handleRunLearning()}
                  disabled={runningLearning}
                  className="gap-2"
                >
                  <Sparkles className="size-4" />
                  {runningLearning ? "学習中..." : "手動学習実行"}
                </Button>
              </div>

              <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="size-4" />
                    学習実行ログ
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="py-3 pl-6 text-left text-xs font-semibold text-zinc-500">実行日時</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">トリガー</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">ステータス</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">分析数</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500">改善カテゴリ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.recent_runs ?? []).map(run => (
                        <tr key={run.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                          <td className="py-3 pl-6 text-zinc-700">
                            {new Date(run.started_at).toLocaleString("ja-JP")}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {run.trigger === "scheduled" ? "自動" : run.trigger === "manual" ? "手動" : run.trigger}
                          </td>
                          <td className="px-4 py-3">
                            {run.status === "running" ? (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200">実行中</Badge>
                            ) : run.status === "completed" ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200">完了</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 border-red-200">失敗</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-600">{run.messages_analyzed ?? "—"}</td>
                          <td className="px-6 py-3 text-right text-zinc-600">
                            {run.categories_improved?.length ?? 0}カテゴリ
                          </td>
                        </tr>
                      ))}
                      {(analytics?.recent_runs ?? []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm text-zinc-400">
                            学習履歴がありません
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── 運用ガイドタブ ─── */}
          {tab === "ops_guide" && (
            <div className="space-y-4">
              <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="size-4" />
                    AI学習 運用体制ガイド
                  </CardTitle>
                  <CardDescription>
                    AI精度を継続的に向上させるための役割・フロー・判断基準です。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-sm">

                  {/* 役割分担 */}
                  <div>
                    <h3 className="font-semibold text-zinc-800 mb-3">👥 役割分担</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {[
                        {
                          role: "インサイドセールスリーダー",
                          responsibilities: [
                            "週次でアナリティクスタブを確認（編集率・自動送信数）",
                            "自動送信の閾値設定・ON/OFFの最終判断",
                            "AIの品質劣化時のChatwork通知を受け取り対処",
                          ],
                          badge: "必須",
                          color: "bg-red-50 border-red-200",
                        },
                        {
                          role: "スタッフ全員",
                          responsibilities: [
                            "AI返信を修正した際に「編集理由」を選択する",
                            "AI案が明らかにおかしい場合は編集理由「テーマ違い」「事実誤り」を使用",
                            "月1回、自分がよく使う返信例を返信例タブで確認",
                          ],
                          badge: "日常業務",
                          color: "bg-blue-50 border-blue-200",
                        },
                        {
                          role: "管理者（adminロール）",
                          responsibilities: [
                            "Chatwork通知「プロンプト候補◯件」を受け取ったらプロンプト管理タブで確認",
                            "AI生成のプロンプト候補を読み、内容に問題なければ「有効化」",
                            "月1回、学習履歴タブで改善サイクルが機能しているか確認",
                          ],
                          badge: "週次",
                          color: "bg-green-50 border-green-200",
                        },
                      ].map(item => (
                        <div key={item.role} className={`rounded-lg border p-4 ${item.color}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-zinc-800">{item.role}</span>
                            <Badge variant="outline" className="text-xs">{item.badge}</Badge>
                          </div>
                          <ul className="space-y-1">
                            {item.responsibilities.map((r, i) => (
                              <li key={i} className="text-zinc-600 text-xs flex gap-1.5">
                                <span className="mt-0.5 shrink-0">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 日次・週次サイクル */}
                  <div>
                    <h3 className="font-semibold text-zinc-800 mb-3">🔄 自動化サイクル</h3>
                    <div className="rounded-lg border border-zinc-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-50">
                          <tr>
                            <th className="text-left p-2 font-medium text-zinc-500 w-28">タイミング</th>
                            <th className="text-left p-2 font-medium text-zinc-500">自動実行されること</th>
                            <th className="text-left p-2 font-medium text-zinc-500">人間がすること</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {[
                            { timing: "毎日 03:00", auto: "AI学習クロン実行（過去7日間のデータ分析）", human: "何もしない（通知待ち）" },
                            { timing: "プロンプト候補生成時", auto: "Chatworkに「候補◯件」通知", human: "プロンプト管理タブで内容確認→有効化" },
                            { timing: "品質劣化検知時", auto: "自動送信を停止＋Chatworkに警告通知", human: "原因調査→閾値見直し→再度ON" },
                            { timing: "週1回", auto: "—", human: "アナリティクスタブで編集率推移を確認" },
                            { timing: "月1回", auto: "—", human: "自動送信を新規カテゴリに拡大するか判断" },
                          ].map((row, i) => (
                            <tr key={i} className="hover:bg-zinc-50">
                              <td className="p-2 text-zinc-500 font-medium whitespace-nowrap">{row.timing}</td>
                              <td className="p-2 text-zinc-700">{row.auto}</td>
                              <td className="p-2 text-zinc-700">{row.human}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 自動送信の開始判断基準 */}
                  <div>
                    <h3 className="font-semibold text-zinc-800 mb-3">✅ 自動送信を開始する判断基準</h3>
                    <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-2">
                      {[
                        { label: "最低サンプル数", value: "30件以上のAI提案実績", icon: "📊" },
                        { label: "編集率の目安", value: "20%以下（スタッフが8割以上そのまま送信）", icon: "✏️" },
                        { label: "連続確認期間", value: "2週間以上安定して閾値を下回ること", icon: "📅" },
                        { label: "開始の順序", value: "まず「価格照会」から試験導入 → 問題なければ「アポ依頼」→ 他カテゴリへ拡大", icon: "🚀" },
                      ].map(item => (
                        <div key={item.label} className="flex items-start gap-2">
                          <span>{item.icon}</span>
                          <div>
                            <span className="font-medium text-zinc-700">{item.label}：</span>
                            <span className="text-zinc-600"> {item.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 品質劣化時の対応手順 */}
                  <div>
                    <h3 className="font-semibold text-zinc-800 mb-3">🚨 品質劣化時の対応手順</h3>
                    <ol className="space-y-2">
                      {[
                        "Chatworkの「品質劣化検知」通知を確認（自動送信は既に停止済み）",
                        "学習履歴タブで直近の学習結果を確認し、どのカテゴリで何件編集されたか把握",
                        "返信例タブで実際の編集内容を確認し、スタッフに「最近のAI返信で気になる点は？」とヒアリング",
                        "プロンプト管理タブで最新のプロンプト候補をレビュー（改善が反映されているか）",
                        "問題なければ有効化 → 自動送信設定タブでONに戻す",
                        "1週間様子を見て編集率が安定したら通常運用に復帰",
                      ].map((step, i) => (
                        <li key={i} className="flex gap-2 text-zinc-600">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-700">{i + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── 返信例タブ ─── */}
          {tab === "examples" && (
            <div className="space-y-4">
              <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4" />
                    蓄積された返信例
                  </CardTitle>
                  <CardDescription>
                    AIが編集なしで送信された返信例を自動収集します。学習を実行すると件数が増えます。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {examples.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-400">
                      返信例がまだありません。学習を実行すると自動で蓄積されます。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {examples.map(ex => (
                        <div key={ex.id} className="rounded-lg border border-zinc-200 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">{CAT_LABELS[ex.msg_category] ?? ex.msg_category}</Badge>
                            <Badge variant="outline" className="text-xs">{ex.theme}</Badge>
                            {ex.quality_score !== null && (
                              <span className="text-xs text-zinc-500">品質スコア: {ex.quality_score}</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mb-1">顧客メッセージ:</p>
                          <p className="text-sm text-zinc-700 mb-2">{ex.customer_message}</p>
                          <p className="text-xs text-zinc-500 mb-1">返信例:</p>
                          <p className="text-sm text-zinc-700">{ex.reply_body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </AppShell>
  );
}

/**
 * AI API コスト & キャッシュ効率セクション
 *
 * recording (makxas-ast) の UsageCostSection を front 用にスタイル調整して移植。
 * 表示する指標:
 *   - 期間内総コスト (USD) / API 呼出回数
 *   - 入出力トークン
 *   - キャッシュヒット率 = cache_read / (input + cache_read + cache_creation)
 *   - キャッシュ削減コスト目安 (モデル別単価で逆算)
 *   - カテゴリ別の内訳テーブル
 */
function UsageCostSection({ usage }: { usage: UsageData }) {
  const o = usage.overall;
  const totalInputUnits =
    o.input_tokens + o.cache_read_tokens + o.cache_creation_tokens;
  const cacheHitRate =
    totalInputUnits > 0
      ? Math.round((o.cache_read_tokens / totalInputUnits) * 1000) / 10
      : 0;

  // 削減コスト概算: モデル別単価で「もし cache 一切無しだった場合の理論コスト」を計算
  const FALLBACK = MODEL_COST["claude-sonnet-4-6"];
  let nominalUsd = 0;
  for (const [model, bucket] of Object.entries(usage.by_model)) {
    const rate = MODEL_COST[model] ?? FALLBACK;
    const inputUnits =
      bucket.input_tokens +
      bucket.cache_read_tokens +
      bucket.cache_creation_tokens;
    nominalUsd +=
      (inputUnits * rate.input + bucket.output_tokens * rate.output) /
      1_000_000;
  }
  const savedUsd = Math.max(0, nominalUsd - o.cost_usd);

  return (
    <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm">
          AI API コスト & キャッシュ効率（過去{usage.period_days}日）
        </CardTitle>
        <CardDescription className="text-xs">
          Anthropic API 呼出のトークン消費・コスト・キャッシュヒット率を集計
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">総コスト</p>
            <p className="text-xl font-semibold tabular-nums">${o.cost_usd.toFixed(4)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">API呼出 {o.total_calls}回</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">入力トークン</p>
            <p className="text-xl font-semibold tabular-nums">{o.input_tokens.toLocaleString()}</p>
            <p className="text-[10px] text-zinc-500 mt-1">出力 {o.output_tokens.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">キャッシュヒット率</p>
            <p className="text-xl font-semibold tabular-nums">{cacheHitRate}%</p>
            <p className="text-[10px] text-zinc-500 mt-1">
              read {o.cache_read_tokens.toLocaleString()} / create {o.cache_creation_tokens.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">キャッシュ削減コスト(目安)</p>
            <p className="text-xl font-semibold tabular-nums">${savedUsd.toFixed(4)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">モデル別単価で換算</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="py-2 pl-2 pr-3 text-left font-semibold text-zinc-500">カテゴリ</th>
                <th className="py-2 pr-3 text-right font-semibold text-zinc-500">呼出</th>
                <th className="py-2 pr-3 text-right font-semibold text-zinc-500">入力</th>
                <th className="py-2 pr-3 text-right font-semibold text-zinc-500">出力</th>
                <th className="py-2 pr-3 text-right font-semibold text-zinc-500">cache read</th>
                <th className="py-2 pr-3 text-right font-semibold text-zinc-500">cache create</th>
                <th className="py-2 pr-2 text-right font-semibold text-zinc-500">コスト</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(usage.by_category)
                .sort(([, a], [, b]) => b.cost_usd - a.cost_usd)
                .map(([cat, b]) => (
                  <tr key={cat} className="border-b border-zinc-50 last:border-0">
                    <td className="py-2 pl-2 pr-3">{USAGE_CATEGORY_LABELS[cat] ?? cat}</td>
                    <td className="py-2 pr-3 tabular-nums text-right">{b.total_calls}</td>
                    <td className="py-2 pr-3 tabular-nums text-right">{b.input_tokens.toLocaleString()}</td>
                    <td className="py-2 pr-3 tabular-nums text-right">{b.output_tokens.toLocaleString()}</td>
                    <td className="py-2 pr-3 tabular-nums text-right">{b.cache_read_tokens.toLocaleString()}</td>
                    <td className="py-2 pr-3 tabular-nums text-right">{b.cache_creation_tokens.toLocaleString()}</td>
                    <td className="py-2 pr-2 tabular-nums text-right">${b.cost_usd.toFixed(4)}</td>
                  </tr>
                ))}
              {Object.keys(usage.by_category).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-zinc-400">利用がありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
