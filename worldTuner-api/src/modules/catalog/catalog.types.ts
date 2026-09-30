export type CatalogKind = 'languages' | 'tags' | 'countries';
export interface CatalogItem {
  id: string;
  code?: string | null;
  name: string | null;
  stationcount: number | null;
}
