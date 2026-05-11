import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 30;

type ConnectionRow = {
  id: string;
  staff_id: string;
  google_account_email: string;
  access_token: string | null;
  refresh_token: string;
  token_expiry: string | null;
  calendar_id: string;
  next_sync_token: string | null;
};

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`,
  );
}

/**
 * Google Calendar をインクリメンタル同期する
 *
 * - 初回（next_sync_token が null）: 過去1ヶ月〜先 daysAhead 日分を全件取得
 * - 2回目以降: next_sync_token を使って追加・変更・削除の差分のみ取得
 *   → 削除されたイベントは status: "cancelled" で返るので DB からも削除
 *   → 変更されたイベントは upsert で上書き
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    staff_id?: string;    // 省略時は全 FS スタッフを同期
    days_ahead?: number;  // 初回同期で何日先まで取得するか（デフォルト 90 日）
    full_sync?: boolean;  // true なら syncToken を無視してフル同期
  };

  const service = createServiceClient();
  const daysAhead = body.days_ahead ?? 90;

  // 対象の連携設定を取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let connQuery = (service as any)
    .from("google_calendar_connections")
    .select("id, staff_id, google_account_email, access_token, refresh_token, token_expiry, calendar_id, next_sync_token")
    .eq("sync_enabled", true);

  if (body.staff_id) connQuery = connQuery.eq("staff_id", body.staff_id);

  const { data: connections, error: connError } = await connQuery as {
    data: ConnectionRow[] | null;
    error: { message: string } | null;
  };
  if (connError) return NextResponse.json({ error: connError.message }, { status: 500 });

  const results: { staff_id: string; email: string; synced: number; deleted: number; error?: string }[] = [];

  for (const conn of (connections ?? [])) {
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: conn.access_token ?? undefined,
        refresh_token: conn.refresh_token,
        expiry_date: conn.token_expiry ? new Date(conn.token_expiry).getTime() : undefined,
      });

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });
      const isIncremental = !body.full_sync && !!conn.next_sync_token;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let allItems: any[] = [];
      let nextSyncToken: string | undefined;
      let pageToken: string | undefined;

      // ページネーション込みで全差分を取得
      do {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const params: Record<string, unknown> = {
            calendarId: conn.calendar_id,
            maxResults: 250,
            singleEvents: true,
            showDeleted: true,
            ...(isIncremental
              ? { syncToken: conn.next_sync_token }
              : {
                  timeMin: new Date(Date.now() - 30 * 86400000).toISOString(),
                  timeMax: new Date(Date.now() + daysAhead * 86400000).toISOString(),
                  orderBy: "startTime",
                }),
            ...(pageToken ? { pageToken } : {}),
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await (calendar.events.list as (p: Record<string, unknown>) => Promise<{ data: { items?: unknown[]; nextSyncToken?: string; nextPageToken?: string } }>)(params);
          allItems = [...allItems, ...(res.data.items ?? [])];
          nextSyncToken = res.data.nextSyncToken ?? undefined;
          pageToken = res.data.nextPageToken ?? undefined;
        } catch (err: unknown) {
          // 410 Gone: syncToken が古い → フルリセットして再試行
          const status = (err as { code?: number }).code;
          if (status === 410 && isIncremental) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (service as any).from("google_calendar_connections").update({
              next_sync_token: null,
              updated_at: new Date().toISOString(),
            }).eq("id", conn.id);
            results.push({ staff_id: conn.staff_id, email: conn.google_account_email, synced: 0, deleted: 0, error: "sync_token_expired_retry" });
            break;
          }
          throw err;
        }
      } while (pageToken);

      let synced = 0;
      let deleted = 0;

      for (const event of (allItems ?? [])) {
        if (!event.id) continue;

        if (event.status === "cancelled") {
          // 削除・キャンセルされたイベントを DB からも削除
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (service as any)
            .from("calendar_events")
            .delete()
            .eq("staff_id", conn.staff_id)
            .eq("google_event_id", event.id);
          if (!error) deleted++;
          continue;
        }

        if (!event.start || !event.end) continue;

        const allDay = Boolean(event.start.date && !event.start.dateTime);
        const startAt = event.start.dateTime ?? `${event.start.date}T00:00:00+09:00`;
        const endAt   = event.end.dateTime   ?? `${event.end.date}T23:59:59+09:00`;
        const status  = event.status === "tentative" ? "tentative" : "confirmed";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (service as any).from("calendar_events").upsert({
          staff_id: conn.staff_id,
          google_event_id: event.id,
          title: event.summary ?? null,
          start_at: startAt,
          end_at: endAt,
          all_day: allDay,
          status,
          location: event.location ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "staff_id,google_event_id" });

        if (!error) synced++;
      }

      // 次回インクリメンタル同期用に syncToken を保存
      const newCreds = oauth2Client.credentials;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (service as any).from("google_calendar_connections").update({
        ...(newCreds.access_token && newCreds.access_token !== conn.access_token
          ? {
              access_token: newCreds.access_token,
              token_expiry: newCreds.expiry_date ? new Date(newCreds.expiry_date).toISOString() : null,
            }
          : {}),
        ...(nextSyncToken ? { next_sync_token: nextSyncToken } : {}),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", conn.id);

      results.push({ staff_id: conn.staff_id, email: conn.google_account_email, synced, deleted });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ staff_id: conn.staff_id, email: conn.google_account_email, synced: 0, deleted: 0, error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    results,
    total_synced: results.reduce((acc, r) => acc + r.synced, 0),
    total_deleted: results.reduce((acc, r) => acc + r.deleted, 0),
  });
}
