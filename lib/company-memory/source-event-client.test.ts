import { describe, expect, it } from 'vitest';

import { buildCompanyMemoryRedactedSummary } from './redacted-summary-contract';
import {
  notifyCompanyMemorySourceEvent,
  sourcePointerKeyFromRedactedSummary,
} from './source-event-client';

describe('Company Memory source event client', () => {
  it('sends only the canonical source pointer key to Gateway', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const record = buildCompanyMemoryRedactedSummary({
      id: 'inq-001',
      title: 'Redacted summary',
      summary: 'PII-free derived summary.',
      sourcePath: 'ai_chats/redacted-summary',
      sourceVersion: 'fixture-v1',
      capturedAt: '2026-06-27T00:00:00.000Z',
    });
    const result = await notifyCompanyMemorySourceEvent({
      gatewayBaseUrl: 'https://gateway.example.com/',
      gatewaySharedToken: 'shared-token',
      sourcePointerKey: sourcePointerKeyFromRedactedSummary(record) ?? '',
      event: 'source_deleted',
      fetcher: async (url, init) => {
        calls.push({ url, init });
        return Response.json({
          result: {
            matched_item_count: 1,
            deleted_item_count: 0,
            dry_run: true,
            executed: false,
          },
        });
      },
    });

    expect(result).toEqual({
      ok: true,
      status: 'sent',
      http_status: 200,
      matched_item_count: 1,
      deleted_item_count: 0,
      dry_run: true,
      executed: false,
    });
    expect(calls[0]?.url).toBe('https://gateway.example.com/v1/company-memory/source-events');
    expect(calls[0]?.init.headers).toMatchObject({
      authorization: 'Bearer shared-token',
      'content-type': 'application/json',
      'x-makxas-caller-app': 'makxas-front',
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      event: 'source_deleted',
      source_pointer_key: 'makxas-front:ai_chats/redacted-summary:fixture-v1',
    });
    expect(String(calls[0]?.init.body)).not.toContain('PII-free derived summary');
  });

  it('does not call Gateway when config is missing or source pointer key is unsafe', async () => {
    let called = false;
    const fetcher = async () => {
      called = true;
      return Response.json({});
    };

    await expect(notifyCompanyMemorySourceEvent({
      sourcePointerKey: 'makxas-front:ai_chats/redacted-summary:fixture-v1',
      event: 'source_deleted',
      fetcher,
    })).resolves.toEqual({ ok: false, status: 'not_configured' });
    await expect(notifyCompanyMemorySourceEvent({
      gatewayBaseUrl: 'https://gateway.example.com',
      gatewaySharedToken: 'shared-token',
      sourcePointerKey: 'makxas-front:ai_chats/customer@example.com:fixture-v1',
      event: 'source_deleted',
      fetcher,
    })).resolves.toEqual({ ok: false, status: 'unsafe_source_pointer_key' });
    expect(called).toBe(false);
  });
});
