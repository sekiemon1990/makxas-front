import { Badge } from "@/components/ui/badge";
import { channelMeta, statusMeta } from "@/lib/inquiry-options";
import { cn } from "@/lib/utils";
import type { InquiryChannel, InquiryStatus } from "@/types/database";

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
    <Badge variant="outline" className={cn("rounded-md", meta.className)}>
      {meta.label}
    </Badge>
  );
}
