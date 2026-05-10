-- messages テーブルに email_msg_id カラムを追加（Resend のメール ID 保存用）
ALTER TABLE messages ADD COLUMN IF NOT EXISTS email_msg_id TEXT;
