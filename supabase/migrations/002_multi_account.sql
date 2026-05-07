-- 店舗テーブル（全チャンネルの親）
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  store_code TEXT UNIQUE,
  store_type TEXT NOT NULL DEFAULT 'fc' CHECK (store_type IN ('direct','fc')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LINEアカウント（店舗ごと）
CREATE TABLE line_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  channel_secret TEXT NOT NULL,
  channel_access_token TEXT NOT NULL,
  destination TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- メールアカウント（店舗ごと）
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  provider TEXT NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail','other')),
  purpose TEXT NOT NULL DEFAULT 'inquiry' CHECK (purpose IN ('inquiry','reply')),
  oauth_tokens JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 比較サイトアカウント（店舗ごと）
CREATE TABLE comparison_site_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  site TEXT NOT NULL CHECK (site IN ('oikura','uridoki','hikakaku')),
  account_email TEXT,
  notification_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, site)
);

-- 電話番号（店舗ごと、Phase 2）
CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  twilio_sid TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- スタッフの店舗アクセス権
CREATE TABLE staff_store_access (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, store_id)
);

-- inquiriesに店舗・チャンネル紐付けを追加
ALTER TABLE inquiries ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE inquiries ADD COLUMN line_account_id UUID REFERENCES line_accounts(id) ON DELETE SET NULL;
ALTER TABLE inquiries ADD COLUMN email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL;
ALTER TABLE inquiries ADD COLUMN comparison_account_id UUID REFERENCES comparison_site_accounts(id) ON DELETE SET NULL;

-- staffのroleにsuper_adminを追加
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('super_admin','admin','operator','viewer'));

-- RLS有効化
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_site_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_store_access ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "authenticated_all" ON stores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON line_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON email_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON comparison_site_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON phone_numbers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON staff_store_access FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- GRANT
GRANT ALL ON TABLE public.stores TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.line_accounts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.email_accounts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.comparison_site_accounts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.phone_numbers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.staff_store_access TO anon, authenticated, service_role;
