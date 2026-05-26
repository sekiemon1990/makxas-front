"use client";

import { createMakxasBrowserClient } from "@makxas/supabase-next";

import type { Database } from "@/types/database";

export function createClient() {
  return createMakxasBrowserClient<Database>();
}
