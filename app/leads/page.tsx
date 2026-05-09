"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, CalendarCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ChannelBadge } from "@/components/badges";
import { cn } from "@/lib/utils";

type LeadRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  line_user_id: string | null;
  first_channel: string | null;
  created_at: string;
};

type InquirySummary = {
  lead_id: string;
  channel: string;
  created_at: string;
};

type AppointmentSummary = {
  lead_id: string;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [inquiries, setInquiries] = useState<InquirySummary[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/leads/list").then((r) => r.json()),
    ])
      .then(([d]: [{ leads?: LeadRow[]; inquiries?: InquirySummary[]; appointments?: AppointmentSummary[] }]) => {
        setLeads(d.leads ?? []);
        setInquiries(d.inquiries ?? []);
        setAppointments(d.appointments ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const countMap = useMemo(() => {
    const map = new Map<string, { total: number; channels: string[]; lastContact: string | null }>();
    for (const inq of inquiries) {
      if (!inq.lead_id) continue;
      const existing = map.get(inq.lead_id) ?? { total: 0, channels: [], lastContact: null };
      const last = existing.lastContact && existing.lastContact > inq.created_at ? existing.lastContact : inq.created_at;
      map.set(inq.lead_id, {
        total: existing.total + 1,
        channels: [...new Set([...existing.channels, inq.channel])],
        lastContact: last,
      });
    }
    return map;
  }, [inquiries]);

  const apptMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      map.set(a.lead_id, (map.get(a.lead_id) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        (l.display_name ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q) ||
        (l.email ?? "").toLowerCase().includes(q),
    );
  }, [leads, search]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">リード一覧</h1>
            <p className="mt-1 text-sm text-zinc-500">
              全 {leads.length} 件{search ? ` / 検索結果 ${filteredLeads.length} 件` : ""}
            </p>
          </div>
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="氏名・電話・メールで検索"
              type="search"
              value={search}
            />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {loading ? (
            <div className="p-12 text-center text-sm text-zinc-400">読み込み中...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                  <th className="px-4 py-3 font-medium text-zinc-500">顧客名</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">電話番号</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">メール</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">チャネル</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-center">反響</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-center">アポ</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">最終接触</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">登録日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredLeads.map((lead) => {
                  const info = countMap.get(lead.id);
                  const apptCount = apptMap.get(lead.id) ?? 0;
                  const lastContact = info?.lastContact ?? null;
                  const daysSince = lastContact
                    ? Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000)
                    : null;
                  const isStale = daysSince !== null && daysSince >= 7;

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
                          {lead.display_name ?? lead.email ?? lead.phone ?? "名前未登録"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{lead.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 max-w-[180px] truncate">{lead.email ?? "—"}</td>
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
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-zinc-100 px-2 text-xs font-medium text-zinc-700">
                          {info?.total ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {apptCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <CalendarCheck className="size-3" />
                            {apptCount}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lastContact ? (
                          <span className={cn("text-xs", isStale ? "font-medium text-orange-500" : "text-zinc-500")}>
                            {isStale ? `${daysSince}日前` : formatDate(lastContact)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(lead.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && filteredLeads.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">
              {search ? `"${search}" に一致するリードがいません。` : "リードがまだいません。"}
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
