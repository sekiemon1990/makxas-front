import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ChannelBadge } from "@/components/badges";
import { createServiceClient } from "@/lib/supabase/service";
import type { Lead } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = createServiceClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const leadIds = (leads ?? []).map((l) => l.id);

  const { data: inquiryCounts } =
    leadIds.length > 0
      ? await supabase
          .from("inquiries")
          .select("lead_id, channel, status")
          .in("lead_id", leadIds)
      : { data: [] };

  const countMap = new Map<string, { total: number; channels: string[] }>();
  for (const row of inquiryCounts ?? []) {
    if (!row.lead_id) continue;
    const existing = countMap.get(row.lead_id) ?? { total: 0, channels: [] };
    countMap.set(row.lead_id, {
      total: existing.total + 1,
      channels: [...new Set([...existing.channels, row.channel])],
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">リード一覧</h1>
        <p className="mt-1 text-sm text-zinc-500">
          全 {(leads ?? []).length} 件のリード
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                <th className="px-4 py-3 font-medium text-zinc-500">顧客名</th>
                <th className="px-4 py-3 font-medium text-zinc-500">電話番号</th>
                <th className="px-4 py-3 font-medium text-zinc-500">メール</th>
                <th className="px-4 py-3 font-medium text-zinc-500">チャネル</th>
                <th className="px-4 py-3 font-medium text-zinc-500">反響数</th>
                <th className="px-4 py-3 font-medium text-zinc-500">登録日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(leads ?? []).map((lead) => {
                const info = countMap.get(lead.id);
                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {getLeadName(lead)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {lead.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 max-w-[200px] truncate">
                      {lead.email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(info?.channels ?? []).map((ch) => (
                          <ChannelBadge
                            key={ch}
                            channel={ch as Parameters<typeof ChannelBadge>[0]["channel"]}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-zinc-100 px-2 text-xs font-medium text-zinc-700">
                        {info?.total ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(leads ?? []).length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">
              リードがまだいません。
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function getLeadName(lead: Lead) {
  return lead.display_name ?? lead.email ?? lead.phone ?? "名前未登録";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
