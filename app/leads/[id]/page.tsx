import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  Hash,
} from "lucide-react";
import { LeadContactsPanel } from "@/components/leads/LeadContactsPanel";
import { LtvPredictionPanel } from "@/components/leads/LtvPredictionPanel";

import { AppShell } from "@/components/app-shell";
import { ChannelBadge, StatusBadge } from "@/components/badges";
import { createServiceClient } from "@/lib/supabase/service";
import { TAG_STYLE } from "@/lib/design-tokens";
import type { InquiryItem, InquiryItemCondition, InquiryWithLead, Message } from "@/types/database";
import type { InquiryChannel } from "@/types/database";

export const dynamic = "force-dynamic";

// ── タイムラインアイテム型定義 ────────────────────────────────────────────────
type TLMessage = {
  kind: "message";
  at: string;
  channel: InquiryChannel;
  direction: "inbound" | "outbound";
  body: string | null;
  media_urls: string[] | null;
  sentBy: string | null;
  inquiryId: string;
  subject: string | null;
};

type TLInquiryOpen = {
  kind: "inquiry_open";
  at: string;
  channel: InquiryChannel;
  subject: string | null;
  status: string;
  inquiryId: string;
  tags: string[];
};

type TLAppointment = {
  kind: "appointment";
  at: string;
  scheduledAt: string;
  itemCategory: string | null;
  method: "visit" | "delivery" | null;
  staffName: string | null;
  status: string;
};

