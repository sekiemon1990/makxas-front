-- ENUMの定義
CREATE TYPE inquiry_channel AS ENUM ('line','phone','web_form','email','hikakaku','uridoki','oikura');
CREATE TYPE inquiry_status AS ENUM ('new','in_progress','pending','appointment_set','transferred','lost','closed');
CREATE TYPE message_direction AS ENUM ('inbound','outbound');

-- スタッフ
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin','operator','viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- リード
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  display_name TEXT,
  line_tags TEXT[] DEFAULT '{}',
  first_channel inquiry_channel,
  core_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 反響
CREATE TABLE inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  channel inquiry_channel NOT NULL,
  status inquiry_status NOT NULL DEFAULT 'new',
  subject TEXT,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  flow_data JSONB DEFAULT '{}',
  call_sid TEXT UNIQUE,
  source_site TEXT,
  priority SMALLINT DEFAULT 0,
  internal_note TEXT,
  first_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- メッセージ
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  body TEXT,
  media_urls TEXT[] DEFAULT '{}',
  line_msg_id TEXT UNIQUE,
  sent_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  is_auto BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- タグ
CREATE TABLE inquiry_tags (
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (inquiry_id, tag)
);

-- アポイントメント
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  item_category TEXT,
  item_description TEXT,
  address TEXT,
  preferred_method TEXT CHECK (preferred_method IN ('visit','delivery')),
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  core_synced_at TIMESTAMPTZ,
  core_appointment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- コア連携ログ
CREATE TABLE core_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('to_core','from_core')),
  entity_type TEXT,
  entity_id UUID,
  payload JSONB,
  status TEXT NOT NULL CHECK (status IN ('success','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS有効化
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_sync_log ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（認証済みユーザーのみ全操作可）
CREATE POLICY "authenticated_all" ON staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON inquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON inquiry_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON core_sync_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at自動更新
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER inquiries_updated_at BEFORE UPDATE ON inquiries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
