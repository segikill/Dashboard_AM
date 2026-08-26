import { classIndexOf, type AtlasCodeReference } from "../classification";
import type { AtlasObservation, AtlasYearFilter } from "../core";
import { calculateAnnualizedRate, populationValue, rateBase, type AtlasPopulationDefinition } from "../metrics";
import { rankItemsDescending } from "../ranking";
import { aggregateTerritories, type AtlasTerritoryUnit, type TerritoryAggregate } from "../territory";

export type HeatmapMetric = "share" | "n" | "per1k" | "per10k" | "per100k";
export type HeatmapLimit = "25" | "50" | "all";

export interface HeatmapClassDefinition {
  roman: string;
  short: string;
  color: string;
}

export interface HeatmapTerritoryDefinition extends AtlasPopulationDefinition {
  name: string;
  municipalityType?: string;
}

export interface HeatmapReferenceData {
  years: readonly number[];
  codes: readonly AtlasCodeReference[];
  classes: readonly HeatmapClassDefinition[];
  municipalities: readonly HeatmapTerritoryDefinition[];
  settlements: readonly HeatmapTerritoryDefinition[];
}

export interface HeatmapViewOptions {
  unit: AtlasTerritoryUnit;
  metric: HeatmapMetric;
  limit: HeatmapLimit;
  selectedYear: AtlasYearFilter;
}

export interface HeatmapCell<T extends AtlasObservation = AtlasObservation> {
  key: string;
  row: TerritoryAggregate<T>;
  definition: HeatmapTerritoryDefinition;
  classIndex: number;
  value: number | null;
  count: number;
  population: number | null;
  share: number;
  territoryRank: number;
  territoryCount: number;
  causeRank: number;
  causeCount: number;
}

export interface HeatmapViewModel<T extends AtlasObservation = AtlasObservation> {
  unit: AtlasTerritoryUnit;
  metric: HeatmapMetric;
  limit: HeatmapLimit;
  definitions: readonly HeatmapTerritoryDefinition[];
  rows: TerritoryAggregate<T>[];
  classes: number[];
  cells: HeatmapCell<T>[];
  cellMap: Map<string, HeatmapCell<T>>;
  maximum: number;
  isMunicipality: boolean;
  metricLabel: string;
}

const typeOrder: Record<string, number> = { city: 0, urban_settlement: 1, district: 2 };

export const heatmapGroupNames: Readonly<Record<string, string>> = Object.freeze({
  city: "Города",
  urban_settlement: "Посёлки городского типа",
  district: "Районы"
});

export function heatmapCellKey(unit: AtlasTerritoryUnit, territoryIndex: number, classIndex: number): string {
  return `${unit}:${territoryIndex}:${classIndex}`;
}

export function heatmapMetricLabel(metric: HeatmapMetric): string {
  if (metric === "share") return "доля выбранного класса";
  if (metric === "per1k") return "на 1 000 населения · в среднем за год";
  if (metric === "per10k") return "на 10 000 населения · в среднем за год";
  if (metric === "per100k") return "на 100 000 населения · в среднем за год";
  return "количество смертей";
}

function rateValue(
  count: number,
  definition: HeatmapTerritoryDefinition,
  metric: HeatmapMetric,
  options: HeatmapViewOptions,
  years: readonly number[]
): number | null {
  return calculateAnnualizedRate(
    count,
    definition,
    metric,
    { year: options.selectedYear, availableYears: years }
  )?.value ?? null;
}

function cellValue<T extends AtlasObservation>(
  row: TerritoryAggregate<T>,
  definition: HeatmapTerritoryDefinition,
  classIndex: number,
  options: HeatmapViewOptions,
  years: readonly number[]
): number | null {
  if (options.metric === "share") return row.total ? row.classes[classIndex] / row.total * 100 : 0;
  if (rateBase(options.metric) !== null) return rateValue(row.classes[classIndex], definition, options.metric, options, years);
  return row.classes[classIndex];
}

function emptyRow<T extends AtlasObservation>(idx: number, classCount: number): TerritoryAggregate<T> {
  return {
    idx,
    total: 0,
    selected: 0,
    classes: new Array(classCount).fill(0),
    rows: [],
    ages: [],
    pgpzh: 0
  };
}

