/**
 * GET /api/core/ping
 * マクサスコア（core-rails）への疎通確認エンドポイント
 * ローカル開発時の接続確認用
 */
import { NextResponse } from "next/server";
import { pingCoreRails } from "@/lib/core/sync";

export async function GET() {
  const result = await pingCoreRails();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
