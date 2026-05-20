-- PR28: 監査ログ・変更履歴
--
-- 反響・アポ・リード等の主要エンティティの変更を記録する汎用テーブル。
-- 「誰が・いつ・何を・何から何へ」変更したかをトレースし、運用ミスや
-- 不正アクセスを後から追跡できるようにする。
--
-- 利用箇所:
--   - inquiries.status 変更 (PATCH /api/inquiries/[id]/status)
--   - appointments の作成・更新
--   - leads の merge 等
-- 詳細は lib/audit/log.ts を参照。

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,         -- inquiry | appointment | lead | message
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,              -- create | update | delete | status_change | merge
  field TEXT,                        -- 単一フィールド変更の場合のフィールド名（status等）
  before_value JSONB,                -- 変更前の値
  after_value JSONB,                 -- 変更後の値
  changed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  changed_by_email TEXT,             -- staff削除後も残すため email を別途保持
  note TEXT,                         -- 任意のメモ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON audit_logs(changed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all" ON audit_logs;
CREATE POLICY "authenticated_all" ON audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.audit_logs TO anon, authenticated, service_role;
