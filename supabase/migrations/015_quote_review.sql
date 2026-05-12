-- staff: 査定要確認フラグ
ALTER TABLE staff ADD COLUMN IF NOT EXISTS requires_quote_review BOOLEAN NOT NULL DEFAULT false;

-- inquiry_items: 査定確認ステータス
ALTER TABLE inquiry_items ADD COLUMN IF NOT EXISTS quote_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (quote_status IN ('pending', 'approved', 'needs_correction'));
ALTER TABLE inquiry_items ADD COLUMN IF NOT EXISTS quote_reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE inquiry_items ADD COLUMN IF NOT EXISTS quote_reviewed_at TIMESTAMPTZ;
ALTER TABLE inquiry_items ADD COLUMN IF NOT EXISTS quote_review_note TEXT;
