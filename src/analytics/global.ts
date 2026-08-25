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
import {
  blockIndexOf,
  classIndexOf,
  countClasses,
  type AtlasCodeReference
} from "./classification";
import {
  aggregateTerritories,
  type TerritoryAggregate,
  type TerritoryAggregationOptions
} from "./territory";

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
  classOf(record: AtlasObservation, codes: readonly AtlasCodeReference[]): number;
  blockOf(record: AtlasObservation, codes: readonly AtlasCodeReference[]): number;
  classCounts(
    records: readonly AtlasObservation[],
    codes: readonly AtlasCodeReference[],
    classCount: number
  ): number[];
  aggregateTerritories<T extends AtlasObservation>(
    records: readonly T[],
    codes: readonly AtlasCodeReference[],
    options: TerritoryAggregationOptions
  ): Map<number, TerritoryAggregate<T>>;
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
  stats: summarizeObservations,
  classOf: classIndexOf,
  blockOf: blockIndexOf,
  classCounts: countClasses,
  aggregateTerritories
});

window.AmurAtlasAnalyticsCore = api;
