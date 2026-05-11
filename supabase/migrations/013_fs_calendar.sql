-- FS（フィールドセールス）スタッフのGoogleカレンダー連携

-- staff テーブルに team カラムを追加（IS = インサイドセールス、FS = フィールドセールス）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'IS'
  CHECK (team IN ('IS', 'FS'));

-- Googleカレンダー連携設定（スタッフごと）
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  google_account_email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  next_sync_token TEXT,        -- インクリメンタル同期用トークン（変更・削除の差分取得）
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id)
);

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON google_calendar_connections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.google_calendar_connections TO anon, authenticated, service_role;

-- Googleカレンダーから同期したイベント
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  title TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  location TEXT,
  source TEXT NOT NULL DEFAULT 'google_calendar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, google_event_id)
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON calendar_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.calendar_events TO anon, authenticated, service_role;

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER set_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_calendar_events_updated_at();
