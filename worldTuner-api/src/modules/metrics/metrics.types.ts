export const metricPages = [
  'welcome',
  'map',
  'discover',
  'search',
  'charts',
  'settings',
  'vip',
  'player',
] as const;

export type MetricPage = (typeof metricPages)[number];
export type MetricSource = 'web' | 'android';

export interface VisitInput {
  visitorId: string;
  source: MetricSource;
  page: MetricPage;
}

export interface VisitRecord {
  day: string;
  month: string;
  source: MetricSource;
  page: MetricPage;
  dailyHash: string;
  monthlyHash: string;
}