type TimelineItem = TLMessage | TLInquiryOpen | TLAppointment;

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
      .order("created_at", { ascending: true }),
    supabase
      .from("appointments")
      .select("*, staff:staff_id(name)")
      .eq("lead_id", id)
      .order("scheduled_at", { ascending: true }),
  ]);

  const inquiries = (inquiryRows ?? []) as unknown as InquiryWithLead[];
  const appointments = appointmentRows ?? [];

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

  // inquiry_items（商品情報）をリード全反響分取得
  const { data: inquiryItemRows } =
    inquiryIds.length > 0
      ? await supabase
          .from("inquiry_items")
          .select("*")
          .in("inquiry_id", inquiryIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  const inquiryItems = (inquiryItemRows ?? []) as InquiryItem[];
  // 反響IDでグループ化
  const itemsByInquiry = new Map<string, InquiryItem[]>();
  for (const item of inquiryItems) {
    const arr = itemsByInquiry.get(item.inquiry_id) ?? [];
    arr.push(item);
    itemsByInquiry.set(item.inquiry_id, arr);
  }

  // ── タイムライン構築 ──────────────────────────────────────────────────────────
  const inquiryMap = new Map(inquiries.map((i) => [i.id, i]));

  const tlItems: TimelineItem[] = [];

  // 反響オープンイベント
  for (const inq of inquiries) {
    tlItems.push({
      kind: "inquiry_open",
      at: inq.created_at,
      channel: inq.channel as InquiryChannel,
      subject: inq.subject,
      status: inq.status,
      inquiryId: inq.id,
      tags: (inq.inquiry_tags ?? []).map((t: { tag: string }) => t.tag),
    });
  }

  // メッセージ
  for (const msg of messages) {
    const inq = inquiryMap.get(msg.inquiry_id);
    if (!inq) continue;
    tlItems.push({
      kind: "message",
      at: msg.created_at,
      channel: inq.channel as InquiryChannel,
      direction: msg.direction as "inbound" | "outbound",
      body: msg.body,
      media_urls: msg.media_urls,
      sentBy: null,
      inquiryId: msg.inquiry_id,
      subject: inq.subject,
    });
  }

  // アポイントメント（作成日時をタイムラインに追加）
  for (const apt of appointments) {
    tlItems.push({
      kind: "appointment",
      at: apt.created_at,
      scheduledAt: apt.scheduled_at,
      itemCategory: apt.item_category,
      method: apt.preferred_method,
      staffName: (apt.staff as { name?: string } | null)?.name ?? null,
      status: apt.status,
    });
  }

  // 時系列ソート
  tlItems.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const leadName =
    lead.display_name ?? lead.email ?? lead.phone ?? "名前未登録";
  const lastContact = inquiries[inquiries.length - 1]?.created_at ?? null;

  // PR21: LTVサマリー計算
  const HIGH_VALUE_CATEGORIES = new Set(["貴金属", "時計", "ブランド品", "骨董品"]);
  // 1. 事前査定見込み合計（estimated_price_min × 件数）
  const totalEstimatedMin = inquiryItems.reduce(
    (sum, item) =>
      sum + (typeof item.estimated_price_min === "number" ? item.estimated_price_min : 0),
    0,
  );
  // 2. 高単価カテゴリの商品数
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const highValueItemCount = (appointments as any[]).filter((a) =>
    typeof a.item_category === "string" && HIGH_VALUE_CATEGORIES.has(a.item_category),
  ).length;
  // 3. 追加品確認チェック数
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const additionalConfirmedCount = (appointments as any[]).reduce((sum, a) => {
    const conf = a.additional_items_confirmed;
    if (!conf || typeof conf !== "object") return sum;
    return sum + Object.values(conf).filter((v) => v === true).length;
  }, 0);
  // 4. アポ完了/失注/予定中の内訳
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completedAppts = (appointments as any[]).filter((a) => a.status === "completed").length;
  // 5. LTV見込みスコア: 高単価カテゴリ数 × 3 + 追加品確認 × 2 + 完了アポ × 5（最大 100）
  const ltvScore = Math.min(
    100,
    highValueItemCount * 15 + additionalConfirmedCount * 5 + completedAppts * 25,
  );
  const ltvLevel: "high" | "mid" | "low" =
    ltvScore >= 60 ? "high" : ltvScore >= 30 ? "mid" : "low";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/leads"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          リード一覧へ戻る
        </Link>

        {/* ── リード情報カード ─────────────────────────────────────────────── */}
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

          {/* 連絡先（1:N） */}
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <LeadContactsPanel leadId={id} />
          </div>

          {/* 統計 */}
          <div className="mt-5 grid grid-cols-4 gap-3 border-t border-zinc-100 pt-5">
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs mb-1">
                <MessageSquare className="size-3.5" />
                総反響数
              </div>
              <p className="text-2xl font-semibold text-zinc-900">
                {inquiries.length}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs mb-1">
                <Calendar className="size-3.5" />
                アポ数
              </div>
              <p className="text-2xl font-semibold text-zinc-900">
                {appointments.length}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs mb-1">
                <Hash className="size-3.5" />
                査定商品
              </div>
              <p className="text-2xl font-semibold text-zinc-900">
                {inquiryItems.length}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-center">
              <div className="text-zinc-500 text-xs mb-1">最終接触</div>
              <p className="text-sm font-medium text-zinc-900">
                {lastContact ? formatDate(lastContact) : "—"}
              </p>
            </div>
          </div>

          {/* PR21: 顧客LTVサマリー — MAKXAS思想に基づくレバー2スコアリング */}
          <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/30 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-violet-900">📊 顧客LTVサマリー</h3>
                <p className="text-[11px] text-violet-700/80">レバー2（追加買取）視点でのこの顧客の価値見込み</p>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${
                ltvLevel === "high"
                  ? "bg-rose-100 text-rose-700"
                  : ltvLevel === "mid"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-zinc-100 text-zinc-700"
              }`}>
                {ltvLevel === "high" ? "🔥 高LTV" : ltvLevel === "mid" ? "⭐ 中LTV" : "📌 低LTV"} ({ltvScore}/100)
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-md bg-white border border-zinc-100 px-3 py-2">
                <p className="text-[10px] text-zinc-500">事前査定合計（最低）</p>
                <p className="text-lg font-semibold text-zinc-900">
                  ¥{totalEstimatedMin.toLocaleString("ja-JP")}
                </p>
              </div>
              <div className="rounded-md bg-white border border-zinc-100 px-3 py-2">
                <p className="text-[10px] text-zinc-500">高単価カテゴリ数</p>
                <p className="text-lg font-semibold text-rose-700">{highValueItemCount} 件</p>
              </div>
              <div className="rounded-md bg-white border border-zinc-100 px-3 py-2">
                <p className="text-[10px] text-zinc-500">追加品確認数</p>
                <p className="text-lg font-semibold text-amber-700">{additionalConfirmedCount} 件</p>
              </div>
              <div className="rounded-md bg-white border border-zinc-100 px-3 py-2">
                <p className="text-[10px] text-zinc-500">完了アポ数</p>
                <p className="text-lg font-semibold text-emerald-700">{completedAppts} 件</p>
              </div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-zinc-200">
              <div
                className={`h-2 rounded-full transition-all ${
                  ltvLevel === "high"
                    ? "bg-rose-500"
                    : ltvLevel === "mid"
                    ? "bg-amber-500"
                    : "bg-zinc-400"
                }`}
                style={{ width: `${ltvScore}%` }}
              />
            </div>
          </div>

          {/* PR32: LTV予測（AI） */}
          <LtvPredictionPanel leadId={lead.id} />
        </div>

        {/* ── 査定商品履歴 ──────────────────────────────────────────────────── */}
        {inquiryItems.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold">
              査定商品履歴
              <span className="ml-2 text-sm font-normal text-zinc-500">{inquiryItems.length} 件</span>
            </h2>
            <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
              {inquiryItems.map((item) => {
                const inq = inquiries.find((i) => i.id === item.inquiry_id);
                return (
                  <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-800">{item.item_name}</span>
                        {item.condition && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${conditionColor(item.condition)}`}>
                            {item.condition}
                          </span>
                        )}
                        {item.ai_extracted && (
                          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-600">AI抽出</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                        {item.brand && <span>ブランド: {item.brand}</span>}
                        {item.model_number && <span>型番: {item.model_number}</span>}
                        {item.accessories && <span>付属: {item.accessories}</span>}
                        {inq && (
                          <Link
                            href={`/inbox?id=${inq.id}`}
                            className="text-violet-600 hover:underline"
                          >
                            → 反響を見る
                          </Link>
                        )}
                      </div>
                      {(item.quote_type ?? item.quote_price_min != null) && (
                        <p className="mt-0.5 text-xs font-medium text-emerald-700">
                          {formatQuoteServer(item)}
                        </p>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 shrink-0 pt-0.5">
                      {formatDate(item.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 統合タイムライン ──────────────────────────────────────────────── */}
        <h2 className="mt-8 mb-4 text-lg font-semibold">
          接触タイムライン
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {tlItems.length} 件
          </span>
        </h2>

        {tlItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            記録がありません。
          </div>
        ) : (
          <div className="relative">
            {/* 縦線 */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-zinc-200" />

            <div className="space-y-1">
              {tlItems.map((item, idx) => {
                const prevItem = idx > 0 ? tlItems[idx - 1] : null;
                const showDate =
                  !prevItem ||
                  toDateStr(item.at) !== toDateStr(prevItem.at);

                return (
                  <div key={idx}>
                    {showDate ? (
                      <div className="relative flex items-center gap-3 py-3">
                        <div className="relative z-10 flex size-10 shrink-0 items-center justify-center" />
                        <span className="text-xs font-medium text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full border border-zinc-200">
                          {formatDateFull(item.at)}
                        </span>
                      </div>
                    ) : null}

                    {item.kind === "inquiry_open" ? (
                      <InquiryOpenItem item={item} />
                    ) : item.kind === "message" ? (
                      <MessageItem item={item} />
                    ) : (
                      <AppointmentItem item={item} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ── タイムラインアイテムコンポーネント ─────────────────────────────────────────

function InquiryOpenItem({ item }: { item: TLInquiryOpen }) {
  return (
    <div className="relative flex items-start gap-3 py-2">
      <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-white border border-zinc-200">
        <ChannelBadge channel={item.channel} />
      </div>
      <div className="flex-1 min-w-0 rounded-xl border border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-zinc-500">反響受信</span>
          <ChannelBadge channel={item.channel} showLabel />
          <StatusBadge status={item.status as Parameters<typeof StatusBadge>[0]["status"]} />
          {item.subject ? (
            <span className="text-sm font-medium text-zinc-800 truncate">
              {item.subject}
            </span>
          ) : null}
        </div>
        {item.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {/* UI/UXレビュー C5: TAG_STYLE で全画面統一 */}
            {item.tags.map((tag) => (
              <span key={tag} className={TAG_STYLE}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-1 text-xs text-zinc-400">{formatTime(item.at)}</p>
      </div>
    </div>
  );
}

function MessageItem({ item }: { item: TLMessage }) {
  const isOut = item.direction === "outbound";

  return (
    <div
      className={`relative flex items-start gap-3 py-1 ${isOut ? "flex-row-reverse" : ""}`}
    >
      {/* アイコン（送信は右端に固定するため、outboundのときdummy spacer） */}
      {isOut ? (
        <div className="size-10 shrink-0" />
      ) : (
        <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-white border border-zinc-200">
          <ChannelBadge channel={item.channel} />
        </div>
      )}

      <div className={`flex flex-col ${isOut ? "items-end" : "items-start"} max-w-[78%]`}>
        {/* チャネルバッジ（受信側のみ） */}
        {!isOut ? (
          <div className="mb-1 flex items-center gap-1.5">
            <ChannelBadge channel={item.channel} showLabel />
          </div>
        ) : null}

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-6 ${
            isOut
              ? "bg-zinc-950 text-white rounded-br-md"
              : "border border-zinc-200 bg-white text-zinc-900 rounded-bl-md"
          }`}
        >
          <p className="whitespace-pre-wrap">
            {item.body ?? "(メディアメッセージ)"}
          </p>
        </div>

        <p className="mt-1 text-xs text-zinc-400">{formatTime(item.at)}</p>
      </div>
    </div>
  );
}

function AppointmentItem({ item }: { item: TLAppointment }) {
  return (
    <div className="relative flex items-start gap-3 py-2">
      <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-green-50 border border-green-200">
        <Calendar className="size-4 text-green-600" />
      </div>
      <div className="flex-1 min-w-0 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-green-700">アポ設定</span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              item.status === "confirmed"
                ? "bg-green-100 text-green-700"
                : item.status === "cancelled"
                  ? "bg-red-100 text-red-700"
                  : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {item.status === "confirmed"
              ? "確定"
              : item.status === "cancelled"
                ? "キャンセル"
                : item.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-green-900 font-medium">
          査定日時: {formatDateTime(item.scheduledAt)}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-green-700">
          {item.itemCategory ? <span>品目: {item.itemCategory}</span> : null}
          {item.method ? (
            <span>方法: {item.method === "visit" ? "訪問" : "宅配"}</span>
          ) : null}
          {item.staffName ? <span>担当: {item.staffName}</span> : null}
        </div>
        <p className="mt-1 text-xs text-green-500">{formatTime(item.at)}</p>
      </div>
    </div>
  );
}

// ── ユーティリティ ──────────────────────────────────────────────────────────────

function toDateStr(value: string) {
  return new Date(value).toLocaleDateString("ja-JP");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateFull(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
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

// 状態ラベルの色クラス
function conditionColor(c: InquiryItemCondition): string {
  const map: Record<InquiryItemCondition, string> = {
    N: "bg-emerald-100 text-emerald-800",
    S: "bg-green-100 text-green-800",
    A: "bg-sky-100 text-sky-800",
    B: "bg-blue-100 text-blue-800",
    C: "bg-amber-100 text-amber-800",
    D: "bg-orange-100 text-orange-800",
    J: "bg-red-100 text-red-800",
    不明: "bg-zinc-100 text-zinc-600",
    その他: "bg-zinc-100 text-zinc-600",
  };
  return map[c] ?? "bg-zinc-100 text-zinc-600";
}

// 事前査定金額の文字列化（サーバー側）
function formatQuoteServer(item: InquiryItem): string {
  if (!item.quote_type || item.quote_price_min == null) return "";
  const fmt = (n: number) => n.toLocaleString("ja-JP");
  switch (item.quote_type) {
    case "upper": return `事前査定: 最大 ¥${fmt(item.quote_price_min)}`;
    case "around": return `事前査定: ¥${fmt(item.quote_price_min)} 前後`;
    case "exact": return `事前査定: ¥${fmt(item.quote_price_min)}`;
    case "range":
      return item.quote_price_max != null
        ? `事前査定: ¥${fmt(item.quote_price_min)}〜¥${fmt(item.quote_price_max)}`
        : `事前査定: ¥${fmt(item.quote_price_min)}〜`;
  }
}
