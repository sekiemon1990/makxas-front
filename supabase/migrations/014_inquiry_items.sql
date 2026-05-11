-- inquiry_items: 顧客から送られた商品情報の構造化データ
CREATE TABLE IF NOT EXISTS inquiry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- 基本情報
  item_name TEXT NOT NULL,
  brand TEXT,
  model_number TEXT,
  condition TEXT CHECK (condition IN ('N', 'S', 'A', 'B', 'C', 'D', 'J', '不明', 'その他')),
  accessories TEXT,

  -- 見込金額（スタッフが入力）
  estimated_price_min INTEGER,
  estimated_price_max INTEGER,

  -- 事前査定金額（4パターン: upper/around/exact/range）
  quote_type TEXT CHECK (quote_type IN ('upper', 'around', 'exact', 'range')),
  quote_price_min INTEGER,
  quote_price_max INTEGER,

  notes TEXT,

  -- メタ
  ai_extracted BOOLEAN NOT NULL DEFAULT false,
  source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inquiry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON inquiry_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.inquiry_items TO anon, authenticated, service_role;

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_inquiry_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inquiry_items_updated_at
  BEFORE UPDATE ON inquiry_items
  FOR EACH ROW EXECUTE FUNCTION update_inquiry_items_updated_at();
