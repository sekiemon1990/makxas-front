-- 返信テンプレート
CREATE TABLE IF NOT EXISTS reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  channel inquiry_channel,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON reply_templates;
CREATE POLICY "authenticated_all" ON reply_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.reply_templates TO anon, authenticated, service_role;

-- フォローアップリマインダー
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON reminders;
CREATE POLICY "authenticated_all" ON reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.reminders TO anon, authenticated, service_role;

-- 反響既読管理
CREATE TABLE IF NOT EXISTS inquiry_reads (
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (inquiry_id, staff_id)
);
ALTER TABLE inquiry_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON inquiry_reads;
CREATE POLICY "authenticated_all" ON inquiry_reads FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.inquiry_reads TO anon, authenticated, service_role;
