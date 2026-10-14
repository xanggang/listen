export interface CatalogNames {
  name: string;
  name_en?: string | null;
  name_zh?: string | null;
}

/**
 * 中文优先译名，再回退英文与原文；其他界面语言使用英文与原文。
 * 空白名称按缺失处理，结果只影响展示，不改变筛选或关联的 ID。
 */
export function catalogDisplayName(item: CatalogNames, locale: string): string {
  return localizedName(locale, item.name, item.name_en, item.name_zh) ?? '';
}

/**
 * 本地分类搜索匹配原文、中英文名称，关键词不区分大小写，空关键词匹配全部。
 */
export function catalogMatches(item: CatalogNames, keyword: string): boolean {
  const query = keyword.trim().toLowerCase();
  return [item.name, item.name_en, item.name_zh].some(
    // 译名为空时继续检查其他名称，不限制当前界面语言。
    (value) => value?.toLowerCase().includes(query) ?? false,
  );
}

/**
 * 展示电台语种，旧 API 或旧收藏缺少翻译字段时仍使用原有 language。
 */
export function stationLanguageLabel(
  item: {
    language: string | null;
    languageEn?: string | null;
    languageZh?: string | null;
  },
  locale: string,
): string | null {
  return localizedName(locale, item.language, item.languageEn, item.languageZh);
}

/**
 * 返回首个非空白展示名；全部缺失时返回 null，供界面省略该项。
 */
function localizedName(
  locale: string,
  original: string | null,
  english?: string | null,
  chinese?: string | null,
): string | null {
  for (const value of [...(locale.startsWith('zh') ? [chinese] : []), english, original]) {
    const label = value?.trim();
    if (label) return label;
  }
  return null;
}

/**
 * 按界面语言展示国家；没有译名或读取旧收藏时保留原始 country。
 */
export function stationCountryLabel(
  item: {
    country: string | null;
    countryEn?: string | null;
    countryZh?: string | null;
  },
  locale: string,
): string | null {
  return localizedName(locale, item.country, item.countryEn, item.countryZh);
}
