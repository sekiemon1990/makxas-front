const REPO = 'makxas-front';
const CONTRACT = {
  phase2Go: 'conditional-redacted-summary',
  redaction: 'adr0074-redacted-summary-v1',
  deletion: 'source-pointer-delete-or-expire',
  sourcePointer: 'canonical-pointer-only',
} as const;

const SENSITIVE_VALUE_RE = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?<![A-Za-z0-9])(?:0\d{1,4}[-\s]\d{1,4}[-\s]\d{3,4}|0[789]0\d{8})(?![A-Za-z0-9])|sk-[A-Za-z0-9_-]{16,}|gh[opsu]_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const RAW_KEY_RE = /(?:raw|payload|chat|message|phone|email|address|lineUserId|customerName|leadName)/i;

export type FrontMemorySummaryInput = {
  id: string;
  title: string;
  summary: string;
  sourcePath: string;
  sourceVersion: string;
  capturedAt: string;
  ttl?: string;
  confidence?: number;
};

export type CompanyMemoryRedactedSummaryRecord = {
  id: string;
  kind: 'conversation';
  title: string;
  summary: string;
  source_pointer: {
    key: string;
    repo: typeof REPO;
    path: string;
    commit: string;
  };
  freshness: {
    captured_at: string;
    ttl: string;
    confidence: number;
  };
  classification: {
    pii: false;
    redaction_status: 'redacted';
    phase: 'phase2';
  };
  policy: {
    access: 'read-only';
    input_mode: 'redacted-summary';
    external_model: 'redacted-summary-only';
    phase2_go: typeof CONTRACT.phase2Go;
    redaction_contract: typeof CONTRACT.redaction;
    deletion_contract: typeof CONTRACT.deletion;
    source_pointer_contract: typeof CONTRACT.sourcePointer;
    raw_payload_allowed: false;
  };
};

export function buildCompanyMemoryRedactedSummary(input: FrontMemorySummaryInput): CompanyMemoryRedactedSummaryRecord {
  const sourcePath = input.sourcePath.trim();
  const sourceVersion = input.sourceVersion.trim();
  return {
    id: `conversation:${REPO}:${input.id.trim()}`,
    kind: 'conversation',
    title: input.title.trim(),
    summary: input.summary.trim(),
    source_pointer: {
      key: `${REPO}:${sourcePath}:${sourceVersion}`,
      repo: REPO,
      path: sourcePath,
      commit: sourceVersion,
    },
    freshness: {
      captured_at: input.capturedAt,
      ttl: input.ttl ?? 'P90D',
      confidence: input.confidence ?? 0.75,
    },
    classification: {
      pii: false,
      redaction_status: 'redacted',
      phase: 'phase2',
    },
    policy: {
      access: 'read-only',
      input_mode: 'redacted-summary',
      external_model: 'redacted-summary-only',
      phase2_go: CONTRACT.phase2Go,
      redaction_contract: CONTRACT.redaction,
      deletion_contract: CONTRACT.deletion,
      source_pointer_contract: CONTRACT.sourcePointer,
      raw_payload_allowed: false,
    },
  };
}

export function validateCompanyMemoryRedactedSummary(record: unknown): string[] {
  const obj = asRecord(record);
  const policy = asRecord(obj.policy);
  const classification = asRecord(obj.classification);
  const pointer = asRecord(obj.source_pointer);
  const issues: string[] = [];

  if (obj.kind !== 'conversation') issues.push('kind_must_be_conversation');
  if (pointer.repo !== REPO) issues.push(`source_pointer_repo_must_be_${REPO}`);
  if (classification.pii !== false) issues.push('classification_pii_must_be_false');
  if (classification.redaction_status !== 'redacted') issues.push('redaction_status_must_be_redacted');
  if (policy.raw_payload_allowed !== false) issues.push('raw_payload_allowed_must_be_false');
  if (policy.phase2_go !== CONTRACT.phase2Go) issues.push(`phase2_go_must_be_${CONTRACT.phase2Go}`);
  if (policy.redaction_contract !== CONTRACT.redaction) issues.push(`redaction_contract_must_be_${CONTRACT.redaction}`);
  if (policy.deletion_contract !== CONTRACT.deletion) issues.push(`deletion_contract_must_be_${CONTRACT.deletion}`);
  if (policy.source_pointer_contract !== CONTRACT.sourcePointer) {
    issues.push(`source_pointer_contract_must_be_${CONTRACT.sourcePointer}`);
  }
  if (SENSITIVE_VALUE_RE.test(JSON.stringify(obj))) issues.push('sensitive_value_detected');
  for (const key of collectKeys(obj)) {
    if (key === 'raw_payload_allowed') continue;
    if (RAW_KEY_RE.test(key)) issues.push(`forbidden_raw_key:${key}`);
  }
  return [...new Set(issues)];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function collectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [key, ...collectKeys(child)]);
}
