-- PR39: LINE リッチメニュー管理
--
-- ブランド（stores）ごとに LINE リッチメニューを管理。
-- 各リッチメニューは LINE 側で作成済みで、ここではその ID と
-- ブランド/利用シーンの紐付けだけを保持する。

CREATE TABLE IF NOT EXISTS line_rich_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  -- LINE 側のリッチメニュー ID (richmenu-xxxxxxxx)
  line_rich_menu_id TEXT NOT NULL,
  -- 表示名 (社内識別用)
  name TEXT NOT NULL,
  -- このメニューを適用するシーン
  -- "default": 新規友達追加時の既定
  -- "after_purchase": 査定完了後 (リピート促進)
  -- "campaign": キャンペーン期間中
  scene TEXT NOT NULL DEFAULT 'default',
  -- LINE 側で設定済みのエリア定義などのメタデータ
  metadata JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, scene, line_rich_menu_id)
);

CREATE INDEX IF NOT EXISTS idx_line_rich_menus_store_scene
  ON line_rich_menus(store_id, scene, is_active);

ALTER TABLE line_rich_menus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON line_rich_menus;
CREATE POLICY "authenticated_all" ON line_rich_menus FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.line_rich_menus TO anon, authenticated, service_role;
