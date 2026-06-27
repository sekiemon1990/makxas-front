import { describe, expect, it } from 'vitest';

import {
  buildCompanyMemoryRedactedSummary,
  validateCompanyMemoryRedactedSummary,
} from './redacted-summary-contract';

describe('Company Memory ADR-0074 redacted summary contract', () => {
  it('builds a derived-only front summary with delete linkage policy', () => {
    const record = buildCompanyMemoryRedactedSummary({
      id: 'inq-001',
      title: 'Inside sales response pattern summary',
      summary: 'Redacted response summary without names, phone numbers, addresses, LINE IDs, or raw chat text.',
      sourcePath: 'ai_chats/redacted-summary',
      sourceVersion: 'fixture-v1',
      capturedAt: '2026-06-27T00:00:00.000Z',
    });

    expect(validateCompanyMemoryRedactedSummary(record)).toEqual([]);
    expect(record.source_pointer.repo).toBe('makxas-front');
    expect(record.policy.deletion_contract).toBe('source-pointer-delete-or-expire');
  });

  it('rejects PII-like values and raw message keys', () => {
    const record = {
      ...buildCompanyMemoryRedactedSummary({
        id: 'inq-002',
        title: 'Unsafe summary',
        summary: 'Reply to customer@example.com.',
        sourcePath: 'ai_chats/redacted-summary',
        sourceVersion: 'fixture-v1',
        capturedAt: '2026-06-27T00:00:00.000Z',
      }),
      raw_message: 'raw message must not leave the source repo',
    };

    expect(validateCompanyMemoryRedactedSummary(record)).toEqual(
      expect.arrayContaining(['sensitive_value_detected', 'forbidden_raw_key:raw_message']),
    );
  });
});
