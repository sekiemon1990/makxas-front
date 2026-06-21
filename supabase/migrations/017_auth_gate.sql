-- 認証ゲート: ログイン許可リスト
-- 目的: Google ログインに成功した「誰でも」ではなく、
--   (1) @makxas.com ドメイン  または  (2) この許可リストに登録されたメール
-- だけが staff として有効化・ログインできるようにする。
-- ドメイン判定はアプリ側ヘルパー(lib/auth/authorize.ts)で行い、
-- このテーブルは「ドメイン外で例外的に許可するメール」を管理する。

CREATE TABLE IF NOT EXISTS auth_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- メールは小文字正規化前提（アプリ側でも lower 比較する）
CREATE INDEX IF NOT EXISTS idx_auth_allowlist_email ON auth_allowlist (lower(email));

-- RLS 有効化。アクセスはサーバー側 service_role 経由のみ（ポリシー無し = anon/authenticated は不可）。
ALTER TABLE auth_allowlist ENABLE ROW LEVEL SECURITY;

-- ロックアウト防止: 既存の有効スタッフのうち @makxas.com 以外のメール
-- （例: 初期 admin の gmail アカウント）を自動的に許可リストへ投入する。
INSERT INTO auth_allowlist (email, note)
SELECT lower(email), '初期投入: 既存スタッフ(ドメイン外)を自動許可'
FROM staff
WHERE is_active = true
  AND lower(email) NOT LIKE '%@makxas.com'
ON CONFLICT (email) DO NOTHING;
