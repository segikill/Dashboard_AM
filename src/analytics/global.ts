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
import {
  buildTreemapViewModel,
  type TreemapReferenceData,
  type TreemapViewModel,
  type TreemapViewOptions
} from "./view-models/treemap";
import {
  buildHeatmapViewModel,
  heatmapCellKey,
  topHeatmapTerritories,
  type HeatmapCell,
  type HeatmapReferenceData,
  type HeatmapViewModel,
  type HeatmapViewOptions
} from "./view-models/heatmap";
import {
  buildRankViewModel,
  rankDefinitions,
  type RankDefinition,
  type RankReferenceData,
  type RankSlice,
  type RankViewModel,
  type RankViewOptions
} from "./view-models/rank";
import {
  buildPyramidViewModel,
  pyramidCauseDefinitions,
  pyramidCauseLabel,
  type PyramidCauseDefinition,
  type PyramidReferenceData,
  type PyramidViewModel,
  type PyramidViewOptions
} from "./view-models/pyramid";

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
  buildTreemapModel<T extends AtlasObservation>(
    currentRecords: readonly T[],
    comparisonRecords: readonly T[],
    reference: TreemapReferenceData,
    options: TreemapViewOptions
  ): TreemapViewModel<T>;
  buildHeatmapModel<T extends AtlasObservation>(
    currentRecords: readonly T[],
    allRecords: readonly AtlasObservation[],
    reference: HeatmapReferenceData,
    options: HeatmapViewOptions
  ): HeatmapViewModel<T>;
  heatmapCellKey(unit: TerritoryAggregationOptions["unit"], territoryIndex: number, classIndex: number): string;
  topHeatmapTerritories<T extends AtlasObservation>(
    model: HeatmapViewModel<T>,
    classIndex: number,
    limit?: number
  ): HeatmapCell<T>[];
  buildRankModel<T extends AtlasObservation>(
    slices: readonly RankSlice<T>[],
    reference: RankReferenceData,
    options: RankViewOptions
  ): RankViewModel;
  rankDefinitions(
    reference: RankReferenceData,
    options: Pick<RankViewOptions, "level" | "classIndex">
  ): RankDefinition[];
  buildPyramidModel<T extends AtlasObservation>(
    records: readonly T[],
    reference: PyramidReferenceData,
    options: PyramidViewOptions
  ): PyramidViewModel<T>;
  pyramidCauseDefinitions(
    reference: PyramidReferenceData,
    options: Pick<PyramidViewOptions, "level" | "parentClass">
  ): PyramidCauseDefinition[];
  pyramidCauseLabel(reference: PyramidReferenceData, options: PyramidViewOptions): string;
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
  rankItems: rankItemsDescending,
  buildTreemapModel: buildTreemapViewModel,
  buildHeatmapModel: buildHeatmapViewModel,
  heatmapCellKey,
  topHeatmapTerritories,
  buildRankModel: buildRankViewModel,
  rankDefinitions,
  buildPyramidModel: buildPyramidViewModel,
  pyramidCauseDefinitions,
  pyramidCauseLabel
});

window.AmurAtlasAnalyticsCore = api;
