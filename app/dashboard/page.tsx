import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CalendarCheck,
  CircleDot,
  Inbox,
  TrendingUp,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ChannelBadge, StatusBadge } from "@/components/badges";
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
import type { InquiryChannel, InquiryWithLead } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServiceClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const fourteenDaysAgo = new Date(todayStart);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

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
  ] = await Promise.all([
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_progress"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", todayStart.toISOString())
      .lt("scheduled_at", tomorrowStart.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .not("status", "in", '("lost","closed")'),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "appointment_set"),
    supabase
      .from("inquiries")
      .select(
        "*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag)",
      )
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("inquiries")
      .select("channel", { count: "exact" })
      .not("status", "in", '("lost","closed")'),
    supabase
      .from("inquiries")
      .select("created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("inquiry_tags")
      .select("tag, inquiries!inner(status)")
      .eq("inquiries.status", "lost"),
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
  ]);

  const recentInquiries = (recentRows ?? []) as unknown as InquiryWithLead[];
  const appointmentRate =
    (totalInquiries ?? 0) > 0
      ? Math.round(((appointmentSetCount ?? 0) / (totalInquiries ?? 1)) * 100)
      : 0;

  const channelCounts = channelFilters.reduce<Record<string, number>>(
    (acc, ch) => {
      acc[ch] = (channelRows ?? []).filter((r) => r.channel === ch).length;
      return acc;
    },
    {},
  );

  const weeklyData = buildWeeklyData(weeklyRows ?? [], sevenDaysAgo);

  const lostTagCounts = (lostTagRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.tag] = (acc[r.tag] ?? 0) + 1;
    return acc;
  }, {});
  const topLostTags = Object.entries(lostTagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

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

  return (
    <AppShell>
      <div className="min-h-screen bg-zinc-50 p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                ダッシュボード
              </h1>
            </div>
            <Link
              href="/inbox"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              インボックスへ
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-4 gap-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              const t = card.trend;
              return (
                <Card
                  key={card.title}
                  className="rounded-lg border-zinc-200 bg-white shadow-sm"
                >
                  <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardDescription>{card.title}</CardDescription>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold tracking-tight">
                      {card.value}
                    </p>
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

          <div className="mt-6 grid grid-cols-[360px_1fr] gap-6">
            <div className="space-y-6">
              <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>チャネル別件数</CardTitle>
                  <CardDescription>
                    対応中・アクティブな反響の内訳
                  </CardDescription>
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
                      <div
                        key={label}
                        className="flex flex-1 flex-col items-center gap-1.5"
                      >
                        <span className="text-xs font-semibold text-zinc-700">
                          {cnt > 0 ? cnt : ""}
                        </span>
                        <div
                          className="w-full rounded-t bg-zinc-800 transition-all"
                          style={{
                            height: max > 0 ? `${Math.max(6, (cnt / max) * 80)}px` : "6px",
                            opacity: cnt === 0 ? 0.2 : 1,
                          }}
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
                          <p className="truncate text-sm font-medium">
                            {getCustomerName(item)}
                          </p>
                          <p className="mt-1 truncate text-sm text-zinc-500">
                            {item.subject ?? "件名なし"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500">
                            {formatDateTime(item.created_at)}
                          </span>
                          <StatusBadge status={item.status} />
                        </div>
                      </Link>
                      {index < Math.min(recentInquiries.length, 5) - 1 ? (
                        <Separator />
                      ) : null}
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

function ChannelCountRow({
  channel,
  count,
  total,
}: {
  channel: InquiryChannel;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <ChannelBadge channel={channel} showLabel />
        <span className="text-sm font-semibold">
          {count}
          <span className="ml-1 text-xs font-normal text-zinc-500">
            ({pct}%)
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-100">
        <div
          className="h-1.5 rounded-full bg-zinc-900 transition-all"
          style={{ width: `${pct}%` }}
        />
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
