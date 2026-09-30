export interface StationRow {
  id: string;
  name: string;
  website: string | null;
  favicon: string | null;
  place: string | null;
  country_id: string | null;
  country: string | null;
  countrycode: string | null;
  geo_lat: number | null;
  geo_long: number | null;
  votes: number | null;
  clickcount: number | null;
  source_type: string;
  catalog_status: string;
  created_at: string;
  updated_at: string;
  url: string | null;
  url_resolved: string | null;
  codec: string | null;
  bitrate: number | null;
  hls: number | null;
  lastcheckok: number | null;
  tags: string | null;
  language: string | null;
  languagecodes: string | null;
}
export interface StreamRow {
  id: string;
  station_id: string;
  url: string;
  resolved_url: string | null;
  codec: string | null;
  bitrate: number | null;
  is_hls: number | null;
  is_primary: number;
  last_check_ok: number | null;
  last_checked_at: string | null;
  resolved_at: string | null;
}
export interface LinkRow {
  id: string;
  platform: string;
  url: string;
}
