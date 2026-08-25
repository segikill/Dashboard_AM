import {
  agePassesFilter,
  filterObservations,
  quantile,
  summarizeObservations,
  type AtlasAgeFilter,
  type AtlasObservation,
  type FilterObservationOptions,
  type ObservationFilters,
  type ObservationStats
} from "./core";

export interface AtlasAnalyticsCoreApi {
  readonly version: "1";
  agePass(age: number, filter: AtlasAgeFilter): boolean;
  filterRecords<T extends AtlasObservation>(
    records: readonly T[],
    filters: ObservationFilters,
    options?: FilterObservationOptions
  ): T[];
  quantile(values: readonly number[], q: number): number | null;
  stats(records: readonly AtlasObservation[]): ObservationStats;
}

declare global {
  interface Window {
    AmurAtlasAnalyticsCore?: AtlasAnalyticsCoreApi;
  }
}

const api: AtlasAnalyticsCoreApi = Object.freeze({
  version: "1",
  agePass: agePassesFilter,
  filterRecords: filterObservations,
  quantile,
  stats: summarizeObservations
});

window.AmurAtlasAnalyticsCore = api;
