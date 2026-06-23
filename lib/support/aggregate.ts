import { createHash, timingSafeEqual } from "node:crypto";

const OPEN_INQUIRY_STATUSES = new Set(["new", "in_progress", "pending"]);
const DEFAULT_WINDOW_DAYS = 30;
const DEFAULT_ROW_LIMIT = 5000;

type SupabaseLike = {
  from: (table: string) => unknown;
};

type QueryResult<Row> = {
  data: Row[] | null;
  error: { message?: string } | null;
  count?: number | null;
};

type ChainableQuery<Row> = {
  select: (columns: string, options?: { count?: "exact" }) => ChainableQuery<Row> & PromiseLike<QueryResult<Row>>;
  gte: (column: string, value: string) => ChainableQuery<Row> & PromiseLike<QueryResult<Row>>;
  in: (column: string, values: string[]) => ChainableQuery<Row> & PromiseLike<QueryResult<Row>>;
  order: (column: string, options?: { ascending?: boolean }) => ChainableQuery<Row> & PromiseLike<QueryResult<Row>>;
  limit: (count: number) => ChainableQuery<Row> & PromiseLike<QueryResult<Row>>;
};

type InquiryAggregateRow = {
  id: string;
  status: string;
  channel: string;
  created_at: string;
  updated_at: string | null;
  first_response_at: string | null;
  msg_category: string | null;
};

type MessageAggregateRow = {
  inquiry_id: string;
  direction: "inbound" | "outbound";
  created_at: string;
};

type AppointmentAggregateRow = {
  csat_score?: number | null;
  csat_nps?: number | null;
  csat_responded_at?: string | null;
  csat_sent_at?: string | null;
  created_at: string;
};

export type SupportAggregateReport = {
  ok: true;
  service: "makxas-front";
  domain: "support_aggregate";
  status: "read_only";
  window: {
    days: number;
    since: string;
    until: string;
  };
  privacy: {
    pii_returned: false;
    free_text_returned: false;
    aggregate_only: true;
  };
  metrics: {
    inquiries_total: number;
    open_total: number;
    first_response_missing_total: number;
    unanswered_total: number;
    by_status: Record<string, number>;
    by_channel: Record<string, number>;
    by_message_category: Record<string, number>;
    csat_sent_total: number;
    csat_responses_total: number;
    csat_average: number | null;
    low_csat_total: number;
    nps_average: number | null;
  };
  evidence: {
    data_sources: string[];
    query_mode: "read_only";
    selected_columns: Record<string, string[]>;
    row_limit: number;
    truncated: {
      inquiries: boolean;
      messages: boolean;
      appointments: boolean;
    };
  };
};

export type SupportAggregateAuthResult =
  | { ok: true }
  | { ok: false; status: 401; code: "unauthorized" }
  | { ok: false; status: 503; code: "setup_required" };

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

function timingSafeTokenEqual(input: string, expected: string) {
  return timingSafeEqual(sha256(input), sha256(expected));
}

export function extractBearerToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function authorizeSupportAggregateRead(
  authorization: string | null,
  expectedToken = process.env.FRONT_SUPPORT_AGGREGATE_TOKEN,
): SupportAggregateAuthResult {
  const token = extractBearerToken(authorization);
  if (!token) {
    return { ok: false, status: 401, code: "unauthorized" };
  }
  if (!expectedToken) {
    return { ok: false, status: 503, code: "setup_required" };
  }
  if (!timingSafeTokenEqual(token, expectedToken)) {
    return { ok: false, status: 401, code: "unauthorized" };
  }
  return { ok: true };
}

