-- 补齐已有国家中文；XX/France 仅修正显示译名，不改变代码、ID 或关联。
UPDATE country SET name_zh = '阿富汗' WHERE code = 'AF' AND name_zh IS NULL;
UPDATE country SET name_zh = '南极洲' WHERE code = 'AQ' AND name_zh IS NULL;
UPDATE country SET name_zh = '荷属加勒比区' WHERE code = 'BQ' AND name_zh IS NULL;
UPDATE country SET name_zh = '科科斯（基林）群岛' WHERE code = 'CC' AND name_zh IS NULL;
UPDATE country SET name_zh = '刚果（布）' WHERE code = 'CG' AND name_zh IS NULL;
UPDATE country SET name_zh = '英属印度洋领地' WHERE code = 'IO' AND name_zh IS NULL;
UPDATE country SET name_zh = '马尔代夫' WHERE code = 'MV' AND name_zh IS NULL;
UPDATE country SET name_zh = '纽埃' WHERE code = 'NU' AND name_zh IS NULL;
UPDATE country SET name_zh = '法属波利尼西亚' WHERE code = 'PF' AND name_zh IS NULL;
UPDATE country SET name_zh = '帕劳' WHERE code = 'PW' AND name_zh IS NULL;
UPDATE country SET name_zh = '南苏丹' WHERE code = 'SS' AND name_zh IS NULL;
UPDATE country SET name_zh = '法属南部领地' WHERE code = 'TF' AND name_zh IS NULL;
UPDATE country SET name_zh = '土库曼斯坦' WHERE code = 'TM' AND name_zh IS NULL;
UPDATE country SET name_zh = '美国本土外小岛屿' WHERE code = 'UM' AND name_zh IS NULL;
UPDATE country SET name_zh = '法国' WHERE code = 'XX' AND name = 'France' AND name_zh IS NULL;
