import {
  agePassesFilter,
  filterObservations,
  quantile,
  summarizeObservations,
  type AtlasAgeFilter,
  type AtlasObservation,
  type AtlasYearFilter,
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
import {
  calculateAnnualizedRate,
  calculateTerritoryMetric,
  populationValue,
  rateBase,
  ratePeriodYears,
  russianYearCountLabel,
  type AtlasPopulationDefinition,
  type RateCalculation,
  type RateContext,
  type TerritoryMetricOptions
} from "./metrics";
import {
  rankIndexedValues,
  rankItemsDescending,
  type RankedValue,
  type RankingTieBreaker,
  type RankingValueSelector
} from "./ranking";

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
  populationValue(definition?: AtlasPopulationDefinition | null): number | null;
  rateBase(metric: unknown): number | null;
  ratePeriodYears(year: AtlasYearFilter, availableYears: readonly number[]): number;
  rateYearsLabel(years: number): string;
  calculateRate(
    count: number,
    definition: AtlasPopulationDefinition | null | undefined,
    metric: unknown,
    context: RateContext
  ): RateCalculation | null;
  territoryMetric(options: TerritoryMetricOptions): number | null;
  rankValues(values: readonly number[]): RankedValue[];
  rankItems<T extends object>(
    items: readonly T[],
    valueOf: RankingValueSelector<T>,
    tieBreaker?: RankingTieBreaker<T>
  ): Array<T & { rank: number }>;
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
  aggregateTerritories,
  populationValue,
  rateBase,
  ratePeriodYears,
  rateYearsLabel: russianYearCountLabel,
  calculateRate: calculateAnnualizedRate,
  territoryMetric: calculateTerritoryMetric,
  rankValues: rankIndexedValues,
  rankItems: rankItemsDescending
});

window.AmurAtlasAnalyticsCore = api;
