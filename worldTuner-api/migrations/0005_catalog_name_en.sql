-- 原名保持不变；首次回填英文展示名，后续可独立修正。
ALTER TABLE tag ADD COLUMN name_en TEXT
  CHECK (name_en IS NULL OR length(trim(name_en)) > 0);
ALTER TABLE language ADD COLUMN name_en TEXT
  CHECK (name_en IS NULL OR length(trim(name_en)) > 0);
UPDATE tag SET name_en = trim(name) WHERE name_en IS NULL;
UPDATE language SET name_en = trim(name) WHERE name_en IS NULL;