function assignRanks<T extends AtlasObservation>(cells: HeatmapCell<T>[]): void {
  const classIndices = new Set(cells.map((cell) => cell.classIndex));
  classIndices.forEach((classIndex) => {
    const ranked = rankItemsDescending(
      cells.filter((cell) => cell.classIndex === classIndex && Number.isFinite(cell.value)),
      (cell) => cell.value ?? -Infinity,
      (left, right) => left.definition.name.localeCompare(right.definition.name, "ru-RU")
    );
    const rankByKey = new Map(ranked.map((cell) => [cell.key, cell.rank]));
    cells.filter((cell) => cell.classIndex === classIndex).forEach((cell) => {
      cell.territoryRank = rankByKey.get(cell.key) || 0;
      cell.territoryCount = ranked.length;
    });
  });

  const territoryIndices = new Set(cells.map((cell) => cell.row.idx));
  territoryIndices.forEach((territoryIndex) => {
    const ranked = rankItemsDescending(
      cells.filter((cell) => cell.row.idx === territoryIndex && Number.isFinite(cell.value)),
      (cell) => cell.value ?? -Infinity,
      (left, right) => left.classIndex - right.classIndex
    );
    const rankByKey = new Map(ranked.map((cell) => [cell.key, cell.rank]));
    cells.filter((cell) => cell.row.idx === territoryIndex).forEach((cell) => {
      cell.causeRank = rankByKey.get(cell.key) || 0;
      cell.causeCount = ranked.length;
    });
  });
}

export function topHeatmapTerritories<T extends AtlasObservation>(
  model: HeatmapViewModel<T>,
  classIndex: number,
  limit = 6
): HeatmapCell<T>[] {
  return rankItemsDescending(
    model.cells.filter((cell) => cell.classIndex === classIndex && Number.isFinite(cell.value)),
    (cell) => cell.value ?? -Infinity,
    (left, right) => left.definition.name.localeCompare(right.definition.name, "ru-RU")
  ).slice(0, Math.max(0, limit));
}

export function buildHeatmapViewModel<T extends AtlasObservation>(
  currentRows: readonly T[],
  allRows: readonly AtlasObservation[],
  reference: HeatmapReferenceData,
  options: HeatmapViewOptions
): HeatmapViewModel<T> {
  const definitions = options.unit === "mo" ? reference.municipalities : reference.settlements;
  const table = aggregateTerritories(currentRows, reference.codes, {
    unit: options.unit,
    classCount: reference.classes.length,
    selectedClass: "all",
    includeUnmappedCodes: false,
    collectRows: true
  });
  const isMunicipality = options.unit === "mo";
  const rowMetric = (row: TerritoryAggregate<T>): number => rateBase(options.metric) !== null
    ? (rateValue(row.total, definitions[row.idx], options.metric, options, reference.years) ?? -1)
    : row.total;
  const stableCompare = (left: TerritoryAggregate<T>, right: TerritoryAggregate<T>): number => {
    const leftDefinition = definitions[left.idx];
    const rightDefinition = definitions[right.idx];
    const typeDelta = (typeOrder[leftDefinition.municipalityType || "district"] ?? 2)
      - (typeOrder[rightDefinition.municipalityType || "district"] ?? 2);
    return typeDelta || leftDefinition.name.localeCompare(rightDefinition.name, "ru-RU");
  };
  const rows = isMunicipality
    ? definitions.map((_, idx) => table.get(idx) || emptyRow<T>(idx, reference.classes.length)).sort(stableCompare)
    : [...table.values()].sort((left, right) => rowMetric(right) - rowMetric(left));
  const limit = options.limit === "all" ? rows.length : Number(options.limit);
  const shown = isMunicipality ? rows : rows.slice(0, limit);
  const stableClasses = new Set(allRows.flatMap((row) => {
    const classIndex = row[4] >= 0 ? classIndexOf(row, reference.codes) : -1;
    return classIndex >= 0 ? [classIndex] : [];
  }));
  const classes = reference.classes
    .map((_, index) => index)
    .filter((index) => isMunicipality ? stableClasses.has(index) : shown.some((row) => row.classes[index]));
  const cells: HeatmapCell<T>[] = [];
  shown.forEach((row) => {
    const definition = definitions[row.idx];
    classes.forEach((classIndex) => {
      cells.push({
        key: heatmapCellKey(options.unit, row.idx, classIndex),
        row,
        definition,
        classIndex,
        value: cellValue(row, definition, classIndex, options, reference.years),
        count: row.classes[classIndex],
        population: populationValue(definition),
        share: row.total ? row.classes[classIndex] / row.total * 100 : 0,
        territoryRank: 0,
        territoryCount: 0,
        causeRank: 0,
        causeCount: 0
      });
    });
  });
  assignRanks(cells);
  const finiteValues = cells.map((cell) => cell.value).filter((value): value is number => Number.isFinite(value));
  return {
    unit: options.unit,
    metric: options.metric,
    limit: options.limit,
    definitions,
    rows: shown,
    classes,
    cells,
    cellMap: new Map(cells.map((cell) => [cell.key, cell])),
    maximum: Math.max(1, ...finiteValues),
    isMunicipality,
    metricLabel: heatmapMetricLabel(options.metric)
  };
}
