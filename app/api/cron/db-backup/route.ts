/**
 * PR47: DB 日次バックアップ
 *
 * GET/POST /api/cron/db-backup
 *
 * 主要テーブルを JSONL 形式で Supabase Storage の 'backups' バケットに保存する。
 * 毎日 03:00 JST に Vercel Cron で実行される想定。
 *
 * 認証: CRON_SECRET 必須（requireApiAuth({ allowCronSecret: true })）
 *
 * 保存先: backups/<YYYY-MM-DD>/<table>.jsonl
 * 保持期間: 30日（それ以前は自動削除）
 *
 * 対象テーブル:
 *   leads, inquiries, messages, appointments, audit_logs,
 *   inquiry_items, inquiry_tags, core_sync_log, staff,
 *   appointments_view_token は除外（PII最小化）
 *
 * 注意: 月500件規模なので JSON 化のメモリ負荷は小さい。
 *       将来 100万行を超えたら pg_dump 移行を検討。
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/requireApiAuth";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const BACKUP_TABLES = [
  "leads",
  "inquiries",
  "messages",
  "appointments",
  "audit_logs",
  "inquiry_items",
  "inquiry_tags",
  "core_sync_log",
  "staff",
  "brands",
  "stores",
  "ai_call_queue",
  "api_usage_logs",
] as const;

const BUCKET = "backups";
const RETENTION_DAYS = 30;

async function ensureBucket(supabase: ReturnType<typeof createServiceClient>) {
  // バケットが存在しなければ作成（private）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storage = (supabase as any).storage;
  const { data: buckets } = await storage.listBuckets();
  const exists = (buckets ?? []).some((b: { name: string }) => b.name === BUCKET);
  if (!exists) {
    await storage.createBucket(BUCKET, { public: false });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  const auth = await requireApiAuth(req, { allowCronSecret: true });
  if (!auth.ok) return auth.response;

  const supabase = createServiceClient();
  try {
    await ensureBucket(supabase);
  } catch (e) {
    return NextResponse.json(
      { error: `bucket setup failed: ${e instanceof Error ? e.message : ""}` },
      { status: 500 },
    );
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const results: Record<string, { rows: number; bytes: number; error?: string }> = {};

  for (const table of BACKUP_TABLES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from(table).select("*").limit(50000);
      if (error) throw error;
      const rows = (data ?? []) as unknown[];
      const jsonl = rows.map((r) => JSON.stringify(r)).join("\n");
      const path = `${dateStr}/${table}.jsonl`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storage = (supabase as any).storage.from(BUCKET);
      const { error: upErr } = await storage.upload(path, jsonl, {
        contentType: "application/x-ndjson",
        upsert: true,
      });
      if (upErr) throw upErr;
      results[table] = { rows: rows.length, bytes: jsonl.length };
    } catch (e) {
      results[table] = {
        rows: 0,
        bytes: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // 古いバックアップを削除（30日より古い）
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  let deletedFolders = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = (supabase as any).storage.from(BUCKET);
    const { data: folders } = await storage.list("", { limit: 100 });
    for (const folder of (folders ?? []) as { name: string }[]) {
      if (folder.name < cutoffStr) {
        // フォルダ配下のファイルを列挙して削除
        const { data: files } = await storage.list(folder.name, { limit: 100 });
        const paths = (files ?? []).map((f: { name: string }) => `${folder.name}/${f.name}`);
        if (paths.length > 0) {
          await storage.remove(paths);
          deletedFolders++;
        }
      }
    }
  } catch {
    // 削除失敗は無視（次回再実行で削除される）
  }

  const totalRows = Object.values(results).reduce((a, r) => a + r.rows, 0);
  const totalBytes = Object.values(results).reduce((a, r) => a + r.bytes, 0);
  const errors = Object.entries(results).filter(([, r]) => r.error);

  return NextResponse.json({
    ok: errors.length === 0,
    date: dateStr,
    bucket: BUCKET,
    total_rows: totalRows,
    total_bytes: totalBytes,
    total_tables: BACKUP_TABLES.length,
    failed_tables: errors.length,
    deleted_old_folders: deletedFolders,
    retention_days: RETENTION_DAYS,
    by_table: results,
  });
}
