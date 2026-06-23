#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://makxas-front.vercel.app";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function normalizeBaseUrl(input = DEFAULT_BASE_URL) {
  const raw = String(input || "").trim() || DEFAULT_BASE_URL;
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Unsupported production URL protocol: ${url.protocol}`);
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

export function classifyHealth({ status, body }) {
  const ok = status === 200 && body?.service === "makxas-front" && body?.status === "ok";
  return {
    ok,
    reason: ok ? "verified" : "unexpected_health",
    status,
    service: body?.service ?? null,
    db: body?.db ?? null,
  };
}

export function classifyLoginRedirect({ status, location, baseURL, expectedNext }) {
  const normalizedBase = normalizeBaseUrl(baseURL);
  if (!REDIRECT_STATUSES.has(status)) {
    return {
      ok: false,
      reason: "expected_redirect",
      status,
      location: location || null,
      expected_next: expectedNext,
    };
  }
  if (!location) {
    return {
      ok: false,
      reason: "missing_location",
      status,
      location: null,
      expected_next: expectedNext,
    };
  }

  const redirectUrl = new URL(location, normalizedBase);
  const next = redirectUrl.searchParams.get("next");
  if (redirectUrl.origin !== new URL(normalizedBase).origin) {
    return {
      ok: false,
      reason: "cross_origin_redirect",
      status,
      location: redirectUrl.toString(),
      expected_next: expectedNext,
    };
  }
  if (redirectUrl.pathname !== "/login") {
    return {
      ok: false,
      reason: "not_login_redirect",
      status,
      location: redirectUrl.toString(),
      expected_next: expectedNext,
    };
  }
  if (next !== expectedNext) {
    return {
      ok: false,
      reason: "next_mismatch",
      status,
      location: redirectUrl.toString(),
      actual_next: next,
      expected_next: expectedNext,
    };
  }

  return {
    ok: true,
    reason: "verified",
    status,
    location: redirectUrl.toString(),
    expected_next: expectedNext,
  };
}

export function classifyLoginPage({ status, body }) {
  const hasLoginCopy = typeof body === "string" &&
    (body.includes("Googleでログイン") || body.includes("メールアドレスでログイン") || body.includes("反響対応を始める"));
  const hasNextShell = typeof body === "string" &&
    body.includes("<!DOCTYPE html>") &&
    body.includes("lang=\"ja\"") &&
    body.includes("/_next/static/");
  const hasLoginSurface = hasLoginCopy || hasNextShell;
  return {
    ok: status === 200 && hasLoginSurface,
    reason: status === 200 && hasLoginSurface ? "verified" : "login_page_unexpected",
    status,
    has_login_copy: hasLoginCopy,
    has_next_shell: hasNextShell,
  };
}

const UNSAFE_SUPPORT_AGGREGATE_KEYS = new Set([
  "address",
  "body",
  "comment",
  "customer_name",
  "display_name",
  "email",
  "lead_id",
  "line_user_id",
  "phone",
  "subject",
  "token",
]);

function findUnsafeKeys(value, path = []) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findUnsafeKeys(item, [...path, String(index)]));
  }
  return Object.entries(value).flatMap(([key, nested]) => {
    const normalized = key.toLowerCase();
    const here = UNSAFE_SUPPORT_AGGREGATE_KEYS.has(normalized)
      ? [[...path, key].join(".")]
      : [];
    return [...here, ...findUnsafeKeys(nested, [...path, key])];
  });
}

export function classifySupportAggregateRead({ status, body }, { withToken = false } = {}) {
  if (!withToken) {
    const ok = status === 401 && body?.error === "unauthorized" && body?.db === "not_touched";
    return {
      ok,
      reason: ok ? "fail_closed_unauthorized" : "expected_unauthorized_fail_closed",
      status,
      db: body?.db ?? null,
      error: body?.error ?? null,
    };
  }

  const unsafeKeys = findUnsafeKeys(body);
  const ok = status === 200 &&
    body?.service === "makxas-front" &&
    body?.domain === "support_aggregate" &&
    body?.status === "read_only" &&
    body?.privacy?.pii_returned === false &&
    body?.privacy?.free_text_returned === false &&
    body?.privacy?.aggregate_only === true &&
    body?.evidence?.query_mode === "read_only" &&
    unsafeKeys.length === 0;

  return {
    ok,
    reason: ok ? "verified_read_only_aggregate" : "unexpected_support_aggregate",
    status,
    domain: body?.domain ?? null,
    privacy: body?.privacy ?? null,
    unsafe_keys: unsafeKeys,
  };
}

async function fetchGet(url, { redirect = "manual", json = false, headers = {} } = {}) {
  const response = await fetch(url, {
    method: "GET",
    redirect,
    headers: {
      accept: json ? "application/json" : "text/html,application/json",
      "cache-control": "no-store",
      "user-agent": "makxas-front-verify-production/1.0",
      ...headers,
    },
  });
  if (json) {
    const body = await response.json().catch(() => null);
    return { status: response.status, body, location: response.headers.get("location") };
  }
  const body = await response.text().catch(() => "");
  return { status: response.status, body, location: response.headers.get("location") };
}

async function verifyProduction({ baseURL = process.env.FRONT_PRODUCTION_URL || DEFAULT_BASE_URL } = {}) {
  const baseUrl = normalizeBaseUrl(baseURL);
  const checks = [];

  const health = await fetchGet(`${baseUrl}/api/health`, { json: true });
  checks.push({ name: "health", ...classifyHealth(health) });

  const dashboard = await fetchGet(`${baseUrl}/dashboard`);
  checks.push({
    name: "auth_gate:/dashboard",
    ...classifyLoginRedirect({
      status: dashboard.status,
      location: dashboard.location,
      baseURL: baseUrl,
      expectedNext: "/dashboard",
    }),
  });

  const login = await fetchGet(`${baseUrl}/login?next=%2Fdashboard`, { redirect: "follow" });
  checks.push({ name: "login_page", ...classifyLoginPage(login) });

  const supportAggregateToken = process.env.FRONT_SUPPORT_AGGREGATE_VERIFY_TOKEN;
  const supportAggregate = await fetchGet(`${baseUrl}/api/support/aggregate`, {
    json: true,
    headers: supportAggregateToken
      ? { authorization: `Bearer ${supportAggregateToken}` }
      : {},
  });
  const supportAggregateCheck = classifySupportAggregateRead(
    supportAggregate,
    { withToken: Boolean(supportAggregateToken) },
  );
  checks.push({ name: "support_aggregate", ...supportAggregateCheck });

  const ok = checks.every((check) => check.ok);
  const supportAggregateDb = supportAggregateCheck.reason === "verified_read_only_aggregate"
    ? "read_only_aggregate"
    : "not_touched";
  return {
    ok,
    service: "makxas-front",
    production: ok ? "ok" : "failed",
    ui: checks.find((check) => check.name === "login_page")?.ok ? "login_page_ok" : "login_page_failed",
    function: checks.find((check) => check.name === "health")?.ok ? "health_ok" : "health_failed",
    db: supportAggregateDb,
    secret_pii: "ok",
    evidence: {
      base_url: baseUrl,
      checked_paths: ["/api/health", "/dashboard", "/login?next=%2Fdashboard", "/api/support/aggregate"],
      http_methods: ["GET"],
      write_requests: 0,
      external_ai_calls: 0,
      external_sends: 0,
      checks,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const report = await verifyProduction({ baseURL: process.argv[2] });
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      service: "makxas-front",
      production: "failed",
      ui: "unknown",
      function: "unknown",
      db: "not_touched",
      secret_pii: "ok",
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exit(1);
  }
}
