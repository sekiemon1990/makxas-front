import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DELIVERY_TARGET_TENANT_MISMATCH_ERROR,
  hasDeliveryTargetTenantMismatch,
  resolveRecipientOwnerTenantId,
  sendMultiChannel,
} from "./multi-channel";

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
    rememberEnv("RESEND_API_KEY");
    rememberEnv("TWILIO_ACCOUNT_SID");
    rememberEnv("TWILIO_AUTH_TOKEN");
    rememberEnv("TWILIO_FROM_NUMBER");
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "line-token";
    process.env.RESEND_API_KEY = "resend-token";
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
});

function rememberEnv(key: string): void {
  if (!originalEnv.has(key)) originalEnv.set(key, process.env[key]);
}
