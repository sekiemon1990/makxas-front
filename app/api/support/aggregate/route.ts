import { NextResponse } from "next/server";

import {
  authorizeSupportAggregateRead,
  buildSupportAggregateReport,
} from "@/lib/support/aggregate";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = authorizeSupportAggregateRead(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        service: "makxas-front",
        domain: "support_aggregate",
        error: auth.code,
        db: "not_touched",
        external_sends: 0,
      },
      { status: auth.status },
    );
  }

  const report = await buildSupportAggregateReport(createServiceClient());
  return NextResponse.json(report);
}
