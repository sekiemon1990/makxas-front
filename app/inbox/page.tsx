import { AppShell } from "@/components/app-shell";
import { channelMeta, statusMeta } from "@/lib/inquiry-options";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  InquiryChannel,
  InquiryStatus,
  InquiryWithLead,
  Message,
  Staff,
  Store,
} from "@/types/database";

import { RealtimeInbox } from "./RealtimeInbox";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type InboxPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    channel?: string | string[];
    store?: string | string[];
    id?: string | string[];
    page?: string | string[];
    assignee?: string | string[];
    q?: string | string[]; // PR17: サーバーサイド検索クエリ
  }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams;
  const status = getStatusParam(firstValue(params.status));
  const channel = getChannelParam(firstValue(params.channel));
  const requestedStore = firstValue(params.store);
  const requestedId = firstValue(params.id);
  const page = Math.max(1, parseInt(firstValue(params.page) ?? "1", 10) || 1);
  // PR20: assignee に "mentioned" を追加（自分が @メンション された反響）
  const rawAssignee = firstValue(params.assignee);
  const assigneeFilter: "all" | "mine" | "mentioned" =
    rawAssignee === "mine"
      ? "mine"
      : rawAssignee === "mentioned"
      ? "mentioned"
      : "all";
  // PR17: サーバーサイド検索（subject + lead display_name / phone / email を OR）
  const searchQuery = (firstValue(params.q) ?? "").trim();
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const supabase = createServiceClient();
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  let { data: currentStaff } = user
    ? await supabase
        .from("staff")
        .select("*")
        .eq("auth_id", user.id)
        .maybeSingle()
    : { data: null };
  // デモモードでは認証スキップなので user=null。先頭の有効スタッフをフォールバックとして使用。
  if (!currentStaff && isDemoMode) {
    const { data: demoStaff } = await supabase
      .from("staff")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    currentStaff = demoStaff;
  }
  const canUseAllStores =
    isDemoMode ||
    currentStaff?.role === "super_admin" ||
    currentStaff?.role === "admin";

  const { data: allStores } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  const { data: staffAccess } =
    !canUseAllStores && currentStaff
      ? await supabase
          .from("staff_store_access")
          .select("store_id")
          .eq("staff_id", currentStaff.id)
      : { data: [] };
  const accessibleStoreIds = canUseAllStores
    ? (allStores ?? []).map((store) => store.id)
    : (staffAccess ?? []).map((access) => access.store_id);
  const stores = canUseAllStores
    ? ((allStores ?? []) as Store[])
    : ((allStores ?? []).filter((store) =>
        accessibleStoreIds.includes(store.id),
      ) as Store[]);
  const store =
    requestedStore && accessibleStoreIds.includes(requestedStore)
      ? requestedStore
      : "all";

  let inquiryQuery = supabase
    .from("inquiries")
    .select(
      "*, leads(*), staff:assigned_to(id,name,email), brands(id,name,brand_code), stores(id,name,store_code,store_type), line_accounts(id,name,destination), email_accounts(id,email,display_name), comparison_site_accounts(id,site,notification_email), inquiry_tags(tag)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status !== "all") {
    inquiryQuery = inquiryQuery.eq("status", status);
  }

  if (channel !== "all") {
    inquiryQuery = inquiryQuery.eq("channel", channel);
  }

  if (assigneeFilter === "mine" && currentStaff) {
    inquiryQuery = inquiryQuery.eq("assigned_to", currentStaff.id);
  } else if (assigneeFilter === "mentioned" && currentStaff) {
    // PR20: internal_note に @自分の名前 を含む反響を抽出
    // 名前に半角スペースを含む場合の両形式 + LIKE のエスケープ
    const escName = currentStaff.name.replace(/[%_]/g, (c) => `\\${c}`);
    const escNoSpace = escName.replace(/\s+/g, "");
    if (escNoSpace !== escName) {
      inquiryQuery = inquiryQuery.or(
        `internal_note.ilike.%@${escName}%,internal_note.ilike.%@${escNoSpace}%`,
      );
    } else {
      inquiryQuery = inquiryQuery.ilike("internal_note", `%@${escName}%`);
    }
  }

  // PR17: 検索クエリ — subject の前方一致 + lead 系（電話/メール/氏名）の一致リードIDを ORで結合
  if (searchQuery) {
    // 数字のみ抽出した電話バリエーション（ハイフン省略・全角→半角）
    const phoneDigits = searchQuery.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    ).replace(/[^0-9]/g, "");
    const orParts: string[] = [];
    if (searchQuery) orParts.push(`display_name.ilike.%${searchQuery}%`);
    if (searchQuery.includes("@") || searchQuery.length >= 3) {
      orParts.push(`email.ilike.%${searchQuery}%`);
    }
    if (phoneDigits.length >= 4) {
      orParts.push(`phone.ilike.%${phoneDigits}%`);
    }
    const { data: matchedLeads } = await supabase
      .from("leads")
      .select("id")
      .or(orParts.join(","))
      .limit(500);
    const leadIds = (matchedLeads ?? []).map((l) => l.id);
    // subject 一致 OR lead 一致
    if (leadIds.length > 0) {
      inquiryQuery = inquiryQuery.or(
        `subject.ilike.%${searchQuery}%,lead_id.in.(${leadIds.join(",")})`,
      );
    } else {
      inquiryQuery = inquiryQuery.ilike("subject", `%${searchQuery}%`);
    }
  }

  if (store !== "all") {
    inquiryQuery = inquiryQuery.eq("store_id", store);
  } else if (!canUseAllStores) {
    inquiryQuery =
      accessibleStoreIds.length > 0
        ? inquiryQuery.in("store_id", accessibleStoreIds)
        : inquiryQuery.eq("store_id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: inquiryRows, count: inquiryCount } = await inquiryQuery;
  const inquiries = (inquiryRows ?? []) as unknown as InquiryWithLead[];
  const totalCount = inquiryCount ?? inquiries.length;
  const hasMore = page * PAGE_SIZE < totalCount;
  const selectedId =
    requestedId && inquiries.some((inquiry) => inquiry.id === requestedId)
      ? requestedId
      : inquiries[0]?.id;

  const { data: messageRows } = selectedId
    ? await supabase
        .from("messages")
        .select("*")
        .eq("inquiry_id", selectedId)
        .order("created_at", { ascending: true })
    : { data: [] };

  const { data: staffRows } = await supabase
    .from("staff")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const inquiryIds = inquiries.map((i) => i.id);
  const { data: readRows } =
    currentStaff && inquiryIds.length > 0
      ? await supabase
          .from("inquiry_reads")
          .select("inquiry_id")
          .eq("staff_id", currentStaff.id)
          .in("inquiry_id", inquiryIds)
      : { data: [] };
  const readInquiryIds = new Set((readRows ?? []).map((r) => r.inquiry_id));

  return (
    <AppShell>
      <RealtimeInbox
        key={`${status}:${channel}:${store}:${assigneeFilter}:${page}:${searchQuery}:${selectedId ?? ""}`}
        canUseAllStores={canUseAllStores}
        currentStaffId={currentStaff?.id ?? null}
        hasMore={hasMore}
        initialAssignee={assigneeFilter}
        initialChannel={channel}
        initialInquiries={inquiries}
        initialMessages={(messageRows ?? []) as Message[]}
        initialReadIds={[...readInquiryIds]}
        initialSelectedId={selectedId ?? null}
        initialSearch={searchQuery}
        initialStatus={status}
        initialStore={store}
        page={page}
        staff={(staffRows ?? []) as Staff[]}
        stores={stores}
        totalCount={totalCount}
      />
    </AppShell>
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getStatusParam(value: string | undefined): InquiryStatus | "all" {
  if (!value) return "all";
  return value in statusMeta ? (value as InquiryStatus) : "all";
}

function getChannelParam(value: string | undefined): InquiryChannel | "all" {
  if (!value) return "all";
  return value in channelMeta ? (value as InquiryChannel) : "all";
}
