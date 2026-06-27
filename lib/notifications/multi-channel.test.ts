import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DELIVERY_TARGET_TENANT_MISMATCH_ERROR,
  hasDeliveryTargetTenantMismatch,
  resolveRecipientOwnerTenantId,
  sendMultiChannel,
} from "./multi-channel";

const GATEWAY_COMMS_URL = "https://gateway.example/v1/comms/send/resend_transactional";

const pushMessage = vi.fn();
const originalEnv = new Map<string, string | undefined>();

vi.mock("@line/bot-sdk", () => ({
  messagingApi: {
    MessagingApiClient: vi.fn(() => ({ pushMessage })),
  },
}));

describe("multi-channel delivery target tenant boundary", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    originalEnv.clear();
    global.fetch = originalFetch;
    pushMessage.mockReset();
    vi.restoreAllMocks();
  });

  it("resolves owner tenant from explicit target, contact, lead, then current tenant", () => {
    expect(resolveRecipientOwnerTenantId({
      tenantId: "tenant-a",
      leadTenantId: "tenant-lead",
      contactOwnerTenantId: "tenant-contact",
      deliveryTargetOwnerTenantId: "tenant-explicit",
    })).toBe("tenant-explicit");
    expect(resolveRecipientOwnerTenantId({
      tenantId: "tenant-a",
      leadTenantId: "tenant-lead",
      contactOwnerTenantId: "tenant-contact",
    })).toBe("tenant-contact");
    expect(resolveRecipientOwnerTenantId({
      tenantId: "tenant-a",
      leadTenantId: "tenant-lead",
    })).toBe("tenant-lead");
    expect(resolveRecipientOwnerTenantId({ tenantId: "tenant-a" })).toBe("tenant-a");
  });

  it("detects tenant mismatch before customer contact sends", () => {
    expect(hasDeliveryTargetTenantMismatch({
      tenantId: "tenant-a",
      leadTenantId: "tenant-a",
      contactOwnerTenantId: "tenant-b",
    })).toBe(true);
    expect(hasDeliveryTargetTenantMismatch({
      tenantId: "tenant-a",
      leadTenantId: "tenant-a",
      contactOwnerTenantId: "tenant-a",
    })).toBe(false);
  });

  it("returns no-send errors for every channel before LINE, email, or SMS calls", async () => {
    rememberEnv("LINE_CHANNEL_ACCESS_TOKEN");
    rememberEnv("MAKXAS_INTEGRATIONS_GATEWAY_URL");
    rememberEnv("MAKXAS_COMMS_GATEWAY_TOKEN");
    rememberEnv("TWILIO_ACCOUNT_SID");
    rememberEnv("TWILIO_AUTH_TOKEN");
    rememberEnv("TWILIO_FROM_NUMBER");
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "line-token";
    process.env.MAKXAS_INTEGRATIONS_GATEWAY_URL = "https://gateway.example";
    process.env.MAKXAS_COMMS_GATEWAY_TOKEN = "gw-token";
    process.env.TWILIO_ACCOUNT_SID = "twilio-sid";
    process.env.TWILIO_AUTH_TOKEN = "twilio-token";
    process.env.TWILIO_FROM_NUMBER = "+819012345678";
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    global.fetch = fetchMock as typeof fetch;

    const result = await sendMultiChannel(
      "[AIテスト] hello",
      ["line", "email", "sms"],
      {
        tenantId: "tenant-a",
        leadTenantId: "tenant-a",
        contactOwnerTenantId: "tenant-b",
        lineUserId: "U123",
        email: "customer@example.com",
        phone: "090-1111-2222",
      },
    );

    expect(result).toEqual([
      { channel: "line", ok: false, error: DELIVERY_TARGET_TENANT_MISMATCH_ERROR },
      { channel: "email", ok: false, error: DELIVERY_TARGET_TENANT_MISMATCH_ERROR },
      { channel: "sms", ok: false, error: DELIVERY_TARGET_TENANT_MISMATCH_ERROR },
    ]);
    expect(pushMessage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends email via Gateway comms resend_transactional channel", async () => {
    rememberEnv("MAKXAS_INTEGRATIONS_GATEWAY_URL");
    rememberEnv("MAKXAS_COMMS_GATEWAY_TOKEN");
    process.env.MAKXAS_INTEGRATIONS_GATEWAY_URL = "https://gateway.example";
    process.env.MAKXAS_COMMS_GATEWAY_TOKEN = "gw-token";
    const fetchMock = vi.fn(async () => Response.json({ ok: true, provider_request_id: "re_xxx" }));
    global.fetch = fetchMock as typeof fetch;

    const result = await sendMultiChannel(
      "テストメッセージ",
      ["email"],
      { email: "customer@example.com", emailFrom: "テスト <test@makxas.com>", emailSubject: "件名" },
    );

    expect(result).toEqual([{ channel: "email", ok: true }]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(GATEWAY_COMMS_URL);
    const body = JSON.parse(init!.body as string);
    expect(body).toEqual({
      recipient: { kind: "email_address", id: "customer@example.com" },
      message: { from: "テスト <test@makxas.com>", subject: "件名", text: "テストメッセージ" },
    });
    expect((init!.headers as Record<string, string>)["authorization"]).toBe("Bearer gw-token");
  });

  it("returns error when Gateway env is not set for email", async () => {
    rememberEnv("MAKXAS_INTEGRATIONS_GATEWAY_URL");
    rememberEnv("MAKXAS_COMMS_GATEWAY_TOKEN");
    rememberEnv("MAKXAS_GATEWAY_API_KEY_MAKXAS_FRONT");
    rememberEnv("MAKXAS_INTEGRATIONS_GATEWAY_TOKEN");
    delete process.env.MAKXAS_INTEGRATIONS_GATEWAY_URL;
    delete process.env.MAKXAS_COMMS_GATEWAY_TOKEN;
    delete process.env.MAKXAS_GATEWAY_API_KEY_MAKXAS_FRONT;
    delete process.env.MAKXAS_INTEGRATIONS_GATEWAY_TOKEN;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const result = await sendMultiChannel("msg", ["email"], { email: "a@example.com" });

    expect(result[0]).toMatchObject({ channel: "email", ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function rememberEnv(key: string): void {
  if (!originalEnv.has(key)) originalEnv.set(key, process.env[key]);
}
