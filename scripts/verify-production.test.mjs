import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyHealth,
  classifyLoginPage,
  classifyLoginRedirect,
  classifySupportAggregateRead,
  normalizeBaseUrl,
} from "./verify-production.mjs";

test("normalizeBaseUrl strips trailing slashes", () => {
  assert.equal(
    normalizeBaseUrl(" https://makxas-front.vercel.app/// "),
    "https://makxas-front.vercel.app",
  );
});

test("classifyHealth accepts only the makxas-front health payload", () => {
  assert.equal(classifyHealth({ status: 200, body: { service: "makxas-front", status: "ok" } }).ok, true);
  assert.equal(classifyHealth({ status: 503, body: { service: "makxas-front", status: "degraded" } }).ok, false);
});

test("classifyLoginRedirect requires same-origin login next preservation", () => {
  assert.equal(
    classifyLoginRedirect({
      status: 307,
      location: "https://makxas-front.vercel.app/login?next=%2Fdashboard",
      baseURL: "https://makxas-front.vercel.app",
      expectedNext: "/dashboard",
    }).ok,
    true,
  );
  assert.equal(
    classifyLoginRedirect({
      status: 307,
      location: "https://example.com/login?next=%2Fdashboard",
      baseURL: "https://makxas-front.vercel.app",
      expectedNext: "/dashboard",
    }).reason,
    "cross_origin_redirect",
  );
});

test("classifyLoginPage accepts recognizable login copy", () => {
  assert.equal(classifyLoginPage({ status: 200, body: "反響対応を始めるにはログインしてください。Googleでログイン" }).ok, true);
  assert.equal(classifyLoginPage({ status: 404, body: "Googleでログイン" }).ok, false);
});

test("classifyLoginPage accepts a Japanese Next.js app shell", () => {
  assert.equal(
    classifyLoginPage({
      status: 200,
      body: "<!DOCTYPE html><html lang=\"ja\"><script src=\"/_next/static/chunks/app.js\"></script></html>",
    }).ok,
    true,
  );
});

test("classifySupportAggregateRead accepts fail-closed unauthenticated checks without a token", () => {
  const result = classifySupportAggregateRead({
    status: 401,
    body: {
      ok: false,
      service: "makxas-front",
      domain: "support_aggregate",
      error: "unauthorized",
      db: "not_touched",
      external_sends: 0,
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.reason, "fail_closed_unauthorized");
});

test("classifySupportAggregateRead requires aggregate-only payloads when token is configured", () => {
  const ok = classifySupportAggregateRead({
    status: 200,
    body: {
      ok: true,
      service: "makxas-front",
      domain: "support_aggregate",
      status: "read_only",
      privacy: {
        pii_returned: false,
        free_text_returned: false,
        aggregate_only: true,
      },
      metrics: { inquiries_total: 10 },
      evidence: { query_mode: "read_only" },
    },
  }, { withToken: true });
  assert.equal(ok.ok, true);

  const unsafe = classifySupportAggregateRead({
    status: 200,
    body: {
      service: "makxas-front",
      domain: "support_aggregate",
      status: "read_only",
      privacy: { pii_returned: false, free_text_returned: false, aggregate_only: true },
      metrics: { phone: "090-xxxx" },
      evidence: { query_mode: "read_only" },
    },
  }, { withToken: true });
  assert.equal(unsafe.ok, false);
  assert.deepEqual(unsafe.unsafe_keys, ["metrics.phone"]);
});
