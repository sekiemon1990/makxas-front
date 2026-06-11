import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cw,
  hasChatworkGatewayEnv,
  notifyChatwork,
  sendChatworkMessageOrSkip,
} from "./chatwork";

const ENV_KEYS = [
  "MAKXAS_INTEGRATIONS_GATEWAY_URL",
  "MAKXAS_COMMS_GATEWAY_TOKEN",
  "MAKXAS_GATEWAY_API_KEY_MAKXAS_FRONT",
  "MAKXAS_INTEGRATIONS_GATEWAY_TOKEN",
  "MAKXAS_COMMS_CHATWORK_CHANNEL_ID",
  "MAKXAS_COMMS_CHATWORK_ROOM_ID",
  "CHATWORK_ROOM_ID",
  "MAKXAS_COMMS_DRY_RUN",
] as const;

describe("Gateway Chatwork helper", () => {
  const originalEnv = new Map<string, string | undefined>();
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    console.error = vi.fn();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = originalFetch;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it("keeps Chatwork notation helpers locally", () => {
    expect(cw.to("123")).toBe("[To:123]");
    expect(cw.code("npm test")).toBe("[code]npm test[/code]");
    expect(cw.info({ title: "通知", body: "本文" })).toBe(
      "[info][title]通知[/title]本文[/info]",
    );
  });

  it("sends messages through Gateway Comms Send", async () => {
    process.env.MAKXAS_INTEGRATIONS_GATEWAY_URL = "https://gateway.example";
    process.env.MAKXAS_COMMS_GATEWAY_TOKEN = "test-token";
    process.env.MAKXAS_COMMS_CHATWORK_CHANNEL_ID = "chatwork_front";
    process.env.MAKXAS_COMMS_CHATWORK_ROOM_ID = "987";

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ ok: true, provider_request_id: "cw-message-1" }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(sendChatworkMessageOrSkip("hello")).resolves.toEqual({
      ok: true,
      messageId: "cw-message-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gateway.example/v1/comms/send/chatwork_front",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-token",
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          recipient: { kind: "chatwork_room_id", id: "987" },
          message: { type: "text", text: "hello" },
        }),
      }),
    );
  });

  it("returns a compatible error when Gateway env is missing", async () => {
    expect(hasChatworkGatewayEnv()).toBe(false);
    await expect(sendChatworkMessageOrSkip("hello")).resolves.toEqual({
      ok: false,
      error: "Gateway comms env vars not set",
    });
  });

  it("keeps notifyChatwork non-throwing for business routes", async () => {
    await expect(notifyChatwork("hello")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[gateway-comms] notify failed:",
      "Gateway comms env vars not set",
    );
  });
});
