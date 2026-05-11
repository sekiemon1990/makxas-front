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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReplyBody(selectedInquiry?.ai_suggested_reply ?? "");
  }, [selectedInquiry?.id, selectedInquiry?.ai_suggested_reply]);

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
    setImageFiles([]); // ⑪
    // AI提案リセット
    setAiSuggest(null);
    setAiOriginalBody(null);
    setAiCurrentTheme(null);
    setReplyBody("");

    if (!selectedInquiry?.id) return;
    setAiLoading(true);
    fetch("/api/ai/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiry_id: selectedInquiry.id }),
    })
      .then((r) => r.json())
      .then((data: import("@/app/api/ai/suggest/route").AiSuggestResult) => {
        setAiSuggest(data);
        if (data.mode === "auto" && data.body) {
          setReplyBody(data.body);
          setAiOriginalBody(data.body);
          setAiCurrentTheme(data.theme);
        }
      })
      .catch(() => { /* AI提案失敗は無視 */ })
      .finally(() => setAiLoading(false));
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

      <div className="flex min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-[260px_minmax(360px,480px)_minmax(460px,1fr)]">
        {/* サイドバー */}
        <aside className={cn("overflow-y-auto border-r border-zinc-200 bg-white", mobilePanel !== "sidebar" && "hidden md:block")}>
          <div className="border-b border-zinc-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Inbox</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">統合インボックス</h1>
          </div>
          <div className="space-y-7 p-4">
            <FilterSection title="店舗フィルター">
              {canUseAllStores ? (
                <FilterButton active={initialStore === "all"} onClick={() => updateQuery({ store: "all", id: null })}>
                  全店舗
                </FilterButton>
              ) : null}
              {stores.map((store) => (
                <FilterButton key={store.id} active={initialStore === store.id} onClick={() => updateQuery({ store: store.id, id: null })}>
                  {store.name}
                </FilterButton>
              ))}
            </FilterSection>
            {currentStaffId ? (
              <FilterSection title="担当者フィルター">
                <FilterButton active={initialAssignee === "all"} onClick={() => updateQuery({ assignee: "all", id: null })}>
                  全員
                </FilterButton>
                <FilterButton active={initialAssignee === "mine"} onClick={() => updateQuery({ assignee: "mine", id: null })}>
                  自分の担当のみ
                </FilterButton>
              </FilterSection>
            ) : null}
            <FilterSection title="ステータスフィルター">
              {statusFilters.map((filter) => (
                <FilterButton key={filter.value} active={initialStatus === filter.value} onClick={() => updateQuery({ status: filter.value, id: null })}>
                  {filter.label}
                </FilterButton>
              ))}
            </FilterSection>
            <FilterSection title="チャネルフィルター">
              <FilterButton active={initialChannel === "all"} onClick={() => updateQuery({ channel: "all", id: null })}>
                全て
              </FilterButton>
              {channelFilters.map((channel) => (
                <FilterButton key={channel} active={initialChannel === channel} onClick={() => updateQuery({ channel, id: null })}>
                  <ChannelBadge channel={channel} />
                  <span>{channelMeta[channel].label}</span>
                </FilterButton>
              ))}
            </FilterSection>
            {/* ⑦ プッシュ通知設定 */}
            <FilterSection title="通知設定">
              {notifPermission === "granted" ? (
                <p className="flex items-center gap-2 px-3 text-xs text-emerald-600">
                  <Bell className="size-3.5" />
                  プッシュ通知 ON
                </p>
              ) : notifPermission === "denied" ? (
                <p className="px-3 text-xs text-zinc-400">ブラウザでブロックされています</p>
              ) : (
                <button
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-zinc-600 transition hover:bg-zinc-100"
                  onClick={requestNotifPermission}
                  type="button"
                >
                  <Bell className="size-4" />
                  プッシュ通知を有効にする
                </button>
              )}
            </FilterSection>
          </div>
        </aside>

        {/* 一覧カラム */}
        <section className={cn("overflow-y-auto border-r border-zinc-200 bg-zinc-50", mobilePanel !== "list" && "hidden md:block")}>
          <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 px-5 py-4 backdrop-blur">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">反響一覧</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  全{totalCount}件中 {(page - 1) * 50 + 1}〜{Math.min(page * 50, totalCount)}件
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-md bg-white">Live</Badge>
                {/* ⑥ ショートカットヘルプボタン */}
                <button
                  className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
                  onClick={() => setShowShortcuts(true)}
                  title="キーボードショートカット"
                  type="button"
                >
                  <Keyboard className="size-3.5" />
                  <kbd className="font-mono">?</kbd>
                </button>
              </div>
            </div>
            {/* ⑬ モバイル向けスワイプ説明 */}
            <p className="mt-2 text-[11px] text-zinc-400 md:hidden">
              ← スワイプで保留 ／ スワイプで対応中 →
            </p>
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
                  "group relative rounded-lg border shadow-sm transition",
                  item.id === selectedInquiry?.id
                    ? "border-zinc-950 bg-white ring-2 ring-zinc-950/10"
                    : getStaleLevel(item) === "urgent"
                      ? "border-red-200 bg-red-50 hover:border-red-300"
                      : getStaleLevel(item) === "warning"
                        ? "border-orange-200 bg-orange-50 hover:border-orange-300"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                )}
                onTouchEnd={(e) => handleTouchEnd(e, item.id)}
                onTouchStart={handleTouchStart}
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
                    <div className="flex items-center gap-1.5">
                      <span>{formatElapsed(item.created_at)}</span>
                      {getStaleLevel(item) !== "none" ? (
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 font-semibold",
                          getStaleLevel(item) === "urgent"
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700",
                        )}>
                          ⚠ 未返信 {getStaleHours(item)}h
                        </span>
                      ) : null}
                    </div>
                    <span>
                      {item.stores?.name ?? "店舗未設定"} / {item.staff?.name ?? "未アサイン"}
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
              <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <ChannelBadge channel={selectedInquiry.channel} showLabel />
                      <StatusBadge status={selectedInquiry.status} />
                    </div>
                    <h2 className="mt-3 truncate text-2xl font-semibold tracking-tight">
                      {selectedInquiry.subject ?? "件名なし"}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {getCustomerName(selectedInquiry)} / {selectedInquiry.stores?.name ?? "店舗未設定"} / {formatDateTime(selectedInquiry.created_at)}
                    </p>
                  </div>
                  <Button onClick={() => setAppointmentOpen(true)}>
                    <CalendarPlus className="size-4" aria-hidden="true" />
                    アポを設定
                  </Button>
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

              {/* メッセージスレッド */}
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.direction === "outbound" ? "justify-end" : "justify-start",
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
                        {/* ⑪ 受信画像表示 */}
                        {message.media_urls && message.media_urls.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {message.media_urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={`画像 ${i + 1}`}
                                  className="max-h-48 max-w-full rounded object-contain"
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {message.body ? (
                          <p className="whitespace-pre-wrap">{message.body}</p>
                        ) : null}
                        <p className={cn("mt-2 text-xs", message.direction === "outbound" ? "text-zinc-300" : "text-zinc-500")}>
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

              {/* 返信・操作エリア */}
              <div className="border-t border-zinc-200 bg-zinc-50 p-5">
                <div className="grid grid-cols-[1fr_280px] gap-5">
                  <div className="space-y-3">
                    {/* ⑪ 送信待ち画像プレビュー */}
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
                    {/* ── AI返信提案エリア ── */}
                    {aiLoading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-600">
                        <svg className="size-3.5 animate-spin text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="font-medium">AIが返信文を生成中...</span>
                        <span className="text-violet-400">しばらくお待ちください</span>
                      </div>
                    ) : aiSuggest?.mode === "auto" && aiOriginalBody ? (
                      <>
                        {/* 明確ケース：AI提案バナー */}
                        <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                          <span className="size-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
                          <span className="font-medium flex-1">
                            ✦ AIが返信文を用意しました
                            {aiCurrentTheme ? (
                              <span className="ml-2 rounded-full bg-violet-200 px-2 py-0.5 text-[10px]">
                                {aiSuggest.themes.find((t) => t.key === aiCurrentTheme)?.label ?? aiCurrentTheme}
                              </span>
                            ) : null}
                          </span>
                          <button
                            className="text-violet-400 hover:text-violet-600 text-[11px]"
                            onClick={() => { setReplyBody(""); setAiOriginalBody(null); setAiCurrentTheme(null); }}
                            type="button"
                          >
                            クリア ✕
                          </button>
                        </div>
                        {/* サブテーマ切り替え */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-zinc-400 shrink-0">別のパターン：</span>
                          {aiSuggest.themes.map((t) => (
                            <button
                              key={t.key}
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                                aiCurrentTheme === t.key
                                  ? "border-violet-400 bg-violet-100 text-violet-800"
                                  : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-300 hover:text-violet-700",
                              )}
                              onClick={async () => {
                                setAiCurrentTheme(t.key);
                                setAiLoading(true);
                                try {
                                  const res = await fetch("/api/ai/suggest", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ inquiry_id: selectedInquiry.id, force_theme: t.key }),
                                  });
                                  const data = await res.json() as import("@/app/api/ai/suggest/route").AiSuggestResult;
                                  if (data.body) { setReplyBody(data.body); setAiOriginalBody(data.body); setAiSuggest(data); }
                                } finally { setAiLoading(false); }
                              }}
                              type="button"
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : aiSuggest?.mode === "themes" ? (
                      /* 迷うケース：テーマチップ（confidence順で優先表示） */
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-violet-600 font-medium">
                          <span className="size-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
                          ✦ どのパターンで返信しますか？ — タップで下書きを作成
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
                                  isTop && !isSelected
                                    ? "border-violet-400 bg-violet-100 text-violet-800 px-3.5 py-1.5 text-xs hover:bg-violet-200"
                                    : isSelected
                                    ? "border-violet-500 bg-violet-500 text-white px-3 py-1 text-xs"
                                    : "border-zinc-200 bg-white text-zinc-500 px-2.5 py-1 text-[11px] hover:border-violet-300 hover:text-violet-600",
                                )}
                                onClick={async () => {
                                  setAiCurrentTheme(t.key);
                                  setAiLoading(true);
                                  try {
                                    const res = await fetch("/api/ai/suggest", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ inquiry_id: selectedInquiry.id, force_theme: t.key }),
                                    });
                                    const data = await res.json() as import("@/app/api/ai/suggest/route").AiSuggestResult;
                                    if (data.body) { setReplyBody(data.body); setAiOriginalBody(data.body); setAiSuggest(data); }
                                  } finally { setAiLoading(false); }
                                }}
                                type="button"
                              >
                                {isTop && <span className="mr-1 text-[10px] opacity-70">おすすめ</span>}
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {/* ── /AI返信提案エリア ── */}

                    {/* AI編集理由タグUI */}
                    {showEditReasonPrompt && (
                      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs">
                        <span className="shrink-0 font-medium text-violet-700">修正理由（任意）：</span>
                        {(["tone", "missing_info", "wrong_theme", "factual", "length", "other"] as const).map((r) => (
                          <button
                            key={r}
                            className="rounded-full border border-violet-300 bg-white px-2 py-0.5 text-[10px] text-violet-700 hover:bg-violet-100"
                            onClick={() => {
                              if (lastSentMsgId) {
                                void fetch(`/api/messages/${lastSentMsgId}/edit-reason`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ ai_edit_reason: r }),
                                });
                              }
                              setShowEditReasonPrompt(false);
                            }}
                            type="button"
                          >
                            {({ tone: "語調", missing_info: "情報不足", wrong_theme: "テーマ違い", factual: "事実誤り", length: "長さ", other: "その他" } as Record<string, string>)[r]}
                          </button>
                        ))}
                        <button
                          className="ml-auto text-zinc-400 hover:text-zinc-600"
                          onClick={() => setShowEditReasonPrompt(false)}
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* メール返信時は件名フィールドを表示 */}
                    {["email", "web_form", "hikakaku", "uridoki", "oikura"].includes(
                      selectedInquiry.channel ?? "",
                    ) ? (
                      <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2">
                        <span className="shrink-0 text-xs font-medium text-zinc-500">件名</span>
                        <input
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                          onChange={(e) => setReplySubject(e.target.value)}
                          placeholder={selectedInquiry.subject ?? "Re: お問い合わせ"}
                          type="text"
                          value={replySubject}
                        />
                      </div>
                    ) : null}
                    <div className="relative">
                      <Textarea
                        ref={replyRef}
                        className={cn(
                          "min-h-24 resize-none bg-white",
                          aiOriginalBody && "border-violet-300 bg-violet-50/30 focus-visible:ring-violet-400",
                        )}
                        onChange={(event) => setReplyBody(event.target.value)}
                        placeholder="返信メッセージを入力（r キーでフォーカス）"
                        value={replyBody}
                      />
                      {/* ⑤ テンプレート変数ヒント */}
                      {showTemplates && templates.length > 0 ? (
                        <div className="absolute bottom-full z-20 mb-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-md">
                          {templates.map((t) => (
                            <button
                              key={t.id}
                              className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                              onMouseDown={() => {
                                // ⑤ 変数を実際の値に置換してセット
                                const resolved = applyTemplateVars(t.body, selectedInquiry, currentStaff);
                                setReplyBody(resolved);
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
                        {/* ✦ AI自由相談ボタン（テーマチップでは対応できない複雑なケース向け） */}
                        <Button
                          className={cn(
                            "h-7 gap-1 px-2.5 text-xs",
                            aiPanelOpen
                              ? "border-violet-400 text-violet-700 bg-violet-50"
                              : "border-violet-300 text-violet-600 hover:bg-violet-50",
                          )}
                          onClick={() => setAiPanelOpen((v) => !v)}
                          size="sm"
                          title="テーマチップにない複雑なケースをAIに自由相談"
                          type="button"
                          variant="outline"
                        >
                          <MessageCircle className="size-3" />
                          {aiPanelOpen ? "相談中…" : "AIに質問"}
                        </Button>
                        {templates.length > 0 ? (
                          <Button className="h-7 gap-1 px-2 text-xs" onClick={() => setShowTemplates((v) => !v)} size="sm" type="button" variant="outline">
                            <FileText className="size-3" />
                            テンプレート
                          </Button>
                        ) : null}
                        {/* ⑪ 画像送信ボタン（LINE のみ） */}
                        {selectedInquiry.channel === "line" ? (
                          <>
                            <Button
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => imageInputRef.current?.click()}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <ImageIcon className="size-3" />
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
                        {/* ⑪ 受信画像一括ダウンロード */}
                        {inboundImageMessages.length > 0 ? (
                          <Button
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={handleDownloadImages}
                            size="sm"
                            type="button"
                            variant="outline"
                            title={`受信画像 ${inboundImageMessages.length} 枚を一括ダウンロード`}
                          >
                            <Download className="size-3" />
                            画像({inboundImageMessages.length})
                          </Button>
                        ) : null}
                        {selectedInquiry.ai_suggested_reply ? (
                          <Badge variant="outline" className="rounded-md border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                            AI提案
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* ⑪ 画像送信ボタン */}
                        {imageFiles.length > 0 ? (
                          <Button
                            className="h-9 gap-1 text-sm"
                            disabled={sendingImages}
                            onClick={handleSendImages}
                            type="button"
                            variant="outline"
                          >
                            <ImageIcon className="size-4" aria-hidden="true" />
                            {sendingImages ? "送信中..." : `画像送信 (${imageFiles.length}枚)`}
                          </Button>
                        ) : null}
                        <Button onClick={handleSendMessage} type="button" disabled={!replyBody.trim()}>
                          {["email", "web_form", "hikakaku", "uridoki", "oikura"].includes(
                            selectedInquiry.channel ?? "",
                          ) ? (
                            <Mail className="size-4" aria-hidden="true" />
                          ) : (
                            <Send className="size-4" aria-hidden="true" />
                          )}
                          送信
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* 右サイドパネル（ステータス・タグ・メモ・リマインダー） */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">ステータス変更</label>
                        <Select value={selectedInquiry.status} onValueChange={(value) => handleStatusChange(value as InquiryStatus)}>
                          <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {statusFilters.filter((filter) => filter.value !== "all").map((filter) => (
                              <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">担当者</label>
                        <Select value={selectedInquiry.assigned_to ?? "unassigned"} onValueChange={handleAssignChange}>
                          <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">未アサイン</SelectItem>
                            {staff.map((member) => (
                              <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
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
                          <Badge key={tag.tag} variant="outline" className="rounded-md bg-white pr-1 text-xs">
                            {tag.tag}
                            <button className="ml-1 rounded hover:text-red-500" onClick={() => handleRemoveTag(tag.tag)} type="button">
                              <X className="size-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="relative">
                        <input
                          ref={tagInputRef}
                          className="h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300"
                          onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                          onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
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
                              <button key={t} className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50" onMouseDown={() => handleAddTag(t)} type="button">{t}</button>
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

                    <div className="space-y-2">
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
                  </div>
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
            onTranscribe={(text) => { setReplyBody(text); setAiOriginalBody(text); }}
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
    <section className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
      <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-zinc-400">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
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
