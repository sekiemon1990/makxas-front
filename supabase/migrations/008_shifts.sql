-- 営業時間設定（曜日ごと）
CREATE TABLE IF NOT EXISTS business_hours (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=日, 1=月 ... 6=土
  open_time    TIME NOT NULL DEFAULT '10:00',
  close_time   TIME NOT NULL DEFAULT '19:00',
  is_closed    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (day_of_week)
);

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON business_hours;
CREATE POLICY "authenticated_all" ON business_hours
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.business_hours TO anon, authenticated, service_role;

-- デフォルト営業時間を挿入（月〜土: 10-19、日: 定休）
INSERT INTO business_hours (day_of_week, open_time, close_time, is_closed)
VALUES
  (0, '10:00', '19:00', true),   -- 日曜 定休
  (1, '10:00', '19:00', false),  -- 月曜
  (2, '10:00', '19:00', false),  -- 火曜
  (3, '10:00', '19:00', false),  -- 水曜
  (4, '10:00', '19:00', false),  -- 木曜
  (5, '10:00', '19:00', false),  -- 金曜
  (6, '10:00', '19:00', false)   -- 土曜
ON CONFLICT (day_of_week) DO NOTHING;

-- シフト
CREATE TABLE IF NOT EXISTS shifts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_date     DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  break_minutes  INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, shift_date)   -- 1スタッフ1日1シフト
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON shifts;
CREATE POLICY "authenticated_all" ON shifts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.shifts TO anon, authenticated, service_role;

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_shifts_updated_at ON shifts;
CREATE TRIGGER set_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_shifts_updated_at();
