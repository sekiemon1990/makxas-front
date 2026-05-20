import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CalendarCheck,
  CircleDot,
  Inbox,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ChannelBadge, StatusBadge } from "@/components/badges";
import { ApptTrendChart } from "@/components/dashboard/ApptTrendChart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { channelFilters, channelMeta } from "@/lib/inquiry-options";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";
import type { InquiryChannel, InquiryWithLead, Shift } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServiceClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const fourteenDaysAgo = new Date(todayStart);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    { count: newCount },
    { count: inProgressCount },
    { count: todayAppointments },
    { count: totalInquiries },
    { count: appointmentSetCount },
    { data: recentRows },
    { data: channelRows },
    { data: weeklyRows },
    { data: lostTagRows },
    { count: prevNewCount },
    { count: prevInProgressCount },
    // 今月の新規アポ（担当者・品目カテゴリ付き）
    { data: monthlyApptRows },
    // 今月の反響（チャネル別アポ率計算用）
    { data: monthlyInquiryRows },
    // 先月のアポ数
    { count: prevMonthApptCount },
    // リード×アポ（平均仕入点数用）
    { data: leadApptRows },
    // 過去6ヶ月アポ（トレンドチャート）
    { data: trendApptRows },
  ] = await Promise.all([
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", todayStart.toISOString())
      .lt("scheduled_at", tomorrowStart.toISOString()),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).not("status", "in", '("lost","closed")'),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "appointment_set"),
    supabase
      .from("inquiries")
      .select("*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag)")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("inquiries").select("channel", { count: "exact" }).not("status", "in", '("lost","closed")'),
    supabase
      .from("inquiries")
      .select("created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabase.from("inquiry_tags").select("tag, inquiries!inner(status)").eq("inquiries.status", "lost"),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .lt("created_at", sevenDaysAgo.toISOString())
      .gte("created_at", fourteenDaysAgo.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_progress")
      .lt("created_at", sevenDaysAgo.toISOString())
      .gte("created_at", fourteenDaysAgo.toISOString()),
    // 今月確定アポ（追加買取KPI集計用に additional_items_confirmed も取得）
    supabase
      .from("appointments")
      .select("id, item_category, staff:staff_id(name), lead_id, additional_items_confirmed")
      .gte("scheduled_at", monthStart.toISOString())
      .lt("scheduled_at", monthEnd.toISOString())
      .neq("status", "cancelled"),
    // 今月の反響（チャネル別 + 顧客プロファイル集計用）
    supabase
      .from("inquiries")
      .select("id, channel, status, customer_profile, suggested_items, approach_hint")
      .gte("created_at", monthStart.toISOString()),
    // 先月のアポ数
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", prevMonthStart.toISOString())
      .lt("scheduled_at", monthStart.toISOString())
      .neq("status", "cancelled"),
    // アポが入っているリードの一覧（重複なし）
    supabase
      .from("appointments")
      .select("lead_id")
      .neq("status", "cancelled"),
    // 過去6ヶ月のアポ（トレンドチャート用）
    supabase
      .from("appointments")
      .select("scheduled_at")
      .gte("scheduled_at", sixMonthsAgo.toISOString())
      .neq("status", "cancelled"),
  ]);

  // 今月のシフトデータ（生産性計算用）
  type ShiftRow = Shift & { staff?: { id: string; name: string } | null };
  let monthlyShifts: ShiftRow[] = [];
  try {
    const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthToDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthTo = `${monthToDate.getFullYear()}-${String(monthToDate.getMonth() + 1).padStart(2, "0")}-${String(monthToDate.getDate()).padStart(2, "0")}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shiftRows } = await (supabase as any)
      .from("shifts")
      .select("*, staff(id,name)")
      .gte("shift_date", monthFrom)
      .lte("shift_date", monthTo);
    monthlyShifts = (shiftRows ?? []) as ShiftRow[];
  } catch { /* テーブル未作成の場合スキップ */ }

  // --- 今月のアポ集計 ---
  type ApptRow = {
    id: string;
    item_category: string | null;
    staff: { name: string | null } | null;
    lead_id: string | null;
    additional_items_confirmed: Record<string, boolean> | null;
  };
  const appts = (monthlyApptRows ?? []) as ApptRow[];
  const thisMonthApptCount = appts.length;

  // --- 追加買取（レバー2）KPI 集計 ---
  // 高単価カテゴリ定義（MAKXAS_PHILOSOPHY: レバー2優先カテゴリ）
  const HIGH_VALUE_CATEGORIES = new Set(["貴金属", "時計", "ブランド品", "骨董品"]);

  // 1. 追加品確認率: additional_items_confirmed に1つ以上 true がある割合
  const apptsWithAdditionalCheck = appts.filter((a) => {
    const conf = a.additional_items_confirmed;
    if (!conf || typeof conf !== "object") return false;
    return Object.values(conf).some((v) => v === true);
  }).length;
  const additionalCheckRate = thisMonthApptCount > 0
    ? Math.round((apptsWithAdditionalCheck / thisMonthApptCount) * 100)
    : 0;

  // 2. 高単価カテゴリ比率: 今月アポの品目カテゴリが高単価4種のものの割合
  const highValueApptCount = appts.filter((a) =>
    a.item_category ? HIGH_VALUE_CATEGORIES.has(a.item_category) : false,
  ).length;
  const highValueRate = thisMonthApptCount > 0
    ? Math.round((highValueApptCount / thisMonthApptCount) * 100)
    : 0;

  // 3. 平均追加確認カテゴリ数: 確認実施済みアポの平均チェック数
  let totalAdditionalChecks = 0;
  for (const a of appts) {
    const conf = a.additional_items_confirmed;
    if (!conf || typeof conf !== "object") continue;
    totalAdditionalChecks += Object.values(conf).filter((v) => v === true).length;
  }
  const avgAdditionalChecksPerAppt = apptsWithAdditionalCheck > 0
    ? (totalAdditionalChecks / apptsWithAdditionalCheck).toFixed(1)
    : "0";

  // 4. 追加買取カテゴリ別ヒット数（チェックされた追加品の集計）
  const additionalCategoryHits: Record<string, number> = {};
  for (const a of appts) {
    const conf = a.additional_items_confirmed;
    if (!conf || typeof conf !== "object") continue;
    for (const [cat, checked] of Object.entries(conf)) {
      if (checked === true) {
        additionalCategoryHits[cat] = (additionalCategoryHits[cat] ?? 0) + 1;
      }
    }
  }
  const additionalCategoryRanking = Object.entries(additionalCategoryHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // 担当者別アポ数ランキング
  const staffApptMap: Record<string, number> = {};
  for (const a of appts) {
    const name = a.staff?.name ?? "未割当";
    staffApptMap[name] = (staffApptMap[name] ?? 0) + 1;
  }
  const staffRanking = Object.entries(staffApptMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 品目カテゴリ別ランキング
  const categoryMap: Record<string, number> = {};
  for (const a of appts) {
    const cat = a.item_category ?? "未分類";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
  }
  const categoryRanking = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // 平均仕入点数（アポがある一意のリード数 vs 今月アポ総数）
  const uniqueLeadsWithAppt = new Set((leadApptRows ?? []).map((r) => r.lead_id)).size;
  const avgApptPerLead = uniqueLeadsWithAppt > 0
    ? (((leadApptRows ?? []).length) / uniqueLeadsWithAppt).toFixed(1)
    : "—";

  // チャネル別アポ率（今月）+ 顧客プロファイル集計用
  type CustomerProfileJson = {
    age_group?: string;
    income_level?: string;
    sell_motivation?: string;
    motivation_strength?: string;
  };
  type InqRow = {
    id: string;
    channel: string;
    status: string;
    customer_profile: CustomerProfileJson | null;
    suggested_items: string[] | null;
    approach_hint: string | null;
  };
  const monthlyInquiries = (monthlyInquiryRows ?? []) as InqRow[];

  // --- AI 抽出活用率・売却動機分布 ---
  const profiledInquiries = monthlyInquiries.filter(
    (i) => i.customer_profile && typeof i.customer_profile === "object",
  );
  const aiUtilizationRate = monthlyInquiries.length > 0
    ? Math.round((profiledInquiries.length / monthlyInquiries.length) * 100)
    : 0;

  // 売却動機分布（estate/moving/declutter/replacement/unknown）
  const motivationLabels: Record<string, string> = {
    estate: "遺品整理",
    moving: "引越し",
    declutter: "片付け",
    replacement: "買い換え",
    unknown: "不明",
  };
  const motivationCounts: Record<string, number> = {};
  for (const inq of profiledInquiries) {
    const m = inq.customer_profile?.sell_motivation ?? "unknown";
    motivationCounts[m] = (motivationCounts[m] ?? 0) + 1;
  }
  const motivationDistribution = Object.entries(motivationCounts)
    .map(([key, count]) => ({
      key,
      label: motivationLabels[key] ?? key,
      count,
      share: profiledInquiries.length > 0
        ? Math.round((count / profiledInquiries.length) * 100)
        : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 高単価層（中高年×高所得）の割合 — レバー2の最有望ターゲット
  const highValueProfileCount = profiledInquiries.filter(
    (i) =>
      i.customer_profile?.age_group === "middle_senior" &&
      i.customer_profile?.income_level === "affluent",
  ).length;
  const highValueProfileRate = profiledInquiries.length > 0
    ? Math.round((highValueProfileCount / profiledInquiries.length) * 100)
    : 0;
  const channelApptRate: Record<string, { total: number; appt: number }> = {};
  for (const inq of monthlyInquiries) {
    if (!channelApptRate[inq.channel]) channelApptRate[inq.channel] = { total: 0, appt: 0 };
    channelApptRate[inq.channel].total++;
    if (inq.status === "appointment_set" || inq.status === "transferred") {
      channelApptRate[inq.channel].appt++;
    }
  }

  // 今月 vs 先月のアポ数トレンド
  const apptTrend = (prevMonthApptCount ?? 0) > 0
    ? Math.round(((thisMonthApptCount - (prevMonthApptCount ?? 0)) / (prevMonthApptCount ?? 1)) * 100)
    : null;

  // 月次目標（monthly_goals テーブルが存在しない場合は空）
  type GoalRow = { id: string; month: string; goal_type: string; target: number; label: string | null };
  let goals: GoalRow[] = [];
  try {
    const { data: goalRows } = await supabase
      .from("monthly_goals")
      .select("*")
      .eq("month", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    goals = (goalRows ?? []) as GoalRow[];
  } catch {
    // テーブル未作成の場合はスキップ
  }

  // 目標進捗の実績値マッピング
  const goalActuals: Record<string, number> = {
    appointments: thisMonthApptCount,
    inquiries: monthlyInquiries.length,
  };

  // --- 6ヶ月アポ推移データ ---
  const trendData = (() => {
    const countMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      countMap[key] = 0;
    }
    for (const row of (trendApptRows ?? [])) {
      const d = new Date(row.scheduled_at as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in countMap) countMap[key] = (countMap[key] ?? 0) + 1;
    }
    return Object.entries(countMap).map(([key, count]) => {
      const [y, m] = key.split("-");
      return { month: `${Number(m)}月`, count };
    });
  })();

  // --- 生産性計算（シフトデータあり時のみ） ---
  const shiftWorkHours = (s: Shift) => {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    const mins = ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0)) - s.break_minutes;
    return Math.max(0, mins) / 60;
  };

  // スタッフ別: 今月の総稼働時間
  const staffHoursMap: Record<string, { name: string; hours: number }> = {};
  for (const s of monthlyShifts) {
    const staffId = s.staff_id;
    const name = s.staff?.name ?? "不明";
    if (!staffHoursMap[staffId]) staffHoursMap[staffId] = { name, hours: 0 };
    staffHoursMap[staffId].hours += shiftWorkHours(s);
  }

  // スタッフ別: 今月のアポ数
  const staffApptCountMap: Record<string, number> = {};
  for (const [name, count] of staffRanking) {
    // staffRankingはname→count、staffHoursMapはid→{name,hours}
    // nameで突合
    const staffEntry = Object.entries(staffHoursMap).find(([, v]) => v.name === name);
    if (staffEntry) staffApptCountMap[staffEntry[0]] = count;
  }

  // 生産性ランキング（稼働時間あたりアポ数）
  const productivityRanking = Object.entries(staffHoursMap)
    .map(([id, { name, hours }]) => {
      const appts = staffApptCountMap[id] ?? 0;
      const rate = hours > 0 ? appts / hours : 0; // アポ数/h
      return { name, hours, appts, rate };
    })
    .filter((r) => r.hours > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  const totalMonthlyHours = Object.values(staffHoursMap).reduce((acc, { hours }) => acc + hours, 0);
  const overallProductivity = totalMonthlyHours > 0
    ? (thisMonthApptCount / totalMonthlyHours).toFixed(2)
    : null;

  // --- 既存集計 ---
  const recentInquiries = (recentRows ?? []) as unknown as InquiryWithLead[];
  const appointmentRate = (totalInquiries ?? 0) > 0
    ? Math.round(((appointmentSetCount ?? 0) / (totalInquiries ?? 1)) * 100)
    : 0;
  const channelCounts = channelFilters.reduce<Record<string, number>>((acc, ch) => {
    acc[ch] = (channelRows ?? []).filter((r) => r.channel === ch).length;
    return acc;
  }, {});
  const weeklyData = buildWeeklyData(weeklyRows ?? [], sevenDaysAgo);
  const lostTagCounts = (lostTagRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.tag] = (acc[r.tag] ?? 0) + 1;
    return acc;
  }, {});
  const topLostTags = Object.entries(lostTagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const trend = (cur: number, prev: number) => {
    if (prev === 0) return null;
    const diff = cur - prev;
    const pct = Math.round(Math.abs(diff / prev) * 100);
    return { diff, pct };
  };

  const summaryCards = [
    { title: "新着", value: newCount ?? 0, icon: Inbox, trend: trend(newCount ?? 0, prevNewCount ?? 0) },
    { title: "対応中", value: inProgressCount ?? 0, icon: CircleDot, trend: trend(inProgressCount ?? 0, prevInProgressCount ?? 0) },
    { title: "本日のアポ", value: todayAppointments ?? 0, icon: CalendarCheck, trend: null },
    { title: "アポ取得率（累計）", value: `${appointmentRate}%`, icon: TrendingUp, trend: null },
  ];

  const monthLabel = `${now.getMonth() + 1}月`;

  return (
    <AppShell>
      {/* UI/UXレビュー C2: 余白統一 — モバイル16px / デスクトップ32px、内側コンテナ統一 */}
      <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          {/* ヘッダー */}
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">ダッシュボード</h1>
              <p className="mt-1 text-sm text-zinc-500">
                {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日 時点
              </p>
            </div>
            <Link
              href="/inbox"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              インボックスへ
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          {/* === 階層1: 今日のサマリー === */}
          {/* UI/UXレビュー B1: ダッシュボード3階層化 — 今日見るべき指標 */}
          <div className="mt-8 mb-3 flex items-baseline gap-3">
            <h2 className="text-sm font-semibold text-zinc-700">今日のサマリー</h2>
            <p className="text-xs text-zinc-400">まず確認すべき指標</p>
          </div>
          {/* サマリーカード */}
          <div className="grid grid-cols-4 gap-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              const t = card.trend;
              return (
                <Card key={card.title} className="rounded-lg border-zinc-200 bg-white shadow-sm">
                  <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardDescription>{card.title}</CardDescription>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
                    {t ? (
                      <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${t.diff > 0 ? "text-red-500" : t.diff < 0 ? "text-green-600" : "text-zinc-400"}`}>
                        {t.diff > 0 ? <ArrowUpRight className="size-3.5" /> : t.diff < 0 ? <ArrowDownRight className="size-3.5" /> : <Minus className="size-3.5" />}
                        <span>{t.diff > 0 ? "+" : ""}{t.diff} ({t.pct}%)</span>
                        <span className="text-zinc-400 font-normal">前週比</span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 月次目標進捗（goals が設定されている場合のみ） */}
          {goals.length > 0 ? (
            <div className="mt-6">
              <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="size-4" />
                      {monthLabel}の目標進捗
                    </CardTitle>
                    <CardDescription>設定した月次目標に対する達成状況</CardDescription>
                  </div>
                  {/* UI/UXレビュー C6: 「目標を編集」をボタン化して導線を明確に */}
                  <Link
                    href="/settings?tab=goals"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300"
                  >
                    <Target className="size-3" />
                    目標を編集
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6">
                    {goals.map((goal) => {
                      const actual = goalActuals[goal.goal_type] ?? 0;
                      const pct = Math.min(100, Math.round((actual / goal.target) * 100));
                      const goalLabel = goal.label ?? (goal.goal_type === "appointments" ? "アポ取得数" : goal.goal_type === "inquiries" ? "反響受付数" : goal.goal_type);
                      return (
                        <div key={goal.id} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-zinc-700">{goalLabel}</span>
                            <span className={`font-semibold ${pct >= 100 ? "text-green-600" : pct >= 70 ? "text-amber-600" : "text-zinc-700"}`}>
                              {actual} / {goal.target}
                            </span>
                          </div>
                          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`h-3 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-400" : "bg-zinc-800"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-right text-xs font-semibold text-zinc-500">{pct}%</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* === 階層2: 今月の状況 === */}
          {/* UI/UXレビュー B1: ダッシュボード3階層化 — 今月のチャネル/担当者/カテゴリ別状況 */}
          <div className="mt-8 mb-3 flex items-baseline gap-3">
            <h2 className="text-sm font-semibold text-zinc-700">今月の状況</h2>
            <p className="text-xs text-zinc-400">チャネル・担当者・カテゴリ別の傾向</p>
          </div>
          {/* チャネル別 + トレンド */}
          <div className="mt-6 grid grid-cols-[360px_1fr] gap-6">
            <div className="space-y-6">
              <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>チャネル別件数</CardTitle>
                  <CardDescription>対応中・アクティブな反響の内訳</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {channelFilters.map((channel) => (
                    <ChannelCountRow
                      key={channel}
                      channel={channel}
                      count={channelCounts[channel] ?? 0}
                      total={totalInquiries ?? 0}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>過去7日間の受信数</CardTitle>
                  <CardDescription>日別反響数トレンド</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-32">
                    {weeklyData.map(({ label, count: cnt, max }) => (
                      <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-700">{cnt > 0 ? cnt : ""}</span>
                        <div
                          className="w-full rounded-t bg-zinc-800 transition-all"
                          style={{ height: max > 0 ? `${Math.max(6, (cnt / max) * 80)}px` : "6px", opacity: cnt === 0 ? 0.2 : 1 }}
                        />
                        <span className="text-[10px] text-zinc-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>最近の反響</CardTitle>
                <CardDescription>直近5件</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {recentInquiries.slice(0, 5).map((item, index) => (
                    <div key={item.id}>
                      <Link
                        href={`/inbox?id=${item.id}`}
                        className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-zinc-50"
                      >
                        <ChannelBadge channel={item.channel} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{getCustomerName(item)}</p>
                          <p className="mt-1 truncate text-sm text-zinc-500">{item.subject ?? "件名なし"}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500">{formatDateTime(item.created_at)}</span>
                          <StatusBadge status={item.status} />
                        </div>
                      </Link>
                      {index < Math.min(recentInquiries.length, 5) - 1 ? <Separator /> : null}
                    </div>
                  ))}
                  {recentInquiries.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                      まだ反響はありません。
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* アポ推移グラフ */}
          <div className="mt-6">
            <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>アポ数推移</CardTitle>
                  <CardDescription>過去6ヶ月のアポ取得件数</CardDescription>
                </div>
                <Link
                  href="/shifts/report"
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  稼働レポート →
                </Link>
              </CardHeader>
              <CardContent>
                <ApptTrendChart data={trendData} />
              </CardContent>
            </Card>
          </div>

          {/* 今月のアポ分析 3カラム */}
          <div className="mt-6 grid grid-cols-3 gap-6">
            {/* 今月のアポ件数カード */}
            <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>{monthLabel}のアポ件数</CardDescription>
                <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 absolute right-6 top-4">
                  <CalendarCheck className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-semibold tracking-tight">{thisMonthApptCount}</p>
                {apptTrend !== null ? (
                  <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${apptTrend > 0 ? "text-green-600" : apptTrend < 0 ? "text-red-500" : "text-zinc-400"}`}>
                    {apptTrend > 0 ? <ArrowUpRight className="size-3.5" /> : apptTrend < 0 ? <ArrowDownRight className="size-3.5" /> : <Minus className="size-3.5" />}
                    <span>{apptTrend > 0 ? "+" : ""}{apptTrend}%</span>
                    <span className="text-zinc-400 font-normal">先月比</span>
                  </div>
                ) : null}
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <p className="text-xs text-zinc-500">平均仕入点数</p>
                  <p className="mt-0.5 text-lg font-semibold">{avgApptPerLead} <span className="text-sm font-normal text-zinc-500">件/リード</span></p>
                </div>
              </CardContent>
            </Card>

            {/* 担当者別アポランキング */}
            <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <Trophy className="size-4 text-amber-500" />
                  担当者別アポ数
                </CardTitle>
                <CardDescription>{monthLabel}の担当者別取得件数</CardDescription>
              </CardHeader>
              <CardContent>
                {staffRanking.length === 0 ? (
                  <p className="text-sm text-zinc-400">今月のアポデータがありません</p>
                ) : (
                  <div className="space-y-2.5">
                    {staffRanking.map(([name, cnt], i) => {
                      const max = staffRanking[0]?.[1] ?? 1;
                      const pct = Math.round((cnt / max) * 100);
                      return (
                        <div key={name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-zinc-200 text-zinc-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-zinc-100 text-zinc-500"}`}>
                                {i + 1}
                              </span>
                              <span className="font-medium text-zinc-700">{name}</span>
                            </div>
                            <span className="font-semibold">{cnt}件</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-zinc-100">
                            <div className="h-1.5 rounded-full bg-zinc-800 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 品目カテゴリ別ランキング */}
            <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <Users className="size-4 text-zinc-500" />
                  商品カテゴリ別
                </CardTitle>
                <CardDescription>{monthLabel}のアポ品目内訳</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryRanking.length === 0 ? (
                  <p className="text-sm text-zinc-400">今月のアポデータがありません</p>
                ) : (
                  <div className="space-y-2.5">
                    {categoryRanking.map(([cat, cnt]) => {
                      const max = categoryRanking[0]?.[1] ?? 1;
                      const pct = Math.round((cnt / max) * 100);
                      const totalCat = categoryRanking.reduce((s, [, c]) => s + c, 0);
                      const share = totalCat > 0 ? Math.round((cnt / totalCat) * 100) : 0;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-zinc-700">{cat}</span>
                            <span className="text-zinc-500">{cnt}件 <span className="text-xs text-zinc-400">({share}%)</span></span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-zinc-100">
                            <div className="h-1.5 rounded-full bg-zinc-600 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 追加買取（レバー2）KPI セクション ★ MAKXAS思想必須指標 */}
          <div className="mt-6">
            <Card className="rounded-lg border-amber-200 bg-amber-50/40 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-1.5">
                      <span className="text-base">💡</span>
                      追加買取（レバー2）
                    </CardTitle>
                    <CardDescription>{monthLabel}：MAKXAS最重要指標 — レバー2が天井のない利益源</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* 追加品確認率 */}
                  <div className="rounded-lg border border-amber-200 bg-white p-4">
                    <p className="text-xs font-medium text-zinc-500">追加品確認率</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-700">{additionalCheckRate}%</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      アポ {apptsWithAdditionalCheck} / {thisMonthApptCount} 件で追加品をチェック
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100">
                      <div
                        className="h-1.5 rounded-full bg-amber-500 transition-all"
                        style={{ width: `${additionalCheckRate}%` }}
                      />
                    </div>
                  </div>

                  {/* 高単価カテゴリ比率 */}
                  <div className="rounded-lg border border-amber-200 bg-white p-4">
                    <p className="text-xs font-medium text-zinc-500">高単価カテゴリ比率</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-700">{highValueRate}%</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      貴金属・時計・ブランド・骨董 {highValueApptCount} / {thisMonthApptCount} 件
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100">
                      <div
                        className="h-1.5 rounded-full bg-amber-500 transition-all"
                        style={{ width: `${highValueRate}%` }}
                      />
                    </div>
                  </div>

                  {/* 平均確認カテゴリ数 */}
                  <div className="rounded-lg border border-amber-200 bg-white p-4">
                    <p className="text-xs font-medium text-zinc-500">平均確認カテゴリ数</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-700">
                      {avgAdditionalChecksPerAppt}
                      <span className="ml-1 text-sm font-normal text-zinc-400">カテゴリ/アポ</span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      確認実施済みアポ {apptsWithAdditionalCheck} 件の平均
                    </p>
                    <p className="mt-2 text-[10px] text-zinc-400">
                      ※ 確認カテゴリ数が多いほど追加買取の機会創出が増える
                    </p>
                  </div>
                </div>

                {/* 顧客プロファイル分析（AI抽出済み反響の集計） */}
                {profiledInquiries.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* 売却動機分布 */}
                    <div className="rounded-lg border border-amber-200 bg-white p-4">
                      <div className="mb-3 flex items-baseline justify-between">
                        <p className="text-xs font-medium text-zinc-500">売却動機分布（顧客ニーズ）</p>
                        <p className="text-[10px] text-zinc-400">
                          AI抽出 {profiledInquiries.length} 件
                        </p>
                      </div>
                      <div className="space-y-2">
                        {motivationDistribution.map(({ key, label, count, share }) => {
                          // 動機の強さで色分け（強い順: estate > moving > declutter > replacement）
                          const color =
                            key === "estate" ? "bg-rose-500"
                            : key === "moving" ? "bg-amber-500"
                            : key === "declutter" ? "bg-sky-500"
                            : key === "replacement" ? "bg-zinc-400"
                            : "bg-zinc-300";
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-zinc-700">{label}</span>
                                <span className="text-zinc-500">
                                  {count}件 <span className="text-xs text-zinc-400">({share}%)</span>
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-zinc-100">
                                <div className={cn("h-1.5 rounded-full transition-all", color)} style={{ width: `${share}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 高単価層比率 + AI抽出活用率 */}
                    <div className="space-y-3">
                      <div className="rounded-lg border border-amber-200 bg-white p-4">
                        <p className="text-xs font-medium text-zinc-500">高単価層（中高年×高所得）</p>
                        <p className="mt-1 text-2xl font-semibold text-amber-700">{highValueProfileRate}%</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          AI抽出済 {highValueProfileCount} / {profiledInquiries.length} 件 — 貴金属・時計・ブランド・骨董の最有望層
                        </p>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100">
                          <div className="h-1.5 rounded-full bg-rose-500 transition-all" style={{ width: `${highValueProfileRate}%` }} />
                        </div>
                      </div>
                      <div className="rounded-lg border border-zinc-200 bg-white p-4">
                        <p className="text-xs font-medium text-zinc-500">AI抽出活用率</p>
                        <p className="mt-1 text-2xl font-semibold text-zinc-700">{aiUtilizationRate}%</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          今月反響 {profiledInquiries.length} / {monthlyInquiries.length} 件で顧客プロファイル抽出済
                        </p>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100">
                          <div className="h-1.5 rounded-full bg-zinc-600 transition-all" style={{ width: `${aiUtilizationRate}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* 追加品カテゴリ別ヒット */}
                {additionalCategoryRanking.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4">
                    <p className="mb-3 text-xs font-medium text-zinc-500">追加品確認カテゴリ TOP6</p>
                    <div className="space-y-2">
                      {additionalCategoryRanking.map(([cat, cnt]) => {
                        const max = additionalCategoryRanking[0]?.[1] ?? 1;
                        const pct = Math.round((cnt / max) * 100);
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-zinc-700">{cat}</span>
                              <span className="text-zinc-500">{cnt}件</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-zinc-100">
                              <div className="h-1.5 rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-amber-200 bg-white p-4 text-center">
                    <p className="text-sm text-zinc-500">
                      まだ追加品確認データがありません
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      アポ設定モーダルの「💡 追加査定品の確認チェックリスト」で追加品をチェックすると、ここに集計されます
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* チャネル別アポ率（今月） */}
          {Object.keys(channelApptRate).length > 0 ? (
            <div className="mt-6">
              <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>チャネル別アポ率</CardTitle>
                  <CardDescription>{monthLabel}：チャネルごとのアポ取得率（アポ取得済 + 引継完了 / 総反響数）</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
                    {channelFilters.map((ch) => {
                      const data = channelApptRate[ch];
                      if (!data || data.total === 0) return null;
                      const rate = Math.round((data.appt / data.total) * 100);
                      const meta = channelMeta[ch];
                      return (
                        <div key={ch} className="flex flex-col items-center gap-2 rounded-lg border border-zinc-100 p-3">
                          <ChannelBadge channel={ch} />
                          <div className="text-center">
                            <p className="text-2xl font-bold">{rate}%</p>
                            <p className="text-xs text-zinc-400">{data.appt}/{data.total}</p>
                          </div>
                          <p className="text-xs font-medium text-zinc-600">{meta.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* === 階層3: 分析・詳細 === */}
          {/* UI/UXレビュー B1: ダッシュボード3階層化 — 折りたたみ可能な詳細分析 */}
          <details className="mt-8 group" open>
            <summary className="mb-3 flex cursor-pointer items-baseline gap-3 list-none [&::-webkit-details-marker]:hidden">
              <span className="inline-block text-zinc-400 transition-transform group-open:rotate-90">▶</span>
              <h2 className="text-sm font-semibold text-zinc-700">分析・詳細</h2>
              <p className="text-xs text-zinc-400">失注タグ・生産性レポート（折りたたみ可）</p>
            </summary>
          {/* 失注タグ分析 */}
          {topLostTags.length > 0 ? (
            <div className="mt-6">
              <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>失注タグ分析</CardTitle>
                  <CardDescription>失注反響に付いているタグの頻度（上位8件）</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {topLostTags.map(([tag, cnt]) => {
                      const max = topLostTags[0]?.[1] ?? 1;
                      const pct = Math.round((cnt / max) * 100);
                      return (
                        <div key={tag} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-zinc-700">{tag}</span>
                            <span className="text-zinc-500">{cnt}件</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-zinc-100">
                            <div className="h-1.5 rounded-full bg-red-400 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* 生産性ウィジェット（シフトデータあり時のみ） */}
          {productivityRanking.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* 総合生産性 */}
              <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                    ⚡ 時間あたり生産性（{monthLabel}）
                  </CardTitle>
                  <CardDescription>総稼働時間に対するアポ取得数</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-bold tracking-tight text-zinc-900">{overallProductivity}</span>
                    <span className="mb-1 text-sm text-zinc-500">件 / h</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    総稼働 {Math.round(totalMonthlyHours)}h ÷ アポ {thisMonthApptCount}件
                  </p>
                </CardContent>
              </Card>

              {/* スタッフ別生産性ランキング */}
              <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-zinc-700">
                    👤 スタッフ別生産性（{monthLabel}）
                  </CardTitle>
                  <CardDescription>稼働1時間あたりのアポ取得数</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {productivityRanking.map((r, i) => {
                      const maxRate = productivityRanking[0]?.rate ?? 1;
                      const pct = maxRate > 0 ? Math.round((r.rate / maxRate) * 100) : 0;
                      return (
                        <div key={r.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-4 font-bold text-zinc-400">{i + 1}</span>
                              <span className="font-medium text-zinc-800">{r.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-zinc-500">
                              <span>{r.appts}件 / {Math.round(r.hours)}h</span>
                              <span className="font-semibold text-zinc-900">{r.rate.toFixed(2)}/h</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-zinc-100">
                            <div
                              className="h-1.5 rounded-full bg-violet-400 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Link
                    href="/shifts"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700"
                  >
                    シフト管理へ →
                  </Link>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex items-center justify-between rounded-xl border border-dashed border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-zinc-100">
                    <span className="text-base">⚡</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-700">シフトを登録すると生産性が確認できます</p>
                    <p className="text-xs text-zinc-400">稼働時間あたりのアポ取得数・スタッフ別効率を表示</p>
                  </div>
                </div>
                <Link
                  href="/shifts"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  シフト管理へ
                </Link>
              </div>
            </div>
          )}

          </details>

          {/* 目標未設定の場合のCTA */}
          {goals.length === 0 ? (
            <div className="mt-6">
              <div className="flex items-center justify-between rounded-xl border border-dashed border-zinc-300 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-zinc-100">
                    <Target className="size-5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-700">{monthLabel}の目標がまだ設定されていません</p>
                    <p className="text-xs text-zinc-500">アポ取得数・反響件数の目標を設定すると、ここで進捗が確認できます</p>
                  </div>
                </div>
                <Link
                  href="/settings?tab=goals"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-950 px-3 text-xs font-medium text-white hover:bg-zinc-800"
                >
                  <Target className="size-3.5" />
                  目標を設定する
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function buildWeeklyData(rows: { created_at: string }[], from: Date) {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    counts[d.toDateString()] = 0;
  }
  for (const row of rows) {
    const key = new Date(row.created_at).toDateString();
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1;
  }
  const max = Math.max(...Object.values(counts), 1);
  return Object.entries(counts).map(([key, count]) => ({
    label: new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(key)),
    count,
    max,
  }));
}

function ChannelCountRow({ channel, count, total }: { channel: InquiryChannel; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <ChannelBadge channel={channel} showLabel />
        <span className="text-sm font-semibold">
          {count}
          <span className="ml-1 text-xs font-normal text-zinc-500">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-100">
        <div className="h-1.5 rounded-full bg-zinc-900 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function getCustomerName(inquiry: InquiryWithLead) {
  return (
    inquiry.leads?.display_name ??
    inquiry.leads?.email ??
    inquiry.leads?.phone ??
    "未登録リード"
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
