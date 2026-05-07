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

type InboxPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    channel?: string | string[];
    store?: string | string[];
    id?: string | string[];
  }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams;
  const status = getStatusParam(firstValue(params.status));
  const channel = getChannelParam(firstValue(params.channel));
  const requestedStore = firstValue(params.store);
  const requestedId = firstValue(params.id);
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const supabase = createServiceClient();
  const { data: currentStaff } = user
    ? await supabase
        .from("staff")
        .select("*")
        .eq("auth_id", user.id)
        .maybeSingle()
    : { data: null };
  const canUseAllStores =
    currentStaff?.role === "super_admin" || currentStaff?.role === "admin";

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
      "*, leads(*), staff:assigned_to(id,name,email), stores(id,name,store_code,store_type), line_accounts(id,name,destination), email_accounts(id,email,display_name), comparison_site_accounts(id,site,notification_email), inquiry_tags(tag)",
    )
    .order("updated_at", { ascending: false })
    .limit(50);

  if (status !== "all") {
    inquiryQuery = inquiryQuery.eq("status", status);
  }

  if (channel !== "all") {
    inquiryQuery = inquiryQuery.eq("channel", channel);
  }

  if (store !== "all") {
    inquiryQuery = inquiryQuery.eq("store_id", store);
  } else if (!canUseAllStores) {
    inquiryQuery =
      accessibleStoreIds.length > 0
        ? inquiryQuery.in("store_id", accessibleStoreIds)
        : inquiryQuery.eq("store_id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: inquiryRows } = await inquiryQuery;
  const inquiries = (inquiryRows ?? []) as unknown as InquiryWithLead[];
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

  return (
    <AppShell>
      <RealtimeInbox
        key={`${status}:${channel}:${store}:${selectedId ?? ""}:${inquiries
          .map((inquiry) => inquiry.id)
          .join(",")}`}
        canUseAllStores={canUseAllStores}
        initialChannel={channel}
        initialInquiries={inquiries}
        initialMessages={(messageRows ?? []) as Message[]}
        initialSelectedId={selectedId ?? null}
        initialStatus={status}
        initialStore={store}
        staff={(staffRows ?? []) as Staff[]}
        stores={stores}
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
