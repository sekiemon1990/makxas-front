import { Badge } from "@/components/ui/badge";
import { channelMeta, statusMeta } from "@/lib/inquiry-options";
import { cn } from "@/lib/utils";
import type { InquiryChannel, InquiryStatus } from "@/types/database";

/** ステータスのツールチップ説明（UI/UXレビュー B2） */
const STATUS_DESCRIPTIONS: Record<InquiryStatus, string> = {
  new: "未対応・スタッフが見るべき反響",
  in_progress: "スタッフが返信中・継続フォロー中",
  pending: "顧客の返答待ちなど一時保留",
  appointment_set: "アポ確定済み・コアへの引き継ぎ予定",
  transferred: "マクサスコアに引き継ぎ完了",
  lost: "失注で終了",
  closed: "クローズ済み",
};

export function ChannelBadge({
  channel,
  showLabel = false,
}: {
  channel: InquiryChannel;
  showLabel?: boolean;
}) {
  const meta = channelMeta[channel];

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-bold",
          meta.className,
        )}
      >
        {meta.shortLabel}
      </span>
      {showLabel ? <span className="text-sm text-zinc-600">{meta.label}</span> : null}
    </span>
  );
}

export function StatusBadge({ status }: { status: InquiryStatus }) {
  const meta = statusMeta[status];

  return (
    <Badge
      variant="outline"
      className={cn("rounded-md", meta.className)}
      title={STATUS_DESCRIPTIONS[status]}
    >
      {meta.label}
    </Badge>
  );
}
