import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Toast({
  description,
  onClose,
  title,
}: {
  description?: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed right-5 top-5 z-50 w-[360px] rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-950">{title}</p>
          {description ? (
            <p className="mt-1 leading-5 text-zinc-600">{description}</p>
          ) : null}
        </div>
        <Button
          aria-label="通知を閉じる"
          onClick={onClose}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
