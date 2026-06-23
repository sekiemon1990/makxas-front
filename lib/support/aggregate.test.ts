import { describe, expect, it } from "vitest";

import {
  authorizeSupportAggregateRead,
  extractBearerToken,
  summarizeSupportAggregates,
} from "./aggregate";

describe("support aggregate auth", () => {
  it("extracts bearer tokens", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("basic abc123")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });

  it("fails closed without a token", () => {
    expect(authorizeSupportAggregateRead(null, "expected")).toEqual({
      ok: false,
      status: 401,
      code: "unauthorized",
    });
  });

  it("reports setup_required only after a caller presents a bearer token", () => {
    expect(authorizeSupportAggregateRead("Bearer anything", undefined)).toEqual({
      ok: false,
      status: 503,
      code: "setup_required",
    });
  });

  it("authorizes matching tokens without exposing the token", () => {
    expect(authorizeSupportAggregateRead("Bearer expected", "expected")).toEqual({ ok: true });
    expect(authorizeSupportAggregateRead("Bearer wrong", "expected")).toEqual({
      ok: false,
      status: 401,
      code: "unauthorized",
    });
  });
});

describe("support aggregate report", () => {
  it("returns only aggregate metrics and no free text", () => {
    const report = summarizeSupportAggregates({
      since: "2026-06-01T00:00:00.000Z",
      until: "2026-06-23T00:00:00.000Z",
      inquiries: [
        {
          id: "inq-1",
          status: "new",
          channel: "line",
          created_at: "2026-06-22T10:00:00.000Z",
          updated_at: "2026-06-22T11:00:00.000Z",
          first_response_at: null,
          msg_category: "initial_contact",
        },
        {
          id: "inq-2",
          status: "closed",
          channel: "email",
          created_at: "2026-06-21T10:00:00.000Z",
          updated_at: "2026-06-21T11:00:00.000Z",
          first_response_at: "2026-06-21T10:05:00.000Z",
          msg_category: "price",
        },
      ],
      messages: [
        { inquiry_id: "inq-1", direction: "inbound", created_at: "2026-06-22T11:00:00.000Z" },
        { inquiry_id: "inq-2", direction: "outbound", created_at: "2026-06-21T11:00:00.000Z" },
      ],
      appointments: [
        {
          csat_score: 1,
          csat_nps: -50,
          csat_responded_at: "2026-06-22T12:00:00.000Z",
          csat_sent_at: "2026-06-22T10:00:00.000Z",
          created_at: "2026-06-22T10:00:00.000Z",
        },
        {
          csat_score: 5,
          csat_nps: 80,
          csat_responded_at: "2026-06-22T12:00:00.000Z",
          csat_sent_at: "2026-06-22T10:00:00.000Z",
          created_at: "2026-06-22T10:00:00.000Z",
        },
      ],
    });

    expect(report.privacy).toEqual({
      pii_returned: false,
      free_text_returned: false,
      aggregate_only: true,
    });
    expect(report.metrics.inquiries_total).toBe(2);
    expect(report.metrics.open_total).toBe(1);
    expect(report.metrics.first_response_missing_total).toBe(1);
    expect(report.metrics.unanswered_total).toBe(1);
    expect(report.metrics.by_status).toEqual({ new: 1, closed: 1 });
    expect(report.metrics.by_channel).toEqual({ line: 1, email: 1 });
    expect(report.metrics.csat_average).toBe(3);
    expect(report.metrics.low_csat_total).toBe(1);
    expect(JSON.stringify(report)).not.toContain("subject");
    expect(JSON.stringify(report)).not.toContain("body");
    expect(JSON.stringify(report)).not.toContain("phone");
    expect(JSON.stringify(report)).not.toContain("090-");
  });
});
