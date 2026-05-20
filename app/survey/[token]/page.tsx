/**
 * PR42: CSAT アンケート公開ページ
 *
 * /survey/[token] - リードが回答する公開ページ。トークン認証。
 */
import { notFound } from "next/navigation";
import { CsatForm } from "./CsatForm";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CsatSurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();

  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("appointments")
    .select(
      "id, csat_score, csat_responded_at, inquiry:inquiry_id(brands(name)), lead:lead_id(display_name)",
    )
    .eq("csat_token", token)
    .maybeSingle();

  if (!data) notFound();

  const brandName = data.inquiry?.brands?.name ?? "買取マクサス";
  const customerName = data.lead?.display_name ?? null;
  const alreadyResponded = !!data.csat_responded_at;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <h1 className="text-xl font-bold text-zinc-900">{brandName}</h1>
          <p className="mt-1 text-xs text-zinc-500">サービス満足度アンケート</p>
        </div>

        {customerName ? (
          <p className="mt-4 text-sm text-zinc-700">
            <span className="font-medium">{customerName} 様</span>
          </p>
        ) : null}

        {alreadyResponded ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-2xl">✓</p>
            <p className="mt-2 text-sm font-semibold text-emerald-800">
              ご回答ありがとうございました
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              いただいたご意見はサービス改善に活用させていただきます
            </p>
          </div>
        ) : (
          <CsatForm token={token} />
        )}

        <p className="mt-8 text-center text-[10px] text-zinc-400">
          このページは {brandName} のアンケート専用ページです
        </p>
      </div>
    </div>
  );
}
