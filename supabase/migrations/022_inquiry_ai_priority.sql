-- 022_inquiry_ai_priority.sql
-- 反響の AI 自動優先度スコアリング用カラム。
-- 既存 `priority` (手動) と分離するため別カラムとして追加する。
-- これにより:
--   - スタッフが手動で priority を設定済みなら AI で上書きしない（運用判断）
--   - AI 判定の理由・タイムスタンプを追跡可能

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS ai_priority TEXT
    CHECK (ai_priority IN ('high','medium','low')),
  ADD COLUMN IF NOT EXISTS ai_priority_score INTEGER
    CHECK (ai_priority_score IS NULL OR (ai_priority_score >= 0 AND ai_priority_score <= 100)),
  ADD COLUMN IF NOT EXISTS ai_priority_reason TEXT,
  ADD COLUMN IF NOT EXISTS ai_priority_set_at TIMESTAMPTZ;

-- 検索・ソート用インデックス
CREATE INDEX IF NOT EXISTS idx_inquiries_ai_priority
  ON public.inquiries(ai_priority)
  WHERE ai_priority IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_ai_priority_score
  ON public.inquiries(ai_priority_score DESC)
  WHERE ai_priority_score IS NOT NULL;

COMMENT ON COLUMN public.inquiries.ai_priority IS
  'AI が判定した優先度 (high/medium/low)。/api/ai/inquiry-priority が書き込む。';
COMMENT ON COLUMN public.inquiries.ai_priority_score IS
  'AI 優先度スコア 0-100 (細粒度ソート用)';
COMMENT ON COLUMN public.inquiries.ai_priority_reason IS
  'AI 判定の根拠（営業思想ベース: 売却動機 / 顧客属性 / 高単価カテゴリ言及）';
