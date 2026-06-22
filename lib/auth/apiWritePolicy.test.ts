import { describe, expect, it } from "vitest";

import {
  canWriteWithRole,
  isApiWriteGuardTarget,
} from "./apiWritePolicy";

describe("api write policy", () => {
  it("社内APIのPOST/PATCH/DELETEは書き込みガード対象にする", () => {
    expect(
      isApiWriteGuardTarget({
        pathname: "/api/inquiries/abc/status",
        method: "PATCH",
        skipsMiddlewareAuth: false,
      }),
    ).toBe(true);
    expect(
      isApiWriteGuardTarget({
        pathname: "/api/messages",
        method: "POST",
        skipsMiddlewareAuth: false,
      }),
    ).toBe(true);
    expect(
      isApiWriteGuardTarget({
        pathname: "/api/leads/abc/contacts",
        method: "DELETE",
        skipsMiddlewareAuth: false,
      }),
    ).toBe(true);
  });

  it("公開フォーム・Webhook・cronなどmiddleware認証を委譲した経路は対象外にする", () => {
    expect(
      isApiWriteGuardTarget({
        pathname: "/api/webhooks/form",
        method: "POST",
        skipsMiddlewareAuth: true,
      }),
    ).toBe(false);
    expect(
      isApiWriteGuardTarget({
        pathname: "/api/cron/db-backup",
        method: "POST",
        skipsMiddlewareAuth: true,
      }),
    ).toBe(false);
    expect(
      isApiWriteGuardTarget({
        pathname: "/api/auth/password",
        method: "POST",
        skipsMiddlewareAuth: true,
      }),
    ).toBe(false);
  });

  it("OAuth接続開始とcallbackはGETでも外部連携書き込みとして扱う", () => {
    expect(
      isApiWriteGuardTarget({
        pathname: "/api/gmail/connect",
        method: "GET",
        skipsMiddlewareAuth: false,
      }),
    ).toBe(true);
    expect(
      isApiWriteGuardTarget({
        pathname: "/api/calendar/callback",
        method: "GET",
        skipsMiddlewareAuth: false,
      }),
    ).toBe(true);
  });

  it("閲覧GETとAPI以外のURLは対象外にする", () => {
    expect(
      isApiWriteGuardTarget({
        pathname: "/api/leads/list",
        method: "GET",
        skipsMiddlewareAuth: false,
      }),
    ).toBe(false);
    expect(
      isApiWriteGuardTarget({
        pathname: "/inbox",
        method: "POST",
        skipsMiddlewareAuth: false,
      }),
    ).toBe(false);
  });

  it("viewerは拒否しoperator以上だけ変更を許可する", () => {
    expect(canWriteWithRole("viewer")).toBe(false);
    expect(canWriteWithRole("operator")).toBe(true);
    expect(canWriteWithRole("admin")).toBe(true);
    expect(canWriteWithRole("super_admin")).toBe(true);
    expect(canWriteWithRole(null)).toBe(false);
  });
});
