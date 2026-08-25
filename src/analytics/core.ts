export type AtlasObservation = readonly [
  year: number,
  sex: number,
  age: number,
  codeIndex: number,
  municipalityIndex: number,
  settlementIndex: number
];

export type AtlasAgeFilter = "all" | "0_14" | "15_44" | "45_64" | "65_79" | "80P";
export type AtlasSexFilter = "all" | "1" | "2";
export type AtlasYearFilter = "all" | string | number;

export interface ObservationFilters {
  year: AtlasYearFilter;
  sex: AtlasSexFilter;
  age: AtlasAgeFilter;
}

export interface FilterObservationOptions {
  years?: readonly number[];
  /** Legacy compatibility: when true, all year restrictions, including `years`, are bypassed. */
  ignoreYear?: boolean;
  ignoreSex?: boolean;
}

export interface ObservationStats {
  n: number;
  ages: number[];
  median: number | null;
  pgpzh: number;
}

export function agePassesFilter(age: number, filter: AtlasAgeFilter): boolean {
  if (filter === "all") return true;
  if (age < 0) return false;
  if (filter === "0_14") return age < 15;
  if (filter === "15_44") return age >= 15 && age < 45;
  if (filter === "45_64") return age >= 45 && age < 65;
  if (filter === "65_79") return age >= 65 && age < 80;
  return age >= 80;
}

export function filterObservations<T extends AtlasObservation>(
  records: readonly T[],
  filters: ObservationFilters,
  options: FilterObservationOptions = {}
): T[] {
  const selectedYears = options.years ? new Set(options.years) : null;
  const selectedYear = filters.year === "all" ? null : Number(filters.year);
  const selectedSex = filters.sex === "all" ? null : Number(filters.sex);

  return records.filter((record) => {
    const yearMatches = options.ignoreYear
      || (selectedYears ? selectedYears.has(record[0]) : selectedYear === null || record[0] === selectedYear);
    const sexMatches = options.ignoreSex || selectedSex === null || record[1] === selectedSex;
    return yearMatches && sexMatches && agePassesFilter(record[2], filters.age);
  });
}

export function quantile(values: readonly number[], q: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * q;
  const lowerIndex = Math.floor(position);
  const fraction = position - lowerIndex;
  const upper = sorted[lowerIndex + 1];
  return upper !== undefined
    ? sorted[lowerIndex] + fraction * (upper - sorted[lowerIndex])
    : sorted[lowerIndex];
}

export function summarizeObservations(records: readonly AtlasObservation[]): ObservationStats {
  const ages = records.filter((record) => record[2] >= 0).map((record) => record[2]);
  return {
    n: records.length,
    ages,
    median: quantile(ages, 0.5),
    pgpzh: ages.reduce((sum, age) => sum + Math.max(75 - age, 0), 0)
  };
}
