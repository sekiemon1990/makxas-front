import { createMakxasServerClient } from "@makxas/supabase-next";

import type { Database } from "@/types/database";

export async function createClient() {
  return createMakxasServerClient<Database>();
}