export function isoDaysAgo(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function query<Row>(client: SupabaseLike, table: string) {
  return client.from(table) as ChainableQuery<Row>;
}

async function readRows<Row>(
  queryPromise: ChainableQuery<Row> & PromiseLike<QueryResult<Row>>,
  table: string,
) {
  const { data, error, count } = await queryPromise;
  if (error) {
    throw new Error(`${table} aggregate read failed: ${error.message ?? "unknown_error"}`);
  }
  return {
    rows: data ?? [],
    count: count ?? (data ?? []).length,
  };
}

function increment(map: Record<string, number>, key: string | null | undefined) {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] ?? 0) + 1;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export function summarizeSupportAggregates(input: {
  inquiries: InquiryAggregateRow[];
  messages: MessageAggregateRow[];
  appointments: AppointmentAggregateRow[];
  inquiryCount?: number;
  messageCount?: number;
  appointmentCount?: number;
  windowDays?: number;
  since: string;
  until: string;
  rowLimit?: number;
}): SupportAggregateReport {
  const rowLimit = input.rowLimit ?? DEFAULT_ROW_LIMIT;
  const byStatus: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const byMessageCategory: Record<string, number> = {};
  let openTotal = 0;
  let firstResponseMissingTotal = 0;

  const openInquiryIds = new Set<string>();
  for (const inquiry of input.inquiries) {
    increment(byStatus, inquiry.status);
    increment(byChannel, inquiry.channel);
    increment(byMessageCategory, inquiry.msg_category);
    if (OPEN_INQUIRY_STATUSES.has(inquiry.status)) {
      openTotal += 1;
      openInquiryIds.add(inquiry.id);
      if (!inquiry.first_response_at) firstResponseMissingTotal += 1;
    }
  }

  const latestMessageByInquiry = new Map<string, MessageAggregateRow>();
  for (const message of input.messages) {
    const current = latestMessageByInquiry.get(message.inquiry_id);
    if (!current || current.created_at < message.created_at) {
      latestMessageByInquiry.set(message.inquiry_id, message);
    }
  }

  let unansweredTotal = 0;
  for (const inquiryId of openInquiryIds) {
    const latest = latestMessageByInquiry.get(inquiryId);
    if (!latest || latest.direction === "inbound") unansweredTotal += 1;
  }

  const csatScores = input.appointments
    .map((row) => row.csat_score)
    .filter((score): score is number => typeof score === "number");
  const npsScores = input.appointments
    .map((row) => row.csat_nps)
    .filter((score): score is number => typeof score === "number");

  return {
    ok: true,
    service: "makxas-front",
    domain: "support_aggregate",
    status: "read_only",
    window: {
      days: input.windowDays ?? DEFAULT_WINDOW_DAYS,
      since: input.since,
      until: input.until,
    },
    privacy: {
      pii_returned: false,
      free_text_returned: false,
      aggregate_only: true,
    },
    metrics: {
      inquiries_total: input.inquiryCount ?? input.inquiries.length,
      open_total: openTotal,
      first_response_missing_total: firstResponseMissingTotal,
      unanswered_total: unansweredTotal,
      by_status: byStatus,
      by_channel: byChannel,
      by_message_category: byMessageCategory,
      csat_sent_total: input.appointments.filter((row) => row.csat_sent_at).length,
      csat_responses_total: csatScores.length,
      csat_average: average(csatScores),
      low_csat_total: csatScores.filter((score) => score <= 2).length,
      nps_average: average(npsScores),
    },
    evidence: {
      data_sources: [
        "inquiries.aggregate_columns_only",
        "messages.direction_and_timestamp_only",
        "appointments.csat_numeric_only",
      ],
      query_mode: "read_only",
      selected_columns: {
        inquiries: ["id", "status", "channel", "created_at", "updated_at", "first_response_at", "msg_category"],
        messages: ["inquiry_id", "direction", "created_at"],
        appointments: ["csat_score", "csat_nps", "csat_responded_at", "csat_sent_at", "created_at"],
      },
      row_limit: rowLimit,
      truncated: {
        inquiries: (input.inquiryCount ?? input.inquiries.length) > input.inquiries.length,
        messages: (input.messageCount ?? input.messages.length) > input.messages.length,
        appointments: (input.appointmentCount ?? input.appointments.length) > input.appointments.length,
      },
    },
  };
}

export async function buildSupportAggregateReport(
  supabase: SupabaseLike,
  options: {
    windowDays?: number;
    now?: Date;
    rowLimit?: number;
  } = {},
) {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const rowLimit = options.rowLimit ?? DEFAULT_ROW_LIMIT;
  const now = options.now ?? new Date();
  const since = isoDaysAgo(windowDays, now);
  const until = now.toISOString();

  const inquiries = await readRows(
    query<InquiryAggregateRow>(supabase, "inquiries")
      .select("id,status,channel,created_at,updated_at,first_response_at,msg_category", { count: "exact" })
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(rowLimit),
    "inquiries",
  );

  const inquiryIds = inquiries.rows.map((row) => row.id);
  const messages = inquiryIds.length === 0
    ? { rows: [] as MessageAggregateRow[], count: 0 }
    : await readRows(
      query<MessageAggregateRow>(supabase, "messages")
        .select("inquiry_id,direction,created_at", { count: "exact" })
        .in("inquiry_id", inquiryIds)
        .order("created_at", { ascending: false })
        .limit(rowLimit),
      "messages",
    );

  const appointments = await readRows(
    query<AppointmentAggregateRow>(supabase, "appointments")
      .select("csat_score,csat_nps,csat_responded_at,csat_sent_at,created_at", { count: "exact" })
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(rowLimit),
    "appointments",
  );

  return summarizeSupportAggregates({
    inquiries: inquiries.rows,
    messages: messages.rows,
    appointments: appointments.rows,
    inquiryCount: inquiries.count,
    messageCount: messages.count,
    appointmentCount: appointments.count,
    windowDays,
    since,
    until,
    rowLimit,
  });
}
