export type AtlasRateMetric = "per1k" | "per10k" | "per100k";
export type AtlasMetricKey = "n" | "share" | AtlasRateMetric | string;
export type AtlasYearSelection = "all" | string | number;

export interface AtlasPopulationDefinition {
  population2021?: unknown;
}

export interface RateContext {
  year: AtlasYearSelection;
  availableYears: readonly number[];
}

export interface RateCalculation {
  count: number;
  population: number;
  periodYears: number;
  denominator: number;
  base: number;
  value: number;
}

export interface TerritoryMetricAggregate {
  total: number;
  selected: number;
}

export interface TerritoryMetricOptions extends RateContext {
  metric: AtlasMetricKey;
  aggregate: TerritoryMetricAggregate;
  definition?: AtlasPopulationDefinition | null;
  selectedClass: "all" | number | string;
  totalRows: number;
}

export function populationValue(
  definition?: AtlasPopulationDefinition | null
): number | null {
  const value = Number(definition?.population2021);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function rateBase(metric: unknown): number | null {
  if (metric === "per1k") return 1_000;
  if (metric === "per10k") return 10_000;
  if (metric === "per100k") return 100_000;
  return null;
}

export function ratePeriodYears(
  year: AtlasYearSelection,
  availableYears: readonly number[]
): number {
  return year === "all" ? Math.max(1, availableYears.length) : 1;
}

export function russianYearCountLabel(years: number): string {
  const safeYears = Math.max(0, Math.trunc(years));
  const mod100 = safeYears % 100;
  const mod10 = safeYears % 10;
  const suffix = mod100 >= 11 && mod100 <= 14
    ? "лет"
    : mod10 === 1
      ? "год"
      : mod10 >= 2 && mod10 <= 4
        ? "года"
        : "лет";
  return `${safeYears} ${suffix}`;
}

export function calculateAnnualizedRate(
  count: number,
  definition: AtlasPopulationDefinition | null | undefined,
  metric: unknown,
  context: RateContext
): RateCalculation | null {
  const population = populationValue(definition);
  const base = rateBase(metric);
  if (population === null || base === null) return null;
  const periodYears = ratePeriodYears(context.year, context.availableYears);
  const denominator = population * periodYears;
  return {
    count,
    population,
    periodYears,
    denominator,
    base,
    value: count / denominator * base
  };
}

export function calculateTerritoryMetric(options: TerritoryMetricOptions): number | null {
  const { metric, aggregate, definition, selectedClass, totalRows, year, availableYears } = options;
  if (rateBase(metric) !== null) {
    return calculateAnnualizedRate(aggregate.selected, definition, metric, { year, availableYears })?.value ?? null;
  }
  if (metric === "share") {
    return selectedClass === "all"
      ? aggregate.total / Math.max(totalRows, 1) * 100
      : aggregate.selected / aggregate.total * 100;
  }
  return aggregate.selected;
}
