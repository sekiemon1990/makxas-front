'use client';

import { AiWidget } from '@makxas/ai-kit/widget';

export function FrontCopilotWidget() {
  return (
    <AiWidget
      endpoint="/api/copilot/stream"
      agentSlug="front-copilot"
      mode="floating"
      title="コパイロット"
      placeholder="何でも聞いてください（Shift+Enter で改行）"
    />
  );
}
