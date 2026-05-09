"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Bell, CalendarPlus, ChevronLeft, FileText, Menu, Send, Tag, X } from "lucide-react";

import { ChannelBadge, StatusBadge } from "@/components/badges";
import { AiChatWidget } from "@/components/inbox/AiChatWidget";
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
  Reminder,
  ReplyTemplate,
  Staff,
  Store,
} from "@/types/database";

type StatusFilter = InquiryStatus | "all";
type ChannelFilter = InquiryChannel | "all";
type StoreFilter = string | "all";
type AssigneeFilter = "mine" | "all";

type RelatedInquiry = {
  id: string;
  subject: string | null;
  channel: InquiryChannel;
  status: InquiryStatus;
  created_at: string;
  stores?: { name: string } | null;
};

export function RealtimeInbox({
  canUseAllStores,
  currentStaffId,
  hasMore,
  initialAssignee,
  initialChannel,
  initialInquiries,
  initialMessages,
  initialReadIds,
  initialSelectedId,
  initialStatus,
  initialStore,
  page,
  staff,
  stores,
  totalCount,
}: {
  canUseAllStores: boolean;
  currentStaffId: string | null;
  hasMore: boolean;
  initialAssignee: AssigneeFilter;
  initialChannel: ChannelFilter;
  initialInquiries: InquiryWithLead[];
  initialMessages: Message[];
  initialReadIds: string[];
  initialSelectedId: string | null;
  initialStatus: StatusFilter;
  initialStore: StoreFilter;
  page: number;
  staff: Staff[];
  stores: Store[];
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialInquiries);
  const [messages, setMessages] = useState(initialMessages);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [replyBody, setReplyBody] = useState("");
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [internalNote, setInternalNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"sidebar" | "list" | "detail">("list");
  const [readIds, setReadIds] = useState<Set<string>>(new Set(initialReadIds));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApplying, setBulkApplying] = useState(false);
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [relatedInquiries, setRelatedInquiries] = useState<RelatedInquiry[]>([]);
  const [duplicateLeads, setDuplicateLeads] = useState<{ id: string; display_name: string | null; phone: string | null; first_channel: string | null }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [toast, setToast] = useState<{
    title: string;
    description?: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const matchesFilters = (row: Inquiry) => {
      return !(
        (initialStatus !== "all" && row.status !== initialStatus) ||
        (initialChannel !== "all" && row.channel !== initialChannel) ||
        (initialStore !== "all" && row.store_id !== initialStore)
      );
    };
    const channel = supabase
      .channel("inquiries-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiries" },
        (payload) => {
          const row = payload.new as Inquiry;

          if (!matchesFilters(row)) {
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inquiries" },
        (payload) => {
          const row = payload.new as Inquiry;

          setItems((current) => {
            if (!matchesFilters(row)) {
              return current.filter((item) => item.id !== row.id);
            }

            return current.map((item) =>
              item.id === row.id ? { ...item, ...row } : item,
            );
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- AI提案のRealtime更新を編集可能な返信欄へ即時反映する。
    setReplyBody(selectedInquiry?.ai_suggested_reply ?? "");
  }, [selectedInquiry?.id, selectedInquiry?.ai_suggested_reply]);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 反響切り替え時に内部メモをリセット
    setInternalNote(selectedInquiry?.internal_note ?? "");
  }, [selectedInquiry?.id]);

  useEffect(() => {
    fetch("/api/tags")
      .then((res) => res.json())
      .then((data: { tags?: string[] }) => setAllTags(data.tags ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/reply-templates")
      .then((r) => r.json())
      .then((d: { templates?: ReplyTemplate[] }) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedInquiry) return;
    fetch(`/api/inquiries/${selectedInquiry.id}/reminders`)
      .then((r) => r.json())
      .then((d: { reminders?: Reminder[] }) => setReminders(d.reminders ?? []))
      .catch(() => {});
    // 既読マーク
    fetch(`/api/inquiries/${selectedInquiry.id}/read`, { method: "POST" }).catch(() => {});
  }, [selectedInquiry?.id]);

  useEffect(() => {
    if (!selectedInquiry?.lead_id) {
      setRelatedInquiries([]);
      setDuplicateLeads([]);
      return;
    }
    fetch(`/api/leads/${selectedInquiry.lead_id}/inquiries`)
      .then((r) => r.json())
      .then((data: { inquiries?: RelatedInquiry[] }) => {
        setRelatedInquiries(
          (data.inquiries ?? []).filter((i) => i.id !== selectedInquiry.id),
        );
      })
      .catch(() => {});
    fetch(`/api/leads/${selectedInquiry.lead_id}/duplicates`)
      .then((r) => r.json())
      .then((data: { duplicates?: { id: string; display_name: string | null; phone: string | null; first_channel: string | null }[] }) => {
        setDuplicateLeads(data.duplicates ?? []);
      })
      .catch(() => {});
  }, [selectedInquiry?.id, selectedInquiry?.lead_id]);

  const handleSaveReminder = async () => {
    if (!selectedInquiry || !reminderDate) return;
    const res = await fetch(`/api/inquiries/${selectedInquiry.id}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remind_at: reminderDate, note: reminderNote || null }),
    });
    if (res.ok) {
      const d = (await res.json()) as { reminder?: Reminder };
      if (d.reminder) setReminders((prev) => [...prev, d.reminder!]);
      setShowReminderForm(false);
      setReminderDate("");
      setReminderNote("");
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!selectedInquiry) return;
    const res = await fetch(`/api/inquiries/${selectedInquiry.id}/reminders`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminder_id: reminderId }),
    });
    if (res.ok) setReminders((prev) => prev.filter((r) => r.id !== reminderId));
  };

  const handleBulkUpdate = async (update: {
    status?: InquiryStatus;
    assigned_to?: string | null;
  }) => {
    if (selectedIds.size === 0) return;
    setBulkApplying(true);
    const res = await fetch("/api/inquiries/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selectedIds], ...update }),
    });
    if (res.ok) {
      setSelectedIds(new Set());
      router.refresh();
    }
    setBulkApplying(false);
  };

  const filteredItems = searchQuery.trim()
    ? items.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          (item.subject ?? "").toLowerCase().includes(q) ||
          (item.leads?.display_name ?? "").toLowerCase().includes(q) ||
          (item.leads?.phone ?? "").includes(q) ||
          (item.leads?.email ?? "").toLowerCase().includes(q)
        );
      })
    : items;

  const mentionSuggestions =
    mentionQuery !== null
      ? staff.filter(
          (s) =>
            mentionQuery === "" ||
            s.name.toLowerCase().includes(mentionQuery.toLowerCase()),
        )
      : [];

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart ?? value.length;
    setInternalNote(value);
    const textBeforeCursor = value.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex !== -1) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!query.includes(" ") && !query.includes("\n")) {
        setMentionQuery(query);
        setMentionStart(atIndex);
        return;
      }
    }
    setMentionQuery(null);
  };

  const handleInsertMention = (member: Staff) => {
    const before = internalNote.slice(0, mentionStart);
    const after = internalNote.slice(
      mentionStart + 1 + (mentionQuery?.length ?? 0),
    );
    setInternalNote(`${before}@${member.name} ${after}`);
    setMentionQuery(null);
    noteRef.current?.focus();
  };

  const tagSuggestions = tagInput.trim()
    ? allTags.filter(
        (t) =>
          t.toLowerCase().includes(tagInput.toLowerCase()) &&
          !(selectedInquiry?.inquiry_tags ?? []).some((it) => it.tag === t),
      )
    : [];

  const handleAddTag = async (tag: string) => {
    if (!selectedInquiry || !tag.trim()) return;

    const res = await fetch(`/api/inquiries/${selectedInquiry.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: tag.trim() }),
    });

    if (res.ok) {
      replaceInquiry({
        ...selectedInquiry,
        inquiry_tags: [
          ...(selectedInquiry.inquiry_tags ?? []),
          { inquiry_id: selectedInquiry.id, tag: tag.trim() },
        ],
      });
      setTagInput("");
      setShowTagSuggestions(false);
      if (!allTags.includes(tag.trim())) {
        setAllTags((prev) => [...prev, tag.trim()].sort());
      }
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedInquiry) return;

    const res = await fetch(`/api/inquiries/${selectedInquiry.id}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });

    if (res.ok) {
      replaceInquiry({
        ...selectedInquiry,
        inquiry_tags: (selectedInquiry.inquiry_tags ?? []).filter(
          (it) => it.tag !== tag,
        ),
      });
    }
  };

  const handleSaveNote = async () => {
    if (!selectedInquiry) return;
    setNoteSaving(true);
    const mentionedNames = [
      ...new Set(
        [...internalNote.matchAll(/@([^\s@]+)/g)].map((m) => m[1]),
      ),
    ];
    const mentionedStaffIds = staff
      .filter((s) => mentionedNames.some((name) => s.name === name))
      .map((s) => s.id);
    await fetch(`/api/inquiries/${selectedInquiry.id}/note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        internal_note: internalNote,
        mentioned_staff_ids: mentionedStaffIds,
        inquiry_subject: selectedInquiry.subject,
      }),
    });
    setNoteSaving(false);
    replaceInquiry({ ...selectedInquiry, internal_note: internalNote });
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
      {/* モバイルナビバー */}
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
        {mobilePanel === "list" ? (
          <button
            className="flex items-center gap-1 text-sm font-medium text-zinc-600"
            onClick={() => setMobilePanel("sidebar")}
            type="button"
          >
            <Menu className="size-4" />
            フィルター
          </button>
        ) : (
          <button
            className="flex items-center gap-1 text-sm font-medium text-zinc-600"
            onClick={() =>
              setMobilePanel(mobilePanel === "sidebar" ? "list" : "list")
            }
            type="button"
          >
            <ChevronLeft className="size-4" />
            戻る
          </button>
        )}
        <span className="text-sm font-semibold">
          {mobilePanel === "sidebar"
            ? "フィルター"
            : mobilePanel === "list"
              ? "反響一覧"
              : selectedInquiry?.subject ?? "詳細"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-[260px_minmax(360px,480px)_minmax(460px,1fr)]">
        <aside className={cn("overflow-y-auto border-r border-zinc-200 bg-white", mobilePanel !== "sidebar" && "hidden md:block")}>
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
            {currentStaffId ? (
              <FilterSection title="担当者フィルター">
                <FilterButton
                  active={initialAssignee === "all"}
                  onClick={() => updateQuery({ assignee: "all", id: null })}
                >
                  全員
                </FilterButton>
                <FilterButton
                  active={initialAssignee === "mine"}
                  onClick={() => updateQuery({ assignee: "mine", id: null })}
                >
                  自分の担当のみ
                </FilterButton>
              </FilterSection>
            ) : null}
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

        <section className={cn("overflow-y-auto border-r border-zinc-200 bg-zinc-50", mobilePanel !== "list" && "hidden md:block")}>
          <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 px-5 py-4 backdrop-blur">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  反響一覧
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  全{totalCount}件中 {(page - 1) * 50 + 1}〜
                  {Math.min(page * 50, totalCount)}件
                </p>
              </div>
              <Badge variant="outline" className="rounded-md bg-white">
                Live
              </Badge>
            </div>
            <div className="mt-3">
              <input
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="件名・顧客名・電話・メールで検索"
                type="search"
                value={searchQuery}
              />
            </div>
          </div>
          <div className="space-y-3 p-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "group relative rounded-lg border bg-white shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50",
                  item.id === selectedInquiry?.id
                    ? "border-zinc-950 ring-2 ring-zinc-950/10"
                    : "border-zinc-200",
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={(e) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    });
                  }}
                  className="absolute left-3 top-4 size-3.5 cursor-pointer accent-zinc-950 opacity-0 group-hover:opacity-100 data-[checked]:opacity-100"
                  data-checked={selectedIds.has(item.id) ? "" : undefined}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className="w-full p-4 text-left"
                  onClick={() => {
                    setSelectedId(item.id);
                    setMobilePanel("detail");
                    updateQuery({ id: item.id });
                    setReadIds((prev) => new Set([...prev, item.id]));
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative shrink-0">
                        <ChannelBadge channel={item.channel} />
                        {!readIds.has(item.id) ? (
                          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-blue-500" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className={cn("truncate text-sm", readIds.has(item.id) ? "font-medium" : "font-semibold")}>
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
              </div>
            ))}
            {filteredItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
                {searchQuery ? `"${searchQuery}" に一致する反響はありません。` : "条件に一致する反響はありません。"}
              </div>
            ) : null}
            {(page > 1 || hasMore) ? (
              <div className="flex items-center justify-between pt-1">
                <Button
                  className="h-8 px-3 text-xs"
                  disabled={page <= 1}
                  onClick={() => updateQuery({ page: String(page - 1), id: null })}
                  size="sm"
                  variant="outline"
                >
                  前へ
                </Button>
                <span className="text-xs text-zinc-500">{page}ページ</span>
                <Button
                  className="h-8 px-3 text-xs"
                  disabled={!hasMore}
                  onClick={() => updateQuery({ page: String(page + 1), id: null })}
                  size="sm"
                  variant="outline"
                >
                  次へ
                </Button>
              </div>
            ) : null}
          </div>
          {/* 一括操作バー */}
          {selectedIds.size > 0 ? (
            <div className="sticky bottom-0 border-t border-zinc-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-600">
                  {selectedIds.size} 件選択中
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Select
                    value=""
                    onValueChange={(value) =>
                      handleBulkUpdate({ status: value as InquiryStatus })
                    }
                  >
                    <SelectTrigger className="h-7 w-32 bg-white text-xs">
                      <SelectValue placeholder="ステータス変更" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusFilters
                        .filter((f) => f.value !== "all")
                        .map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value=""
                    onValueChange={(value) =>
                      handleBulkUpdate({ assigned_to: value === "unassigned" ? null : value })
                    }
                  >
                    <SelectTrigger className="h-7 w-32 bg-white text-xs">
                      <SelectValue placeholder="担当者変更" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">未アサイン</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="h-7 px-2 text-xs"
                    disabled={bulkApplying}
                    onClick={() => setSelectedIds(new Set())}
                    size="sm"
                    variant="ghost"
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className={cn("flex min-w-0 flex-col bg-white", mobilePanel !== "detail" && "hidden md:flex")}>
          {selectedInquiry ? (
            <>
              <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
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

              {relatedInquiries.length > 0 ? (
                <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                    このリードは他に {relatedInquiries.length} 件の反響があります
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {relatedInquiries.map((r) => (
                      <button
                        key={r.id}
                        className="flex items-center gap-1.5 text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900"
                        onClick={() => {
                          setSelectedId(r.id);
                          updateQuery({ id: r.id });
                        }}
                        type="button"
                      >
                        <ChannelBadge channel={r.channel} />
                        {r.subject ?? "件名なし"}
                        <StatusBadge status={r.status} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {duplicateLeads.length > 0 ? (
                <div className="border-b border-red-200 bg-red-50 px-6 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-800">
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                    同一電話/メールの別リードが {duplicateLeads.length} 件あります（重複の可能性）
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {duplicateLeads.map((d) => (
                      <span key={d.id} className="text-xs text-red-700">
                        {d.display_name ?? "名前なし"} ({d.first_channel ?? "—"}) {d.phone ?? ""}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

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
                          {message.direction === "outbound" && message.sent_by
                            ? `${staff.find((s) => s.id === message.sent_by)?.name ?? "スタッフ"} · `
                            : ""}
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
                    <div className="relative">
                      <Textarea
                        className="min-h-24 resize-none bg-white"
                        onChange={(event) => setReplyBody(event.target.value)}
                        placeholder="返信メッセージを入力"
                        value={replyBody}
                      />
                      {/* テンプレート選択ドロップダウン */}
                      {showTemplates && templates.length > 0 ? (
                        <div className="absolute bottom-full z-20 mb-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-md">
                          {templates.map((t) => (
                            <button
                              key={t.id}
                              className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                              onMouseDown={() => {
                                setReplyBody(t.body);
                                setShowTemplates(false);
                              }}
                              type="button"
                            >
                              <p className="text-xs font-semibold text-zinc-800">{t.name}</p>
                              <p className="mt-0.5 truncate text-xs text-zinc-500">{t.body}</p>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {templates.length > 0 ? (
                          <Button
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => setShowTemplates((v) => !v)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <FileText className="size-3" />
                            テンプレート
                          </Button>
                        ) : null}
                        {selectedInquiry.ai_suggested_reply ? (
                          <Badge
                            variant="outline"
                            className="rounded-md border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
                          >
                            AI提案
                          </Badge>
                        ) : null}
                      </div>
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
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedInquiry.inquiry_tags ?? []).map((tag) => (
                          <Badge
                            key={tag.tag}
                            variant="outline"
                            className="rounded-md bg-white pr-1 text-xs"
                          >
                            {tag.tag}
                            <button
                              className="ml-1 rounded hover:text-red-500"
                              onClick={() => handleRemoveTag(tag.tag)}
                              type="button"
                            >
                              <X className="size-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="relative">
                        <input
                          ref={tagInputRef}
                          className="h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300"
                          onBlur={() =>
                            setTimeout(() => setShowTagSuggestions(false), 150)
                          }
                          onChange={(e) => {
                            setTagInput(e.target.value);
                            setShowTagSuggestions(true);
                          }}
                          onFocus={() => setShowTagSuggestions(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && tagInput.trim()) {
                              e.preventDefault();
                              void handleAddTag(tagInput);
                            }
                          }}
                          placeholder="タグを追加（Enter で確定）"
                          value={tagInput}
                        />
                        {showTagSuggestions && tagSuggestions.length > 0 ? (
                          <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-md">
                            {tagSuggestions.map((t) => (
                              <button
                                key={t}
                                className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50"
                                onMouseDown={() => handleAddTag(t)}
                                type="button"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                        内部メモ（顧客には非表示）
                      </label>
                      <div className="relative">
                        <Textarea
                          ref={noteRef}
                          className="min-h-20 resize-none border-amber-200 bg-amber-50 placeholder:text-amber-400 focus-visible:ring-amber-300"
                          onBlur={() =>
                            setTimeout(() => setMentionQuery(null), 150)
                          }
                          onChange={handleNoteChange}
                          placeholder="スタッフ向けメモ（@名前でメンション）"
                          value={internalNote}
                        />
                        {mentionSuggestions.length > 0 ? (
                          <div className="absolute bottom-full z-20 mb-1 max-h-36 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-md">
                            {mentionSuggestions.map((s) => (
                              <button
                                key={s.id}
                                className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50"
                                onMouseDown={() => handleInsertMention(s)}
                                type="button"
                              >
                                @{s.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          className="h-7 px-3 text-xs"
                          disabled={
                            noteSaving ||
                            internalNote ===
                              (selectedInquiry.internal_note ?? "")
                          }
                          onClick={handleSaveNote}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {noteSaving ? "保存中..." : "保存"}
                        </Button>
                      </div>
                    </div>
                    {/* リマインダー */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                          <Bell className="size-3.5" aria-hidden="true" />
                          リマインダー
                        </div>
                        <button
                          className="text-xs text-zinc-500 hover:text-zinc-900"
                          onClick={() => setShowReminderForm((v) => !v)}
                          type="button"
                        >
                          {showReminderForm ? "キャンセル" : "+ 追加"}
                        </button>
                      </div>
                      {showReminderForm ? (
                        <div className="space-y-1.5 rounded-md border border-zinc-200 p-2">
                          <input
                            className="h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-300"
                            min={new Date().toISOString().slice(0, 16)}
                            onChange={(e) => setReminderDate(e.target.value)}
                            type="datetime-local"
                            value={reminderDate}
                          />
                          <input
                            className="h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300"
                            onChange={(e) => setReminderNote(e.target.value)}
                            placeholder="メモ（任意）"
                            value={reminderNote}
                          />
                          <Button
                            className="h-6 w-full text-xs"
                            disabled={!reminderDate}
                            onClick={handleSaveReminder}
                            size="sm"
                            type="button"
                          >
                            設定
                          </Button>
                        </div>
                      ) : null}
                      {reminders.filter((r) => !r.is_done).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-start justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5"
                        >
                          <div>
                            <p className="text-xs font-medium text-zinc-700">
                              {formatDateTime(r.remind_at)}
                            </p>
                            {r.note ? (
                              <p className="text-xs text-zinc-500">{r.note}</p>
                            ) : null}
                          </div>
                          <button
                            className="text-zinc-400 hover:text-red-500"
                            onClick={() => handleDeleteReminder(r.id)}
                            type="button"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
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

      <AiChatWidget inquiry={selectedInquiry} messages={messages} />

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
    <section className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
      <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
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
