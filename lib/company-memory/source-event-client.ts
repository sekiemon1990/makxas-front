export type CompanyMemorySourceEvent = 'source_deleted' | 'source_expired' | 'source_retracted';

export type CompanyMemorySourceEventResult =
  | {
      ok: true;
      status: 'sent';
      http_status: number;
      matched_item_count: number | null;
      deleted_item_count: number | null;
      dry_run: boolean | null;
      executed: boolean | null;
    }
  | {
      ok: false;
      status: 'not_configured' | 'unsafe_source_pointer_key' | 'invalid_event' | 'gateway_error' | 'network_error';
      http_status?: number;
    };

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

const SOURCE_EVENTS_PATH = '/v1/company-memory/source-events';
const SENSITIVE_VALUE_RE = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?<![A-Za-z0-9])(?:0\d{1,4}[-\s]\d{1,4}[-\s]\d{3,4}|0[789]0\d{8})(?![A-Za-z0-9])|sk-[A-Za-z0-9_-]{16,}|gh[opsu]_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;

export function sourcePointerKeyFromRedactedSummary(record: unknown): string | null {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const pointer = (record as { source_pointer?: unknown }).source_pointer;
  if (!pointer || typeof pointer !== 'object' || Array.isArray(pointer)) return null;
  const key = (pointer as { key?: unknown }).key;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

export async function notifyCompanyMemorySourceEvent(args: {
  gatewayBaseUrl?: string | null;
  gatewaySharedToken?: string | null;
  sourcePointerKey: string;
  event: CompanyMemorySourceEvent;
  execute?: boolean;
  fetcher?: Fetcher;
}): Promise<CompanyMemorySourceEventResult> {
  const gatewayBaseUrl = args.gatewayBaseUrl?.trim().replace(/\/+$/, '');
  const gatewaySharedToken = args.gatewaySharedToken?.trim();
  if (!gatewayBaseUrl || !gatewaySharedToken) return { ok: false, status: 'not_configured' };
  const payload = companyMemorySourceEventPayload({
    sourcePointerKey: args.sourcePointerKey,
    event: args.event,
    execute: args.execute,
  });
  if (!payload.ok) return { ok: false, status: payload.status };
  try {
    const response = await (args.fetcher ?? fetch)(`${gatewayBaseUrl}${SOURCE_EVENTS_PATH}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${gatewaySharedToken}`,
        'content-type': 'application/json',
        'x-makxas-caller-app': 'makxas-front',
      },
      body: JSON.stringify(payload.body),
    });
    if (!response.ok) return { ok: false, status: 'gateway_error', http_status: response.status };
    const body = await response.json().catch(() => ({})) as {
      result?: {
        matched_item_count?: unknown;
        deleted_item_count?: unknown;
        dry_run?: unknown;
        executed?: unknown;
      };
    };
    return {
      ok: true,
      status: 'sent',
      http_status: response.status,
      matched_item_count: numberOrNull(body.result?.matched_item_count),
      deleted_item_count: numberOrNull(body.result?.deleted_item_count),
      dry_run: booleanOrNull(body.result?.dry_run),
      executed: booleanOrNull(body.result?.executed),
    };
  } catch {
    return { ok: false, status: 'network_error' };
  }
}

function companyMemorySourceEventPayload(args: {
  sourcePointerKey: string;
  event: CompanyMemorySourceEvent;
  execute?: boolean;
}):
  | { ok: true; body: { event: CompanyMemorySourceEvent; source_pointer_key: string; execute?: true } }
  | { ok: false; status: 'unsafe_source_pointer_key' | 'invalid_event' } {
  if (!['source_deleted', 'source_expired', 'source_retracted'].includes(args.event)) {
    return { ok: false, status: 'invalid_event' };
  }
  const sourcePointerKey = args.sourcePointerKey.trim();
  if (!sourcePointerKey || SENSITIVE_VALUE_RE.test(sourcePointerKey)) {
    return { ok: false, status: 'unsafe_source_pointer_key' };
  }
  return {
    ok: true,
    body: {
      event: args.event,
      source_pointer_key: sourcePointerKey,
      ...(args.execute ? { execute: true as const } : {}),
    },
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
