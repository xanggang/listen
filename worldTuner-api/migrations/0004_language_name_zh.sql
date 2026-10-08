-- 为语言目录增加中文展示名；code 仍作为 Radio Browser 的匹配键。
ALTER TABLE language ADD COLUMN name_zh TEXT
  CHECK (name_zh IS NULL OR length(trim(name_zh)) > 0);
