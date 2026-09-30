-- 中文展示名与英文匹配名分开保存；NULL 表示尚未确定译名。
ALTER TABLE tag ADD COLUMN name_zh TEXT
  CHECK (name_zh IS NULL OR length(trim(name_zh)) > 0);
