-- リード連絡先テーブル（1リードに対して複数の電話/メール/LINEを持てる）
CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('line', 'phone', 'email', 'other')),
  value TEXT NOT NULL,
  label TEXT,                          -- '携帯', '自宅', '仕事' など任意ラベル
  is_primary BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 同一リード内で同じtype+valueの重複を防ぐ
CREATE UNIQUE INDEX IF NOT EXISTS lead_contacts_lead_type_value
  ON lead_contacts(lead_id, type, value);

-- 新着問い合わせ時の既存リード照合用（type+valueで素早く検索）
CREATE INDEX IF NOT EXISTS lead_contacts_type_value
  ON lead_contacts(type, value);

-- RLS
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lead_contacts' AND policyname = 'authenticated_all') THEN
    CREATE POLICY "authenticated_all" ON public.lead_contacts
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public.lead_contacts TO anon, authenticated, service_role;

-- ── 既存データ移行 ────────────────────────────────────────────────────────────
-- leads.phone → lead_contacts
INSERT INTO public.lead_contacts (lead_id, type, value, is_primary, source)
SELECT id, 'phone', phone, true, 'auto'
FROM public.leads
WHERE phone IS NOT NULL AND phone != ''
ON CONFLICT (lead_id, type, value) DO NOTHING;

-- leads.email → lead_contacts
INSERT INTO public.lead_contacts (lead_id, type, value, is_primary, source)
SELECT id, 'email', email, true, 'auto'
FROM public.leads
WHERE email IS NOT NULL AND email != ''
ON CONFLICT (lead_id, type, value) DO NOTHING;

-- leads.line_user_id → lead_contacts
INSERT INTO public.lead_contacts (lead_id, type, value, is_primary, source)
SELECT id, 'line', line_user_id, true, 'auto'
FROM public.leads
WHERE line_user_id IS NOT NULL AND line_user_id != ''
ON CONFLICT (lead_id, type, value) DO NOTHING;

-- ── leads テーブルに archived フラグを追加（マージ後の統合元リードを無効化） ──
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merged_into_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
