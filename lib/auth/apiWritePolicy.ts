import type { Database } from "@/types/database";

export type StaffRole = Database["public"]["Tables"]["staff"]["Row"]["role"];

const ROLE_RANK: Record<StaffRole, number> = {
  super_admin: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const SIDE_EFFECT_GET_PREFIXES = [
  "/api/calendar/connect",
  "/api/calendar/callback",
  "/api/gmail/connect",
  "/api/gmail/callback",
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canWriteWithRole(
  role: StaffRole | null | undefined,
  requiredRole: StaffRole = "operator",
): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[requiredRole];
}

export function isApiWriteGuardTarget(opts: {
  pathname: string;
  method: string;
  skipsMiddlewareAuth: boolean;
}): boolean {
  if (opts.skipsMiddlewareAuth) return false;
  if (!opts.pathname.startsWith("/api/")) return false;
  if (WRITE_METHODS.has(opts.method.toUpperCase())) return true;
  return SIDE_EFFECT_GET_PREFIXES.some((prefix) =>
    matchesPrefix(opts.pathname, prefix),
  );
}
