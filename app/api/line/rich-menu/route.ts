/**
 * PR39: LINE リッチメニュー管理 API
 *
 * GET /api/line/rich-menu?store_id=...  → LINE 側の既存メニュー一覧
 * POST /api/line/rich-menu              → DB に登録（既存メニューを makxas-front で管理対象に追加）
 * PATCH /api/line/rich-menu             → 既定変更（scene='default' で is_active 切替）
 * DELETE /api/line/rich-menu?id=...     → 登録解除
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/requireApiAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { listRichMenus, setDefaultRichMenu } from "@/lib/line/rich-menu";

export const runtime = "nodejs";

async function getStoreToken(supabase: ReturnType<typeof createServiceClient>, storeId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("stores")
    .select("line_channel_access_token")
    .eq("id", storeId)
    .maybeSingle();
  return data?.line_channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN ?? null;
}

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  const storeId = req.nextUrl.searchParams.get("store_id");
  if (!storeId) {
    return NextResponse.json({ error: "store_id required" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const token = await getStoreToken(supabase, storeId);
  if (!token) {
    return NextResponse.json({ error: "LINE channel access token not configured" }, { status: 400 });
  }

  try {
    const [lineMenus, dbMenusRes] = await Promise.all([
      listRichMenus(token),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("line_rich_menus").select("*").eq("store_id", storeId),
    ]);
    return NextResponse.json({
      ok: true,
      line_menus: lineMenus,
      registered: dbMenusRes.data ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "list failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as {
    store_id?: string;
    line_rich_menu_id?: string;
    name?: string;
    scene?: string;
  } | null;
  if (!body?.store_id || !body.line_rich_menu_id || !body.name) {
    return NextResponse.json({ error: "store_id/line_rich_menu_id/name required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("line_rich_menus")
    .insert({
      store_id: body.store_id,
      line_rich_menu_id: body.line_rich_menu_id,
      name: body.name,
      scene: body.scene ?? "default",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, menu: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as {
    store_id?: string;
    line_rich_menu_id?: string;
  } | null;
  if (!body?.store_id || !body.line_rich_menu_id) {
    return NextResponse.json({ error: "store_id/line_rich_menu_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const token = await getStoreToken(supabase, body.store_id);
  if (!token) {
    return NextResponse.json({ error: "LINE token not configured" }, { status: 400 });
  }

  try {
    await setDefaultRichMenu(token, body.line_rich_menu_id);
    return NextResponse.json({ ok: true, default_set: body.line_rich_menu_id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "set default failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("line_rich_menus").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
