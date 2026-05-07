import Link from "next/link";
import {
  ArrowRight,
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
import { createClient } from "@/lib/supabase/server";
import type { InquiryChannel, InquiryWithLead } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("inquiries")
    .select("*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag)")
    .order("updated_at", { ascending: false })
    .limit(50);
  const inquiries = (rows ?? []) as unknown as InquiryWithLead[];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const { count: todayAppointments } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .gte("scheduled_at", todayStart.toISOString())
    .lt("scheduled_at", tomorrowStart.toISOString());

  const appointmentSetCount = inquiries.filter(
    (item) => item.status === "appointment_set",
  ).length;
  const appointmentRate =
    inquiries.length > 0
      ? Math.round((appointmentSetCount / inquiries.length) * 100)
      : 0;
  const summaryCards = [
    {
      title: "新着",
      value: inquiries.filter((item) => item.status === "new").length,
      icon: Inbox,
    },
    {
      title: "対応中",
      value: inquiries.filter((item) => item.status === "in_progress").length,
      icon: CircleDot,
    },
    {
      title: "本日のアポ",
      value: todayAppointments ?? 0,
      icon: CalendarCheck,
    },
    {
      title: "今月のアポ取得率",
      value: `${appointmentRate}%`,
      icon: TrendingUp,
    },
  ];

  return (
    <AppShell>
      <div className="min-h-screen bg-zinc-50 p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
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

              return (
                <Card
                  key={card.title}
                  className="rounded-lg border-zinc-200 bg-white shadow-sm"
                >
                  <CardHeader className="flex-row items-center justify-between">
                    <CardDescription>{card.title}</CardDescription>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold tracking-tight">
                      {card.value}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-[360px_1fr] gap-6">
            <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>チャネル別件数</CardTitle>
                <CardDescription>現在登録されている反響の内訳</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {channelFilters.map((channel) => (
                  <ChannelCount
                    key={channel}
                    channel={channel}
                    inquiries={inquiries}
                  />
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>最近の反響一覧</CardTitle>
                <CardDescription>直近5件の反響</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {inquiries.slice(0, 5).map((item, index) => (
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
                      {index < Math.min(inquiries.length, 5) - 1 ? (
                        <Separator />
                      ) : null}
                    </div>
                  ))}
                  {inquiries.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                      まだ反響はありません。
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ChannelCount({
  channel,
  inquiries,
}: {
  channel: InquiryChannel;
  inquiries: InquiryWithLead[];
}) {
  const count = inquiries.filter((item) => item.channel === channel).length;

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2">
      <ChannelBadge channel={channel} showLabel />
      <div className="text-right">
        <p className="text-lg font-semibold">{count}</p>
        <p className="text-xs text-zinc-500">{channelMeta[channel].label}</p>
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
