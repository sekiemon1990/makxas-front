import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "makxas-front",
    status: "ok",
    db: "not_touched",
  });
}
