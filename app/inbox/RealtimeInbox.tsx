"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, Send, Tag } from "lucide-react";

import { ChannelBadge, StatusBadge } from "@/components/badges";
import { AppointmentModal } from "@/components/inbox/AppointmentModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import {
  channelFilters,
  channelMeta,
  statusFilters,
} from "@/lib/inquiry-options";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  Inquiry,
  InquiryChannel,
  InquiryStatus,
  InquiryWithLead,
  Message,
  Staff,
  Store,
} from "@/types/database";

type StatusFilter = InquiryStatus | "all";
type ChannelFilter = InquiryChannel | "all";
type StoreFilter = string | "all";

export function RealtimeInbox({
  canUseAllStores,
  initialChannel,
  initialInquiries,
  initialMessages,
  initialSelectedId,
  initialStatus,
  initialStore,
  staff,
  stores,
}: {
  canUseAllStores: boolean;
  initialChannel: ChannelFilter;
  initialInquiries: InquiryWithLead[];
  initialMessages: Message[];
  initialSelectedId: string | null;
  initialStatus: StatusFilter;
  initialStore: StoreFilter;
  staff: Staff[];
  stores: Store[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialInquiries);
  const [messages, setMessages] = useState(initialMessages);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [replyBody, setReplyBody] = useState("");
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [toast, setToast] = useState<{
    title: string;
    description?: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("inquiries-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiries" },
        (payload) => {
          const row = payload.new as Inquiry;

          if (
            (initialStatus !== "all" && row.status !== initialStatus) ||
            (initialChannel !== "all" && row.channel !== initialChannel) ||
            (initialStore !== "all" && row.store_id !== initialStore)
          ) {
            return;
          }

          const inquiry: InquiryWithLead = {
            ...row,
            leads: null,
            staff: null,
            inquiry_tags: [],
          };

          setItems((current) =>
            current.some((item) => item.id === inquiry.id)
              ? current
              : [inquiry, ...current],
          );
          setToast({
            title: "新着反響が届きました",
            description: inquiry.subject ?? "新しい問い合わせがあります。",
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialChannel, initialStatus, initialStore]);

  const selectedInquiry = useMemo(() => {
    return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  }, [items, selectedId]);

  const updateQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const replaceInquiry = (inquiry: InquiryWithLead) => {
    setItems((current) =>
      current.map((item) => (item.id === inquiry.id ? inquiry : item)),
    );
  };

  const handleStatusChange = async (status: InquiryStatus) => {
    if (!selectedInquiry) return;

    const response = await fetch(`/api/inquiries/${selectedInquiry.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { inquiry: InquiryWithLead };
      replaceInquiry(payload.inquiry);
      router.refresh();
    }
  };

  const handleAssignChange = async (assignedTo: string) => {
    if (!selectedInquiry) return;

    const response = await fetch(`/api/inquiries/${selectedInquiry.id}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assigned_to: assignedTo === "unassigned" ? null : assignedTo,
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { inquiry: InquiryWithLead };
      replaceInquiry(payload.inquiry);
      router.refresh();
    }
  };

  const handleSendMessage = async () => {
    if (!selectedInquiry || !replyBody.trim()) return;

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inquiry_id: selectedInquiry.id,
        body: replyBody,
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { message: Message };
      setMessages((current) => [...current, payload.message]);
      setReplyBody("");
      router.refresh();
    }
  };

  return (
    <>
      <div className="grid h-screen grid-cols-[260px_minmax(360px,480px)_minmax(460px,1fr)] overflow-hidden">
        <aside className="overflow-y-auto border-r border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Inbox
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              統合インボックス
            </h1>
          </div>
          <div className="space-y-7 p-4">
            <FilterSection title="店舗フィルター">
              {canUseAllStores ? (
                <FilterButton
                  active={initialStore === "all"}
                  onClick={() => updateQuery({ store: "all", id: null })}
                >
                  全店舗
                </FilterButton>
              ) : null}
              {stores.map((store) => (
                <FilterButton
                  key={store.id}
                  active={initialStore === store.id}
                  onClick={() => updateQuery({ store: store.id, id: null })}
                >
                  {store.name}
                </FilterButton>
              ))}
            </FilterSection>
            <FilterSection title="ステータスフィルター">
              {statusFilters.map((filter) => (
                <FilterButton
                  key={filter.value}
                  active={initialStatus === filter.value}
                  onClick={() =>
                    updateQuery({ status: filter.value, id: null })
                  }
                >
                  {filter.label}
                </FilterButton>
              ))}
            </FilterSection>
            <FilterSection title="チャネルフィルター">
              <FilterButton
                active={initialChannel === "all"}
                onClick={() => updateQuery({ channel: "all", id: null })}
              >
                全て
              </FilterButton>
              {channelFilters.map((channel) => (
                <FilterButton
                  key={channel}
                  active={initialChannel === channel}
                  onClick={() => updateQuery({ channel, id: null })}
                >
                  <ChannelBadge channel={channel} />
                  <span>{channelMeta[channel].label}</span>
                </FilterButton>
              ))}
            </FilterSection>
          </div>
        </aside>

        <section className="overflow-y-auto border-r border-zinc-200 bg-zinc-50">
          <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 px-5 py-4 backdrop-blur">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  反響一覧
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {items.length}件を表示中
                </p>
              </div>
              <Badge variant="outline" className="rounded-md bg-white">
                Live
              </Badge>
            </div>
          </div>
          <div className="space-y-3 p-4">
            {items.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50",
                  item.id === selectedInquiry?.id
                    ? "border-zinc-950 ring-2 ring-zinc-950/10"
                    : "border-zinc-200",
                )}
                onClick={() => {
                  setSelectedId(item.id);
                  updateQuery({ id: item.id });
                }}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ChannelBadge channel={item.channel} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {getCustomerName(item)}
                      </p>
                      <p className="mt-1 truncate text-sm text-zinc-600">
                        {item.subject ?? "件名なし"}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                  <span>{formatElapsed(item.created_at)}</span>
                  <span>
                    {item.stores?.name ?? "店舗未設定"} /{" "}
                    {item.staff?.name ?? "未アサイン"}
                  </span>
                </div>
              </button>
            ))}
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
                条件に一致する反響はありません。
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex min-w-0 flex-col bg-white">
          {selectedInquiry ? (
            <>
              <div className="border-b border-zinc-200 px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <ChannelBadge
                        channel={selectedInquiry.channel}
                        showLabel
                      />
                      <StatusBadge status={selectedInquiry.status} />
                    </div>
                    <h2 className="mt-3 truncate text-2xl font-semibold tracking-tight">
                      {selectedInquiry.subject ?? "件名なし"}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {getCustomerName(selectedInquiry)} /{" "}
                      {selectedInquiry.stores?.name ?? "店舗未設定"} /{" "}
                      {formatDateTime(selectedInquiry.created_at)}
                    </p>
                  </div>
                  <Button onClick={() => setAppointmentOpen(true)}>
                    <CalendarPlus className="size-4" aria-hidden="true" />
                    アポを設定
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.direction === "outbound"
                          ? "justify-end"
                          : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[72%] rounded-lg px-4 py-3 text-sm leading-6",
                          message.direction === "outbound"
                            ? "bg-zinc-950 text-white"
                            : "border border-zinc-200 bg-zinc-50 text-zinc-900",
                        )}
                      >
                        <p className="whitespace-pre-wrap">
                          {message.body ?? ""}
                        </p>
                        <p
                          className={cn(
                            "mt-2 text-xs",
                            message.direction === "outbound"
                              ? "text-zinc-300"
                              : "text-zinc-500",
                          )}
                        >
                          {formatDateTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                      この反響のメッセージはまだありません。
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-zinc-200 bg-zinc-50 p-5">
                <div className="grid grid-cols-[1fr_280px] gap-5">
                  <div className="space-y-3">
                    <Textarea
                      className="min-h-24 resize-none bg-white"
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder="返信メッセージを入力"
                      value={replyBody}
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleSendMessage} type="button">
                        <Send className="size-4" aria-hidden="true" />
                        送信
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">
                          ステータス変更
                        </label>
                        <Select
                          value={selectedInquiry.status}
                          onValueChange={(value) =>
                            handleStatusChange(value as InquiryStatus)
                          }
                        >
                          <SelectTrigger className="w-full bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusFilters
                              .filter((filter) => filter.value !== "all")
                              .map((filter) => (
                                <SelectItem
                                  key={filter.value}
                                  value={filter.value}
                                >
                                  {filter.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">
                          担当者
                        </label>
                        <Select
                          value={selectedInquiry.assigned_to ?? "unassigned"}
                          onValueChange={handleAssignChange}
                        >
                          <SelectTrigger className="w-full bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">
                              未アサイン
                            </SelectItem>
                            {staff.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                        <Tag className="size-3.5" aria-hidden="true" />
                        タグ
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(selectedInquiry.inquiry_tags ?? []).length > 0 ? (
                          selectedInquiry.inquiry_tags?.map((tag) => (
                            <Badge
                              key={tag.tag}
                              variant="outline"
                              className="rounded-md bg-white"
                            >
                              {tag.tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-zinc-500">未設定</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500">
                        内部メモ
                      </label>
                      <Textarea
                        className="min-h-20 resize-none bg-white"
                        defaultValue={selectedInquiry.internal_note ?? ""}
                        placeholder="スタッフ向けメモ"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
              反響を選択してください。
            </div>
          )}
        </section>
      </div>

      <AppointmentModal
        inquiry={selectedInquiry}
        onOpenChange={setAppointmentOpen}
        onSaved={(inquiry) => {
          replaceInquiry(inquiry);
          router.refresh();
        }}
        open={appointmentOpen}
      />

      {toast ? (
        <Toast
          description={toast.description}
          onClose={() => setToast(null)}
          title={toast.title}
        />
      ) : null}
    </>
  );
}

function FilterSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-zinc-500">
        {title}
      </h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950",
        active && "bg-zinc-950 text-white hover:bg-zinc-900 hover:text-white",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
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

function formatElapsed(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;

  return `${Math.floor(hours / 24)}日前`;
}
