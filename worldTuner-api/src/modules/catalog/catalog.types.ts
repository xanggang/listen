export type CatalogKind = 'languages' | 'tags' | 'countries';
export interface CatalogItem {
  id: string;
  code?: string | null;
  name: string | null;
  name_en?: string | null;
  name_zh?: string | null;
  stationcount: number | null;
}
