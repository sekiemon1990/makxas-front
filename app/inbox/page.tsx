import { AppShell } from "@/components/app-shell";
import { channelMeta, statusMeta } from "@/lib/inquiry-options";
import { createClient } from "@/lib/supabase/server";
import type {
  InquiryChannel,
  InquiryStatus,
  InquiryWithLead,
  Message,
  Staff,
} from "@/types/database";

import { RealtimeInbox } from "./RealtimeInbox";

export const dynamic = "force-dynamic";

type InboxPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    channel?: string | string[];
    id?: string | string[];
  }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams;
  const status = getStatusParam(firstValue(params.status));
  const channel = getChannelParam(firstValue(params.channel));
  const requestedId = firstValue(params.id);
  const supabase = await createClient();

  let inquiryQuery = supabase
    .from("inquiries")
    .select("*, leads(*), staff:assigned_to(id,name,email), inquiry_tags(tag)")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (status !== "all") {
    inquiryQuery = inquiryQuery.eq("status", status);
  }

  if (channel !== "all") {
    inquiryQuery = inquiryQuery.eq("channel", channel);
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
        key={`${status}:${channel}:${selectedId ?? ""}:${inquiries
          .map((inquiry) => inquiry.id)
          .join(",")}`}
        initialChannel={channel}
        initialInquiries={inquiries}
        initialMessages={(messageRows ?? []) as Message[]}
        initialSelectedId={selectedId ?? null}
        initialStatus={status}
        staff={(staffRows ?? []) as Staff[]}
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
