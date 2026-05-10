-- 月次目標設定テーブル
CREATE TABLE IF NOT EXISTS monthly_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month       DATE NOT NULL, -- その月の1日 (例: 2026-05-01)
  goal_type   TEXT NOT NULL, -- 'appointments' | 'inquiries' | 'appointment_rate'
  target      INTEGER NOT NULL CHECK (target > 0),
  label       TEXT,          -- 表示名（省略時は goal_type のデフォルト名）
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month, goal_type)
);

ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON monthly_goals;
CREATE POLICY "authenticated_all" ON monthly_goals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.monthly_goals TO anon, authenticated, service_role;

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_monthly_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_monthly_goals_updated_at ON monthly_goals;
CREATE TRIGGER set_monthly_goals_updated_at
  BEFORE UPDATE ON monthly_goals
  FOR EACH ROW EXECUTE FUNCTION update_monthly_goals_updated_at();
