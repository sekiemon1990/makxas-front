-- AI返信ログ用カラム追加
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_suggested   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_theme        TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_theme_changed BOOLEAN;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS final_theme      TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_edited        BOOLEAN;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_original_body TEXT;

-- 受信メッセージのカテゴリ（AIが分類）
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS msg_category TEXT;
