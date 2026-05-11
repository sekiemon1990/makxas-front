"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Image as ImageIcon,
  Keyboard,
  Mail,
  Menu,
  MessageCircle,
  Send,
  Sparkles,
  Tag,
  X,
} from "lucide-react";

import { ChannelBadge, StatusBadge } from "@/components/badges";
import { AiSuggestPanel } from "@/components/inbox/AiSuggestPanel";
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

// ショートカットキー一覧（⑥ UI表示用）
const SHORTCUTS = [
  { key: "j", desc: "次の反響に移動" },
  { key: "k", desc: "前の反響に移動" },
  { key: "r", desc: "返信欄にフォーカス" },
  { key: "Esc", desc: "返信欄からフォーカス解除" },
  { key: "?", desc: "このヘルプを表示" },
];

// テンプレート変数置換（⑤）
function applyTemplateVars(
  body: string,
  inquiry: InquiryWithLead | null,
  currentStaff: Staff | null,
) {
  if (!inquiry) return body;
  const customerName =
    inquiry.leads?.display_name ??
    inquiry.leads?.email ??
    inquiry.leads?.phone ??
    "";
  const brandName = inquiry.brands?.name ?? "";
  const storeName = inquiry.stores?.name ?? "";
  const staffName = currentStaff?.name ?? "";
  return body
    .replace(/\{\{お名前\}\}/g, customerName)
    .replace(/\{\{ブランド名\}\}/g, brandName)
    .replace(/\{\{店舗名\}\}/g, storeName)
    .replace(/\{\{担当者名\}\}/g, staffName);
}

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
  const [replySubject, setReplySubject] = useState("");
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
  const [showRelatedHistory, setShowRelatedHistory] = useState(false); // ⑧ 折りたたみ
  const [duplicateLeads, setDuplicateLeads] = useState<{ id: string; display_name: string | null; phone: string | null; first_channel: string | null }[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const [toast, setToast] = useState<{ title: string; description?: string } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false); // ⑥ ショートカットヘルプ
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  }); // ⑦
  // ⑪ 画像アップロード
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [sendingImages, setSendingImages] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // AI編集理由タグUI
  const [showEditReasonPrompt, setShowEditReasonPrompt] = useState(false);
  const [lastSentMsgId, setLastSentMsgId] = useState<string | null>(null);
  // AI返信アシスト
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiSuggest, setAiSuggest] = useState<import("@/app/api/ai/suggest/route").AiSuggestResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOriginalBody, setAiOriginalBody] = useState<string | null>(null);
  const [aiCurrentTheme, setAiCurrentTheme] = useState<string | null>(null);
  // AIパネル原案（テーマチップ/自動提案 → パネルに渡す）
  const [aiPanelDraft, setAiPanelDraft] = useState<string | null>(null);
  const [aiPanelDraftKey, setAiPanelDraftKey] = useState(0);
  const [aiPanelThemeName, setAiPanelThemeName] = useState<string | null>(null);
  // ドロワートグル
  const [noteOpen, setNoteOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  // ⑬ モバイルスワイプ
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  const currentStaff = useMemo(
    () => staff.find((s) => s.id === currentStaffId) ?? null,
    [staff, currentStaffId],
  );

  // ⑦ Service Worker登録
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  const showBrowserNotif = useCallback((title: string, body: string, url = "/inbox") => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return; // タブがアクティブな時は不要
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "makxas-inquiry",
      data: { url },
    });
  }, []);

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
          if (!matchesFilters(row)) return;
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
          const toastMsg = {
            title: "新着反響が届きました",
            description: inquiry.subject ?? "新しい問い合わせがあります。",
          };
          setToast(toastMsg);
          // ⑦ ブラウザ通知
          showBrowserNotif(toastMsg.title, toastMsg.description);
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
    return () => { supabase.removeChannel(channel); };
  }, [initialChannel, initialStatus, initialStore, showBrowserNotif]);

  // messagesテーブルのRealtime購読
  useEffect(() => {
    if (!selectedId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-realtime-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `inquiry_id=eq.${selectedId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((current) =>
            current.some((m) => m.id === msg.id) ? current : [...current, msg],
          );
          // ⑦ 顧客メッセージのブラウザ通知
          if (msg.direction === "inbound") {
            showBrowserNotif("新着メッセージ", msg.body ?? "メッセージが届きました");
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, showBrowserNotif]);

  const selectedInquiry = useMemo(() => {
    return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  }, [items, selectedId]);

  // ai_suggested_reply は返信欄には自動入力しない（パネル経由で確認）
  // （このエフェクトは削除済み）

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

  const updateQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    });
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [searchParams, pathname, router]);

  // ⑥ キーボードショートカット
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";

      if (e.key === "Escape") {
        replyRef.current?.blur();
        setShowShortcuts(false);
        return;
      }
      if (e.key === "?") {
        setShowShortcuts((v) => !v);
        return;
      }
      if (isInput) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedId((current) => {
          const idx = filteredItems.findIndex((i) => i.id === current);
          const next = filteredItems[idx + 1];
          if (next) {
            updateQuery({ id: next.id });
            return next.id;
          }
          return current;
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedId((current) => {
          const idx = filteredItems.findIndex((i) => i.id === current);
          const prev = filteredItems[idx - 1];
          if (prev) {
            updateQuery({ id: prev.id });
            return prev.id;
          }
          return current;
        });
      } else if (e.key === "r") {
        e.preventDefault();
        replyRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredItems, updateQuery]);

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
      body: JSON.stringify({ assigned_to: assignedTo === "unassigned" ? null : assignedTo }),
    });
    if (response.ok) {
      const payload = (await response.json()) as { inquiry: InquiryWithLead };
      replaceInquiry(payload.inquiry);
      router.refresh();
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInternalNote(selectedInquiry?.internal_note ?? "");
    setShowRelatedHistory(false); // ⑧ パネル切り替え時にリセット
    setShowDuplicates(false);
    setImageFiles([]); // ⑪
    // AI提案リセット
    setAiSuggest(null);
    setAiOriginalBody(null);
    setAiCurrentTheme(null);
    setAiPanelDraft(null);
    setAiPanelThemeName(null);
    setReplyBody("");

    // AI提案は自動実行しない。ユーザーが「AI下書きを生成」ボタンを押した時のみ実行する。
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    fetch(`/api/inquiries/${selectedInquiry.id}/read`, { method: "POST" }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInquiry?.id]);

  useEffect(() => {
    if (!selectedInquiry?.lead_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRelatedInquiries([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleBulkUpdate = async (update: { status?: InquiryStatus; assigned_to?: string | null }) => {
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
    const after = internalNote.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
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
        inquiry_tags: (selectedInquiry.inquiry_tags ?? []).filter((it) => it.tag !== tag),
      });
    }
  };

  const handleSaveNote = async () => {
    if (!selectedInquiry) return;
    setNoteSaving(true);
    const mentionedNames = [
      ...new Set([...internalNote.matchAll(/@([^\s@]+)/g)].map((m) => m[1])),
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

  // ④ 返信後ステータス自動変更
  const handleSendMessage = async () => {
    if (!selectedInquiry || !replyBody.trim()) return;
    const isEmailChannel = ["email", "web_form", "hikakaku", "uridoki", "oikura"].includes(
      selectedInquiry.channel ?? "",
    );
    // AIトラッキング
    const isAiSuggested = aiOriginalBody !== null;
    const isEdited = isAiSuggested && replyBody.trim() !== aiOriginalBody!.trim();
    const isThemeChanged = isAiSuggested && aiCurrentTheme !== (aiSuggest?.theme ?? null);

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inquiry_id: selectedInquiry.id,
        body: replyBody,
        ...(isEmailChannel && replySubject.trim() ? { subject: replySubject.trim() } : {}),
        // AI返信ログ
        ai_suggested: isAiSuggested,
        ai_theme: aiSuggest?.theme ?? null,
        ai_theme_changed: isThemeChanged || null,
        final_theme: aiCurrentTheme ?? null,
        ai_edited: isAiSuggested ? isEdited : null,
        ai_original_body: aiOriginalBody ?? null,
      }),
    });
    if (response.ok) {
      const payload = (await response.json()) as { message: Message };
      setMessages((current) => [...current, payload.message]);
      setReplyBody("");
      setReplySubject("");
      // AI提案を編集して送信した場合、理由タグUIを5秒表示
      if (isAiSuggested && isEdited && payload.message?.id) {
        setLastSentMsgId(payload.message.id as string);
        setShowEditReasonPrompt(true);
        setTimeout(() => setShowEditReasonPrompt(false), 10000);

      }
      // AI state をリセット（次の受信まで提案なし）
      setAiOriginalBody(null);
      setAiCurrentTheme(null);
      setAiPanelDraft(null);
      setAiPanelThemeName(null);
      setAiSuggest(null);
      // ④ 新着→対応中に自動変更
      if (selectedInquiry.status === "new") {
        const statusRes = await fetch(`/api/inquiries/${selectedInquiry.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "in_progress" }),
        });
        if (statusRes.ok) {
          const statusPayload = (await statusRes.json()) as { inquiry: InquiryWithLead };
          replaceInquiry(statusPayload.inquiry);
          setToast({ title: "ステータスを「対応中」に変更しました" });
        }
      }
      router.refresh();
    }
  };

  // ⑪ 画像一括送信
  const handleSendImages = async () => {
    if (!selectedInquiry || imageFiles.length === 0) return;
    setSendingImages(true);
    const formData = new FormData();
    formData.append("inquiry_id", selectedInquiry.id);
    for (const f of imageFiles) formData.append("images", f);
    const res = await fetch("/api/messages/image", { method: "POST", body: formData });
    if (res.ok) {
      setImageFiles([]);
      router.refresh();
      setToast({ title: `${imageFiles.length}枚の画像を送信しました` });
    } else {
      setToast({ title: "画像送信に失敗しました", description: "もう一度お試しください" });
    }
    setSendingImages(false);
  };

  // ⑪ 受信画像の一括ダウンロード
  const handleDownloadImages = () => {
    const imageMessages = messages.filter(
      (m) => m.direction === "inbound" && m.media_urls && m.media_urls.length > 0,
    );
    if (imageMessages.length === 0) {
      setToast({ title: "ダウンロードできる画像がありません" });
      return;
    }
    imageMessages.forEach((m, i) => {
      (m.media_urls ?? []).forEach((url, j) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = `image_${i + 1}_${j + 1}.jpg`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    });
    setToast({ title: `${imageMessages.length}枚の画像をダウンロードしました` });
  };

  // ⑬ モバイルスワイプでステータス変更
  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent, inquiryId: string) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - swipeStartY.current);
    swipeStartX.current = null;
    swipeStartY.current = null;
    if (Math.abs(dx) < 60 || dy > 40) return; // 横スワイプのみ
    const inquiry = items.find((i) => i.id === inquiryId);
    if (!inquiry) return;
    if (dx > 0) {
      // 右スワイプ → 対応中
      void fetch(`/api/inquiries/${inquiryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      }).then((r) => {
        if (r.ok) {
          r.json().then((p: { inquiry: InquiryWithLead }) => {
            replaceInquiry(p.inquiry);
            setToast({ title: "ステータスを「対応中」に変更しました" });
          }).catch(() => {});
        }
      });
    } else {
      // 左スワイプ → 保留
      void fetch(`/api/inquiries/${inquiryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      }).then((r) => {
        if (r.ok) {
          r.json().then((p: { inquiry: InquiryWithLead }) => {
            replaceInquiry(p.inquiry);
            setToast({ title: "ステータスを「保留」に変更しました" });
          }).catch(() => {});
        }
      });
    }
  };

  const inboundImageMessages = messages.filter(
    (m) => m.direction === "inbound" && m.media_urls && m.media_urls.length > 0,
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ⑥ キーボードショートカットヘルプモーダル */}
      {showShortcuts ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-80 rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Keyboard className="size-4" />
                キーボードショートカット
              </h3>
              <button onClick={() => setShowShortcuts(false)} type="button">
                <X className="size-4 text-zinc-400" />
              </button>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                {SHORTCUTS.map((s) => (
                  <tr key={s.key}>
                    <td className="py-2 pr-4">
                      <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">{s.key}</kbd>
                    </td>
                    <td className="py-2 text-zinc-600">{s.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

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
            onClick={() => setMobilePanel(mobilePanel === "sidebar" ? "list" : "list")}
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

      <div className="flex min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-[minmax(260px,340px)_1fr]">
        {/* 一覧カラム */}
        <section className={cn("overflow-y-auto border-r border-zinc-200 bg-zinc-50", mobilePanel !== "list" && "hidden md:block")}>
          <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 px-3 py-2.5 backdrop-blur space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900">反響一覧</h2>
                <span className="text-xs text-zinc-400">{totalCount}件</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-600 border-emerald-200">
                  <span className="mr-1 size-1.5 rounded-full bg-emerald-400 inline-block" />
                  Live
                </Badge>
                <button
                  className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
                  onClick={() => setShowShortcuts(true)}
                  title="キーボードショートカット"
                  type="button"
                >
                  <Keyboard className="size-3" />
                  <kbd className="font-mono text-[10px]">?</kbd>
                </button>
              </div>
            </div>
            <input
              className="h-8 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="件名・顧客名・電話・メールで検索"
              type="search"
              value={searchQuery}
            />
            {/* フィルターチップ */}
            <div className="flex flex-wrap gap-1.5">
              <Select value={initialStatus} onValueChange={(v) => updateQuery({ status: v, id: null })}>
                <SelectTrigger className="h-7 w-auto rounded-full border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 gap-1 [&>svg]:size-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusFilters.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={initialChannel} onValueChange={(v) => updateQuery({ channel: v, id: null })}>
                <SelectTrigger className="h-7 w-auto rounded-full border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 gap-1 [&>svg]:size-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全チャンネル</SelectItem>
                  {channelFilters.map((ch) => (
                    <SelectItem key={ch} value={ch}>{channelMeta[ch].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {stores.length > 1 || canUseAllStores ? (
                <Select value={initialStore} onValueChange={(v) => updateQuery({ store: v, id: null })}>
                  <SelectTrigger className="h-7 w-auto rounded-full border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 gap-1 [&>svg]:size-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canUseAllStores ? <SelectItem value="all">全店舗</SelectItem> : null}
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {currentStaffId ? (
                <button
                  className={cn(
                    "h-7 rounded-full border px-3 text-xs font-medium transition",
                    initialAssignee === "mine"
                      ? "border-violet-400 bg-violet-50 text-violet-700"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-300 hover:text-violet-600",
                  )}
                  onClick={() => updateQuery({ assignee: initialAssignee === "mine" ? "all" : "mine", id: null })}
                  type="button"
                >
                  {initialAssignee === "mine" ? "自分のみ ✓" : "自分のみ"}
                </button>
              ) : null}
              {notifPermission !== "granted" && notifPermission !== "denied" ? (
                <button
                  className="h-7 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-50 flex items-center gap-1"
                  onClick={requestNotifPermission}
                  type="button"
                >
                  <Bell className="size-3" />
                  通知ON
                </button>
              ) : notifPermission === "granted" ? (
                <span className="h-7 flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs text-emerald-600">
                  <Bell className="size-3" />通知ON
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-zinc-400 md:hidden">
              ← スワイプで保留 ／ スワイプで対応中 →
            </p>
          </div>
          <div className="space-y-2 p-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "group flex rounded-lg border shadow-sm transition",
                  item.id === selectedInquiry?.id
                    ? "border-violet-300 bg-white ring-2 ring-violet-100"
                    : getStaleLevel(item) === "urgent"
                      ? "border-red-200 bg-red-50 hover:border-red-300"
                      : getStaleLevel(item) === "warning"
                        ? "border-orange-200 bg-orange-50 hover:border-orange-300"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                )}
                onTouchEnd={(e) => handleTouchEnd(e, item.id)}
                onTouchStart={handleTouchStart}
              >
                {/* ── チェックボックス列（チャンネルバッジと重ならない専用スペース） ── */}
                <label className="flex w-8 shrink-0 cursor-pointer items-start justify-center pt-[14px]">
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
                    className={cn(
                      "size-3.5 cursor-pointer rounded accent-violet-600 transition-opacity",
                      selectedIds.has(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                    )}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                {/* ── カード本体 ── */}
                <button
                  className="min-w-0 flex-1 py-3 pr-4 text-left"
                  onClick={() => {
                    setSelectedId(item.id);
                    setMobilePanel("detail");
                    updateQuery({ id: item.id });
                    setReadIds((prev) => new Set([...prev, item.id]));
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="relative shrink-0">
                        <ChannelBadge channel={item.channel} />
                        {!readIds.has(item.id) ? (
                          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-blue-500" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className={cn("truncate text-sm", readIds.has(item.id) ? "font-medium text-zinc-700" : "font-semibold text-zinc-900")}>
                          {getCustomerName(item)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {item.subject ?? "件名なし"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <span>{formatElapsed(item.created_at)}</span>
                      {getStaleLevel(item) !== "none" ? (
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 font-semibold",
                          getStaleLevel(item) === "urgent"
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700",
                        )}>
                          ⚠ {getStaleHours(item)}h
                        </span>
                      ) : null}
                    </div>
                    <span className="flex items-center gap-1 truncate">
                      {(item.brands?.name ?? item.stores?.name) ? (
                        <span className="truncate">{item.brands?.name ?? item.stores?.name}</span>
                      ) : null}
                      {item.staff?.name ? (
                        <>
                          {(item.brands?.name ?? item.stores?.name) ? <span className="text-zinc-200">·</span> : null}
                          <span className="truncate">{item.staff.name}</span>
                        </>
                      ) : null}
                      {item.lead_id ? (
                        <a
                          href={`/leads/${item.lead_id}`}
                          className="ml-auto text-[10px] text-zinc-400 hover:text-violet-600 transition-colors shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          リード→
                        </a>
                      ) : null}
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
                <Button className="h-8 px-3 text-xs" disabled={page <= 1} onClick={() => updateQuery({ page: String(page - 1), id: null })} size="sm" variant="outline">前へ</Button>
                <span className="text-xs text-zinc-500">{page}ページ</span>
                <Button className="h-8 px-3 text-xs" disabled={!hasMore} onClick={() => updateQuery({ page: String(page + 1), id: null })} size="sm" variant="outline">次へ</Button>
              </div>
            ) : null}
          </div>
          {/* 一括操作バー */}
          {selectedIds.size > 0 ? (
            <div className="sticky bottom-0 border-t border-zinc-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-600">{selectedIds.size} 件選択中</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Select value="" onValueChange={(value) => handleBulkUpdate({ status: value as InquiryStatus })}>
                    <SelectTrigger className="h-7 w-32 bg-white text-xs"><SelectValue placeholder="ステータス変更" /></SelectTrigger>
                    <SelectContent>
                      {statusFilters.filter((f) => f.value !== "all").map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value="" onValueChange={(value) => handleBulkUpdate({ assigned_to: value === "unassigned" ? null : value })}>
                    <SelectTrigger className="h-7 w-32 bg-white text-xs"><SelectValue placeholder="担当者変更" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">未アサイン</SelectItem>
                      {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button className="h-7 px-2 text-xs" disabled={bulkApplying} onClick={() => setSelectedIds(new Set())} size="sm" variant="ghost">キャンセル</Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* 詳細パネル */}
        <section className={cn("relative flex min-w-0 flex-col bg-white overflow-hidden", mobilePanel !== "detail" && "hidden md:flex")}>
          {selectedInquiry ? (
            <>
              <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ChannelBadge channel={selectedInquiry.channel} showLabel />
                    {selectedInquiry.lead_id ? (
                      <a
                        href={`/leads/${selectedInquiry.lead_id}`}
                        className="text-xs font-medium text-zinc-700 hover:text-violet-600 hover:underline transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {getCustomerName(selectedInquiry)}
                      </a>
                    ) : (
                      <span className="text-xs font-medium text-zinc-700">{getCustomerName(selectedInquiry)}</span>
                    )}
                      {(selectedInquiry.brands?.name ?? selectedInquiry.stores?.name) ? (
                        <span className="text-xs text-zinc-400">{selectedInquiry.brands?.name ?? selectedInquiry.stores?.name}</span>
                      ) : null}
                      <span className="text-xs text-zinc-400">{formatDateTime(selectedInquiry.created_at)}</span>
                    </div>
                    <h2 className="mt-0.5 truncate text-sm font-bold tracking-tight text-zinc-900">
                      {selectedInquiry.subject ?? "件名なし"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select value={selectedInquiry.status} onValueChange={(value) => handleStatusChange(value as InquiryStatus)}>
                      <SelectTrigger className="h-8 w-28 bg-white text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusFilters.filter((filter) => filter.value !== "all").map((filter) => (
                          <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedInquiry.assigned_to ?? "unassigned"} onValueChange={handleAssignChange}>
                      <SelectTrigger className="h-8 w-24 bg-white text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">未アサイン</SelectItem>
                        {staff.map((member) => (
                          <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="shrink-0 h-8" onClick={() => setAppointmentOpen(true)}>
                      <CalendarPlus className="size-3.5" aria-hidden="true" />
                      アポ設定
                    </Button>
                  </div>
                </div>
              </div>

              {/* ⑧ リード過去問い合わせ履歴（折りたたみ） */}
              {relatedInquiries.length > 0 ? (
                <div className="border-b border-amber-200 bg-amber-50">
                  <button
                    className="flex w-full items-center gap-2 px-6 py-3 text-left"
                    onClick={() => setShowRelatedHistory((v) => !v)}
                    type="button"
                  >
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <span className="flex-1 text-xs font-semibold text-amber-800">
                      このリードは他に {relatedInquiries.length} 件の問い合わせ履歴があります
                    </span>
                    {showRelatedHistory
                      ? <ChevronLeft className="size-3.5 rotate-90 text-amber-600" />
                      : <ChevronRight className="size-3.5 -rotate-90 text-amber-600" />}
                  </button>
                  {showRelatedHistory ? (
                    <div className="border-t border-amber-100 px-6 pb-3">
                      <div className="divide-y divide-amber-100">
                        {relatedInquiries.map((r) => (
                          <button
                            key={r.id}
                            className="flex w-full items-center gap-3 py-2 text-left text-xs hover:bg-amber-100/50"
                            onClick={() => {
                              setSelectedId(r.id);
                              updateQuery({ id: r.id });
                              setShowRelatedHistory(false);
                            }}
                            type="button"
                          >
                            <ChannelBadge channel={r.channel} />
                            <span className="flex-1 truncate text-amber-900">{r.subject ?? "件名なし"}</span>
                            <StatusBadge status={r.status} />
                            <span className="shrink-0 text-amber-600">{r.stores?.name ?? "店舗未設定"}</span>
                            <span className="shrink-0 text-amber-500">{formatDateTime(r.created_at)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {duplicateLeads.length > 0 ? (
                <div className="border-b border-red-200 bg-red-50">
                  <button
                    className="flex w-full items-center gap-2 px-5 py-2.5 text-left"
                    onClick={() => setShowDuplicates((v) => !v)}
                    type="button"
                  >
                    <AlertTriangle className="size-3.5 shrink-0 text-red-500" aria-hidden="true" />
                    <span className="flex-1 text-xs font-semibold text-red-800">
                      同一電話/メールの別リードが {duplicateLeads.length} 件（重複の可能性）
                    </span>
                    {showDuplicates
                      ? <ChevronLeft className="size-3.5 rotate-90 text-red-400" />
                      : <ChevronRight className="size-3.5 -rotate-90 text-red-400" />}
                  </button>
                  {showDuplicates ? (
                    <div className="border-t border-red-100 px-5 pb-2.5">
                      {duplicateLeads.map((d) => (
                        <p key={d.id} className="py-1 text-xs text-red-700">
                          {d.display_name ?? "名前なし"} ({d.first_channel ?? "—"}) {d.phone ?? ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* メッセージスレッド */}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-3">
                  {messages.map((message) => {
                    const isOut = message.direction === "outbound";
                    const senderName = isOut
                      ? (staff.find((s) => s.id === message.sent_by)?.name ?? "スタッフ")
                      : getCustomerName(selectedInquiry);
                    const initial = senderName.charAt(0);
                    return (
                      <div
                        key={message.id}
                        className={cn("flex items-end gap-2", isOut ? "flex-row-reverse" : "flex-row")}
                      >
                        {/* アバター（受信のみ） */}
                        {!isOut ? (
                          <div className="size-7 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center text-[11px] font-bold text-emerald-700 self-end mb-5">
                            {initial}
                          </div>
                        ) : null}
                        <div className={cn("flex max-w-[76%] flex-col", isOut ? "items-end" : "items-start")}>
                          {/* 送信者名（送信のみ） */}
                          {isOut ? (
                            <p className="mb-1 pr-1 text-[10px] text-zinc-400">{senderName}</p>
                          ) : null}
                          {/* バブル本体 */}
                          <div
                            className={cn(
                              "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                              isOut
                                ? "rounded-br-sm bg-zinc-900 text-white shadow-sm"
                                : "rounded-bl-sm bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-100",
                            )}
                          >
                            {/* ⑪ 受信画像表示 */}
                            {message.media_urls && message.media_urls.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {message.media_urls.map((url, i) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={url}
                                      alt={`画像 ${i + 1}`}
                                      className="max-h-48 max-w-full rounded-lg object-contain"
                                    />
                                  </a>
                                ))}
                              </div>
                            ) : null}
                            {message.body ? (
                              <p className="whitespace-pre-wrap">{message.body}</p>
                            ) : null}
                          </div>
                          {/* タイムスタンプ（バブル外） */}
                          <p className={cn("mt-1 text-[10px] text-zinc-400", isOut ? "pr-1" : "pl-1")}>
                            {formatDateTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-400">
                      この反響のメッセージはまだありません。
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 返信・操作エリア */}
              <div className="border-t border-zinc-200 bg-zinc-50/80 px-4 py-3 space-y-2.5">
                {/* タグ + 内部メモ・リマインダートグルバー */}
                <div className="flex items-center gap-2 flex-wrap border-b border-zinc-100 pb-2">
                  <Tag className="size-3 text-zinc-400 shrink-0" aria-hidden="true" />
                  <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                    {(selectedInquiry.inquiry_tags ?? []).map((tag) => (
                      <Badge key={tag.tag} variant="outline" className="rounded-md bg-white pr-1 text-xs">
                        {tag.tag}
                        <button className="ml-1 rounded hover:text-red-500" onClick={() => handleRemoveTag(tag.tag)} type="button">
                          <X className="size-2.5" />
                        </button>
                      </Badge>
                    ))}
                    <div className="relative">
                      <input
                        ref={tagInputRef}
                        className="h-6 w-28 rounded-md border border-dashed border-zinc-300 bg-transparent px-2 text-xs placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400"
                        onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                        onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                        onFocus={() => setShowTagSuggestions(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && tagInput.trim()) {
                            e.preventDefault();
                            void handleAddTag(tagInput);
                          }
                        }}
                        placeholder="+ タグ追加"
                        value={tagInput}
                      />
                      {showTagSuggestions && tagSuggestions.length > 0 ? (
                        <div className="absolute z-20 mt-1 max-h-40 w-48 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-md">
                          {tagSuggestions.map((t) => (
                            <button key={t} className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50" onMouseDown={() => handleAddTag(t)} type="button">{t}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    <button
                      className={cn(
                        "h-6 rounded border px-2 text-[11px] font-medium transition flex items-center gap-1",
                        noteOpen
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : "border-zinc-200 bg-white text-zinc-500 hover:border-amber-300 hover:text-amber-600",
                      )}
                      onClick={() => setNoteOpen(v => !v)}
                      type="button"
                    >
                      内部メモ
                    </button>
                    <button
                      className={cn(
                        "h-6 rounded border px-2 text-[11px] font-medium transition flex items-center gap-1",
                        reminderOpen
                          ? "border-blue-400 bg-blue-50 text-blue-700"
                          : "border-zinc-200 bg-white text-zinc-500 hover:border-blue-300 hover:text-blue-600",
                      )}
                      onClick={() => setReminderOpen(v => !v)}
                      type="button"
                    >
                      <Bell className="size-3" />
                      リマインダー
                    </button>
                  </div>
                </div>

                {/* 内部メモ（折りたたみ） */}
                {noteOpen ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                      内部メモ（顧客には非表示）
                    </label>
                    <div className="relative">
                      <Textarea
                        ref={noteRef}
                        className="min-h-16 resize-none border-amber-200 bg-amber-50 placeholder:text-amber-400 focus-visible:ring-amber-300"
                        onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
                        onChange={handleNoteChange}
                        placeholder="スタッフ向けメモ（@名前でメンション）"
                        value={internalNote}
                      />
                      {mentionSuggestions.length > 0 ? (
                        <div className="absolute bottom-full z-20 mb-1 max-h-36 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-md">
                          {mentionSuggestions.map((s) => (
                            <button key={s.id} className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50" onMouseDown={() => handleInsertMention(s)} type="button">
                              @{s.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="h-7 px-3 text-xs"
                        disabled={noteSaving || internalNote === (selectedInquiry.internal_note ?? "")}
                        onClick={handleSaveNote}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {noteSaving ? "保存中..." : "保存"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {/* リマインダー（折りたたみ） */}
                {reminderOpen ? (
                  <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                        <Bell className="size-3.5" aria-hidden="true" />
                        リマインダー
                      </div>
                      <button className="text-xs text-zinc-500 hover:text-zinc-900" onClick={() => setShowReminderForm((v) => !v)} type="button">
                        {showReminderForm ? "キャンセル" : "+ 追加"}
                      </button>
                    </div>
                    {showReminderForm ? (
                      <div className="space-y-1.5">
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
                        <Button className="h-6 w-full text-xs" disabled={!reminderDate} onClick={handleSaveReminder} size="sm" type="button">設定</Button>
                      </div>
                    ) : null}
                    {reminders.filter((r) => !r.is_done).map((r) => (
                      <div key={r.id} className="flex items-start justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5">
                        <div>
                          <p className="text-xs font-medium text-zinc-700">{formatDateTime(r.remind_at)}</p>
                          {r.note ? <p className="text-xs text-zinc-500">{r.note}</p> : null}
                        </div>
                        <button className="text-zinc-400 hover:text-red-500" onClick={() => handleDeleteReminder(r.id)} type="button">
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* AIエリア（ボタン押下後のみ表示） */}
                {aiLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs text-violet-500">
                    <svg className="size-3 animate-spin text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>AIが分析中...</span>
                  </div>
                ) : aiSuggest && (aiSuggest.mode === "themes" || aiSuggest.mode === "auto") ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-violet-500 font-medium">
                      <Sparkles className="size-3 shrink-0" />
                      パターンを選択してください
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[...aiSuggest.themes].sort((a, b) => b.confidence - a.confidence).map((t, i) => {
                        const isTop = i === 0;
                        const isSelected = aiCurrentTheme === t.key;
                        return (
                          <button
                            key={t.key}
                            className={cn(
                              "rounded-full border font-medium transition",
                              isSelected
                                ? "border-violet-500 bg-violet-500 text-white px-3 py-1 text-xs"
                                : isTop
                                  ? "border-violet-300 bg-violet-50 text-violet-700 px-3 py-1 text-xs hover:bg-violet-100"
                                  : "border-zinc-200 bg-white text-zinc-600 px-2.5 py-0.5 text-[11px] hover:border-violet-200 hover:text-violet-600",
                            )}
                            onClick={async () => {
                              if (isSelected) {
                                setAiCurrentTheme(null);
                                return;
                              }
                              setAiCurrentTheme(t.key);
                              setAiPanelDraft(null);
                              setAiPanelDraftKey(k => k + 1);
                              setAiPanelOpen(false);
                              setAiLoading(true);
                              try {
                                const res = await fetch("/api/ai/suggest", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ inquiry_id: selectedInquiry.id, theme: t.key }),
                                });
                                const data = await res.json() as import("@/app/api/ai/suggest/route").AiSuggestResult;
                                if (data.body) {
                                  setAiPanelDraft(data.body);
                                  setAiPanelThemeName(t.label);
                                  setAiPanelDraftKey(k => k + 1);
                                  setAiPanelOpen(true);
                                }
                              } catch {
                                // 失敗は無視
                              } finally {
                                setAiLoading(false);
                              }
                            }}
                            type="button"
                          >
                            {t.label}
                            {isTop ? <span className="ml-1 text-[9px] opacity-70">★</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* 送信待ち画像プレビュー */}
                {imageFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 rounded-md border border-zinc-200 bg-white p-2">
                    {imageFiles.map((f, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(f)}
                          alt={f.name}
                          className="size-14 rounded object-cover"
                        />
                        <button
                          className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-white"
                          onClick={() => setImageFiles((prev) => prev.filter((_, j) => j !== i))}
                          type="button"
                        >
                          <X className="size-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* テンプレート選択ドロップダウン */}
                {showTemplates ? (
                  <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-sm">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
                        onClick={() => { setReplyBody(t.body); setShowTemplates(false); }}
                        type="button"
                      >
                        <span className="font-medium text-zinc-700">{t.name}</span>
                        <span className="ml-2 text-zinc-400 truncate">{t.body.slice(0, 40)}...</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* 返信テキストエリア（全幅） */}
                <Textarea
                  ref={replyRef}
                  className="min-h-[80px] resize-none bg-white text-sm"
                  onChange={(e) => {
                    setReplyBody(e.target.value);
                    setAiOriginalBody(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="返信メッセージを入力（r キーでフォーカス）"
                  value={replyBody}
                />
                {aiOriginalBody && replyBody !== aiOriginalBody ? (
                  <p className="text-[10px] text-zinc-400">
                    ✏️ AI原案から編集中
                    <button className="ml-1.5 text-violet-500 underline hover:text-violet-700" onClick={() => setReplyBody(aiOriginalBody)} type="button">元に戻す</button>
                  </p>
                ) : null}

                {/* ボタン行 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    className={cn(
                      "h-8 gap-1 px-2.5 text-xs",
                      aiSuggest ? "border-violet-400 bg-violet-50 text-violet-700" : "border-violet-300 text-violet-600 hover:bg-violet-50",
                    )}
                    disabled={aiLoading}
                    onClick={async () => {
                      if (aiSuggest) { setAiSuggest(null); setAiCurrentTheme(null); return; }
                      setAiLoading(true);
                      try {
                        const res = await fetch("/api/ai/suggest", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ inquiry_id: selectedInquiry.id }),
                        });
                        const data = await res.json() as import("@/app/api/ai/suggest/route").AiSuggestResult;
                        setAiSuggest(data);
                      } catch {
                        // 失敗は無視
                      } finally {
                        setAiLoading(false);
                      }
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Sparkles className="size-3.5" />
                    {aiLoading ? "分析中..." : aiSuggest ? "AI生成済み ✕" : "AI下書き"}
                  </Button>
                  <Button
                    className={cn(
                      "h-8 gap-1 px-2.5 text-xs",
                      aiPanelOpen ? "border-violet-400 text-violet-700 bg-violet-50" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50",
                    )}
                    onClick={() => setAiPanelOpen((v) => !v)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <MessageCircle className="size-3.5" />
                    {aiPanelOpen ? "相談中…" : "AIに質問"}
                  </Button>
                  {templates.length > 0 ? (
                    <Button className="h-8 gap-1 px-2.5 text-xs" onClick={() => setShowTemplates((v) => !v)} size="sm" type="button" variant="outline">
                      <FileText className="size-3.5" />
                      テンプレート
                    </Button>
                  ) : null}
                  {selectedInquiry.channel === "line" ? (
                    <>
                      <Button className="h-8 gap-1 px-2.5 text-xs" onClick={() => imageInputRef.current?.click()} size="sm" type="button" variant="outline">
                        <ImageIcon className="size-3.5" />
                        画像
                      </Button>
                      <input
                        ref={imageInputRef}
                        accept="image/*"
                        className="hidden"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          setImageFiles((prev) => [...prev, ...files]);
                          e.target.value = "";
                        }}
                        type="file"
                      />
                    </>
                  ) : null}
                  {inboundImageMessages.length > 0 ? (
                    <Button className="h-8 gap-1 px-2.5 text-xs" onClick={handleDownloadImages} size="sm" type="button" variant="outline" title={`受信画像 ${inboundImageMessages.length} 枚を一括ダウンロード`}>
                      <Download className="size-3.5" />
                      ({inboundImageMessages.length})
                    </Button>
                  ) : null}
                  {selectedInquiry.ai_suggested_reply ? (
                    <Button
                      className="h-8 gap-1 border-violet-300 bg-violet-50 px-2.5 text-xs text-violet-700 hover:bg-violet-100"
                      onClick={() => {
                        setAiPanelDraft(selectedInquiry.ai_suggested_reply!);
                        setAiPanelThemeName(null);
                        setAiPanelDraftKey(k => k + 1);
                        setAiPanelOpen(true);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      ✦ AI原案を確認
                    </Button>
                  ) : null}
                  <div className="flex-1" />
                  {imageFiles.length > 0 ? (
                    <Button className="h-8 gap-1 text-xs" disabled={sendingImages} onClick={handleSendImages} size="sm" type="button" variant="outline">
                      <ImageIcon className="size-3.5" aria-hidden="true" />
                      {sendingImages ? "送信中..." : `画像送信 (${imageFiles.length}枚)`}
                    </Button>
                  ) : null}
                  <Button className="h-8 gap-1.5 px-4 text-sm" onClick={handleSendMessage} size="sm" type="button" disabled={!replyBody.trim()}>
                    {["email", "web_form", "hikakaku", "uridoki", "oikura"].includes(selectedInquiry.channel ?? "") ? (
                      <Mail className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Send className="size-3.5" aria-hidden="true" />
                    )}
                    送信
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
              反響を選択してください。
            </div>
          )}
          {/* AIスライドインパネル（反響スコープ） */}
          <AiSuggestPanel
            open={aiPanelOpen}
            onClose={() => setAiPanelOpen(false)}
            inquiry={selectedInquiry}
            messages={messages}
            onTranscribe={(text) => { setReplyBody(text); setAiOriginalBody(text); setAiPanelOpen(false); }}
            initialDraft={aiPanelDraft}
            initialDraftKey={aiPanelDraftKey}
            initialThemeName={aiPanelThemeName}
          />
        </section>
      </div>

      <AppointmentModal
        inquiry={selectedInquiry}
        onOpenChange={setAppointmentOpen}
        onSaved={(inquiry) => { replaceInquiry(inquiry); router.refresh(); }}
        open={appointmentOpen}
      />

      {toast ? (
        <Toast description={toast.description} onClose={() => setToast(null)} title={toast.title} />
      ) : null}
    </div>
  );
}

function FilterSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section>
      <h2 className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{title}</h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900",
        active && "bg-violet-100 font-semibold text-violet-700 hover:bg-violet-100 hover:text-violet-700",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function getCustomerName(inquiry: InquiryWithLead) {
  return inquiry.leads?.display_name ?? inquiry.leads?.email ?? inquiry.leads?.phone ?? "未登録リード";
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

/** 未返信経過時間を時間単位で返す（updated_at ベース） */
function getStaleHours(item: { status: string; updated_at: string }): number {
  return Math.floor((Date.now() - new Date(item.updated_at).getTime()) / 3600000);
}

/**
 * 未返信の深刻度を返す
 * - 'none'    : 問題なし
 * - 'warning' : 新着 or 対応中 で更新から 1〜3h
 * - 'urgent'  : 新着 or 対応中 で更新から 3h 超
 */
function getStaleLevel(item: { status: string; updated_at: string }): "none" | "warning" | "urgent" {
  if (item.status === "pending" || item.status === "appointment_set" ||
      item.status === "transferred" || item.status === "lost" || item.status === "closed") {
    return "none";
  }
  const hours = getStaleHours(item);
  if (hours >= 3) return "urgent";
  if (hours >= 1) return "warning";
  return "none";
}
