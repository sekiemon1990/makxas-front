import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, MessageSquare, Phone, Mail, Hash } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ChannelBadge, StatusBadge } from "@/components/badges";
import { createServiceClient } from "@/lib/supabase/service";
import type { InquiryWithLead, Message } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!lead) notFound();

  const [{ data: inquiryRows }, { data: appointmentRows }] = await Promise.all([
    supabase
      .from("inquiries")
      .select(
        "*, leads(*), staff:assigned_to(id,name,email), brands(id,name,brand_code), stores(id,name,store_code,store_type), inquiry_tags(tag)",
      )
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("*, staff:staff_id(name)")
      .eq("lead_id", id)
      .order("scheduled_at", { ascending: false }),
  ]);

  const inquiries = (inquiryRows ?? []) as unknown as InquiryWithLead[];

  const inquiryIds = inquiries.map((i) => i.id);
  const { data: messageRows } =
    inquiryIds.length > 0
      ? await supabase
          .from("messages")
          .select("*")
          .in("inquiry_id", inquiryIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  const messages = (messageRows ?? []) as Message[];
  const messagesByInquiry = new Map<string, Message[]>();
  for (const msg of messages) {
    const existing = messagesByInquiry.get(msg.inquiry_id) ?? [];
    messagesByInquiry.set(msg.inquiry_id, [...existing, msg]);
  }

  const appointments = appointmentRows ?? [];
  const leadName =
    lead.display_name ?? lead.email ?? lead.phone ?? "名前未登録";

  const lastContact = inquiries[0]?.created_at ?? null;
  const appointmentCount = appointments.length;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href="/leads"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          リード一覧へ戻る
        </Link>

        {/* リード情報カード */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {leadName}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-zinc-500">
                {lead.phone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    {lead.phone}
                  </span>
                ) : null}
                {lead.email ? (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" />
                    {lead.email}
                  </span>
                ) : null}
                {lead.line_user_id ? (
                  <span className="flex items-center gap-1.5">
                    <Hash className="size-3.5" />
                    LINE: {lead.line_user_id}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-400">
              <p>登録: {formatDate(lead.created_at)}</p>
              <p>更新: {formatDate(lead.updated_at)}</p>
            </div>
          </div>

          {(lead.line_tags ?? []).length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(lead.line_tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {/* 統計サマリー */}
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-5">
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs mb-1">
                <MessageSquare className="size-3.5" />
                総反響数
              </div>
              <p className="text-2xl font-semibold text-zinc-900">{inquiries.length}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs mb-1">
                <Calendar className="size-3.5" />
                アポ数
              </div>
              <p className="text-2xl font-semibold text-zinc-900">{appointmentCount}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-center">
              <div className="text-zinc-500 text-xs mb-1">最終接触</div>
              <p className="text-sm font-medium text-zinc-900">
                {lastContact ? formatDate(lastContact) : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* アポイントメント履歴 */}
        {appointments.length > 0 ? (
          <>
            <h2 className="mt-8 mb-4 text-lg font-semibold">
              アポイントメント履歴
              <span className="ml-2 text-sm font-normal text-zinc-500">
                {appointments.length} 件
              </span>
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                    <th className="px-4 py-3 font-medium text-zinc-500">査定日時</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">品目</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">方法</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">担当</th>
                    <th className="px-4 py-3 font-medium text-zinc-500">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {formatDateTime(apt.scheduled_at)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {apt.item_category ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {apt.preferred_method === "visit"
                          ? "訪問"
                          : apt.preferred_method === "delivery"
                            ? "宅配"
                            : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {(apt.staff as { name?: string } | null)?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            apt.status === "confirmed"
                              ? "bg-green-100 text-green-700"
                              : apt.status === "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {apt.status === "confirmed"
                            ? "確定"
                            : apt.status === "cancelled"
                              ? "キャンセル"
                              : apt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {/* 反響タイムライン */}
        <h2 className="mt-8 mb-4 text-lg font-semibold">
          反響・接触履歴
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {inquiries.length} 件
          </span>
        </h2>

        {inquiries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            反響データがありません。
          </div>
        ) : null}

        <div className="space-y-6">
          {inquiries.map((inquiry) => {
            const msgs = messagesByInquiry.get(inquiry.id) ?? [];
            return (
              <div
                key={inquiry.id}
                className="rounded-xl border border-zinc-200 bg-white"
              >
                <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <ChannelBadge channel={inquiry.channel} showLabel />
                    <StatusBadge status={inquiry.status} />
                    <span className="truncate font-medium text-zinc-900">
                      {inquiry.subject ?? "件名なし"}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-xs text-zinc-400">
                    <p>{formatDate(inquiry.created_at)}</p>
                    {inquiry.stores?.name ? (
                      <p className="mt-0.5">{inquiry.stores.name}</p>
                    ) : null}
                  </div>
                </div>

                {/* タグ */}
                {(inquiry.inquiry_tags ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 px-5 pt-3">
                    {(inquiry.inquiry_tags ?? []).map((t: { tag: string }) => (
                      <span
                        key={t.tag}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                      >
                        {t.tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* メッセージスレッド */}
                {msgs.length > 0 ? (
                  <div className="space-y-3 px-5 py-4">
                    {msgs.slice(0, 3).map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 text-sm leading-6 ${
                            msg.direction === "outbound"
                              ? "bg-zinc-950 text-white"
                              : "border border-zinc-200 bg-zinc-50 text-zinc-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap line-clamp-3">
                            {msg.body ?? ""}
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">
                            {formatDateTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {msgs.length > 3 ? (
                      <p className="text-center text-xs text-zinc-400">
                        他 {msgs.length - 3} 件のメッセージ
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="px-5 py-3 text-xs text-zinc-400">
                    メッセージなし
                  </p>
                )}

                <div className="border-t border-zinc-100 px-5 py-3">
                  <Link
                    href={`/inbox?id=${inquiry.id}`}
                    className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
                  >
                    インボックスで開く →
                  </Link>
                </div>
              </div>
            );
          })}
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
