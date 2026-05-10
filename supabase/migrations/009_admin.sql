-- 管理画面用テーブル

-- タグマスター（インボックスで使用するタグの定義）
CREATE TABLE tag_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6b7280',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tag_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON tag_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.tag_master TO anon, authenticated, service_role;

-- 既存 inquiry_tags から tag_master へシード（重複なし）
INSERT INTO tag_master (name, sort_order)
SELECT DISTINCT tag, ROW_NUMBER() OVER (ORDER BY tag) - 1
FROM inquiry_tags
ON CONFLICT (name) DO NOTHING;

-- 自動振り分けルール（チャンネル・キーワードで担当者を自動アサイン）
CREATE TABLE assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel inquiry_channel,           -- NULL = 全チャンネル対象
  keyword TEXT,                       -- NULL = キーワード不問
  assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE assignment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON assignment_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.assignment_rules TO anon, authenticated, service_role;
