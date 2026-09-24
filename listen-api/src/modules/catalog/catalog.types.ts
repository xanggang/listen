export type CatalogKind = 'languages' | 'tags' | 'countries';
export interface CatalogItem {
  id: number;
  name: string | null;
  stationcount: number | null;
  iso_639?: string | null;
  iso_3166_1?: string | null;
}
