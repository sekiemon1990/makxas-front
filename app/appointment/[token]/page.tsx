/**
 * PR37: 顧客向けアポ照会画面
 *
 * /appointment/[token] - リードに送付するURLで、ログイン不要でアポ詳細を確認できる
 * 公開ページ。トークンは appointments.view_token（UUID）。
 *
 * 表示項目: 日時・場所・品目・訪問/宅配・担当者・追加品確認状況
 * 顧客には変更操作はさせず、変更希望は連絡を促す。
 */
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  item_category: string | null;
  item_description: string | null;
  address: string | null;
  preferred_method: "visit" | "delivery" | null;
  status: string;
  additional_items_confirmed: Record<string, boolean> | null;
  staff: { name: string | null } | null;
  leads: { display_name: string | null } | null;
  inquiries: { brands: { name: string | null } | null } | null;
};

const METHOD_LABEL: Record<string, string> = {
  visit: "出張買取（訪問）",
  delivery: "宅配買取",
};

const STATUS_BANNER: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  confirmed: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", label: "ご予約確定", emoji: "✓" },
  tentative: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", label: "仮予約", emoji: "⏳" },
  completed: { bg: "bg-zinc-50 border-zinc-200", text: "text-zinc-700", label: "査定完了", emoji: "✓" },
  cancelled: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "キャンセル済", emoji: "✕" },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${wd}）${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function PublicAppointmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // UUID 形式チェック
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    notFound();
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, item_category, item_description, address, preferred_method, status, additional_items_confirmed, staff:staff_id(name), leads(display_name), inquiries(brands(name))",
    )
    .eq("view_token", token)
    .maybeSingle();

  if (!data) notFound();
  const appt = data as unknown as AppointmentRow;
  const banner = STATUS_BANNER[appt.status] ?? STATUS_BANNER.confirmed;

  const confirmedCategories = appt.additional_items_confirmed
    ? Object.entries(appt.additional_items_confirmed)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    : [];

  const brandName = appt.inquiries?.brands?.name ?? "買取マクサス";

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-4 py-8">
      <div className="mx-auto max-w-md">
        {/* ヘッダー */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-zinc-900">{brandName}</h1>
          <p className="mt-1 text-xs text-zinc-500">出張買取のご予約内容</p>
        </div>

        {/* ステータスバナー */}
        <div className={`mt-6 rounded-xl border-2 ${banner.bg} px-4 py-3 text-center`}>
          <p className={`text-sm font-bold ${banner.text}`}>
            {banner.emoji} {banner.label}
          </p>
        </div>

        {/* 顧客名 */}
        {appt.leads?.display_name ? (
          <p className="mt-4 text-sm text-zinc-700">
            <span className="font-medium">{appt.leads.display_name} 様</span>
          </p>
        ) : null}

        {/* メイン情報カード */}
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white shadow-sm divide-y divide-zinc-100">
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">日時</p>
            <p className="mt-1 text-lg font-bold text-zinc-900">{formatDateTime(appt.scheduled_at)}</p>
          </div>
          {appt.preferred_method ? (
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">買取方法</p>
              <p className="mt-1 text-sm font-medium text-zinc-800">
                {METHOD_LABEL[appt.preferred_method] ?? appt.preferred_method}
              </p>
            </div>
          ) : null}
          {appt.address ? (
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">訪問先住所</p>
              <p className="mt-1 text-sm text-zinc-800">{appt.address}</p>
            </div>
          ) : null}
          {appt.item_category ? (
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">主な品目</p>
              <p className="mt-1 text-sm text-zinc-800">{appt.item_category}</p>
            </div>
          ) : null}
          {appt.item_description ? (
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">品物の詳細</p>
              <p className="mt-1 text-sm text-zinc-800 whitespace-pre-wrap">{appt.item_description}</p>
            </div>
          ) : null}
          {appt.staff?.name ? (
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">担当スタッフ</p>
              <p className="mt-1 text-sm font-medium text-zinc-800">{appt.staff.name}</p>
            </div>
          ) : null}
        </div>

        {/* 追加品確認状況 */}
        {confirmedCategories.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
            <p className="text-xs font-semibold text-amber-900">当日ご確認予定の追加品</p>
            <ul className="mt-1.5 space-y-0.5">
              {confirmedCategories.map((c) => (
                <li key={c} className="text-xs text-amber-900">
                  ✓ {c}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-amber-700">
              ※ ご不要な品物があれば当日まとめて拝見させていただきます
            </p>
          </div>
        ) : null}

        {/* 変更希望の案内 */}
        {appt.status !== "cancelled" && appt.status !== "completed" ? (
          <div className="mt-6 rounded-xl bg-zinc-100 px-4 py-3 text-center">
            <p className="text-xs text-zinc-700">日時・住所等の変更をご希望の場合は</p>
            <p className="mt-1 text-xs text-zinc-700">お問い合わせいただいた窓口までご連絡ください</p>
          </div>
        ) : null}

        <p className="mt-8 text-center text-[10px] text-zinc-400">
          このページは {brandName} の予約専用ページです
        </p>
      </div>
    </div>
  );
}
