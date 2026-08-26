import { blockIndexOf, classIndexOf, type AtlasCodeReference } from "../classification";
import { summarizeObservations, type AtlasObservation, type AtlasYearFilter } from "../core";
import { calculateAnnualizedRate } from "../metrics";

export type TreemapScope = "root" | "class" | "block";
export type TreemapMetric = "n" | "share" | "pgpzh" | "rate";
export type TreemapSort = "value" | "name" | "change";
export type TreemapEntityType = "class" | "block" | "code" | "other";

export interface TreemapClassDefinition {
  roman: string;
  short: string;
  color: string;
}

export interface TreemapBlockDefinition {
  class: number;
  code: string;
  label: string;
}

export interface TreemapCodeDefinition extends AtlasCodeReference {
  code: string;
  label: string;
}

export interface TreemapReferenceData {
  years: readonly number[];
  populationTotal: number;
  classes: readonly TreemapClassDefinition[];
  blocks: readonly TreemapBlockDefinition[];
  codes: readonly TreemapCodeDefinition[];
}

export interface TreemapViewOptions {
  scope: TreemapScope;
  parentIndex: number;
  metric: TreemapMetric;
  sort: TreemapSort;
  minShare: number;
  selectedYear: AtlasYearFilter;
}

export interface TreemapBreadcrumb {
  level: TreemapScope;
  label: string;
  current: boolean;
}

export interface TreemapItem<T extends AtlasObservation = AtlasObservation> {
  i: number;
  key: string;
  scopeType: TreemapScope;
  entityType: TreemapEntityType;
  code: string;
  label: string;
  color: string;
  classIndex: number;
  blockIndex: number;
  nextScope: Exclude<TreemapScope, "root"> | null;
  synthetic?: boolean;
  children?: TreemapItem<T>[];
  rows: T[];
  yearCounts: number[];
  yearPgpzh: number[];
  n: number;
  ages: number[];
  median: number | null;
  pgpzh: number;
  value: number;
  rate: number | null;
  share: number;
  change: number | null;
  series: number[];
}

export interface TreemapViewModel<T extends AtlasObservation = AtlasObservation> {
  scopeKey: string;
  contextLabel: string;
  breadcrumbs: TreemapBreadcrumb[];
  rawItems: TreemapItem<T>[];
  items: TreemapItem<T>[];
  currentRows: readonly T[];
  totalValue: number;
  totalRows: number;
}

interface TreemapDefinition {
  i: number;
  key: string;
  scopeType: TreemapScope;
  entityType: Exclude<TreemapEntityType, "other">;
  code: string;
  label: string;
  color: string;
  classIndex: number;
  blockIndex: number;
  nextScope: Exclude<TreemapScope, "root"> | null;
}

function definitionsFor(
  reference: TreemapReferenceData,
  scope: TreemapScope,
  parentIndex: number
): TreemapDefinition[] {
  if (scope === "root") {
    return reference.classes.map((definition, index) => ({
      i: index,
      key: `root:${index}`,
      scopeType: scope,
      entityType: "class",
      code: definition.roman,
      label: definition.short,
      color: definition.color,
      classIndex: index,
      blockIndex: -1,
      nextScope: "class"
    }));
  }
  if (scope === "class") {
    return reference.blocks.flatMap((definition, index) => definition.class === parentIndex ? [{
      i: index,
      key: `class:${index}`,
      scopeType: scope,
      entityType: "block" as const,
      code: definition.code,
      label: definition.label,
      color: reference.classes[definition.class]?.color || "#607d9d",
      classIndex: definition.class,
      blockIndex: index,
      nextScope: "block" as const
    }] : []);
  }
  return reference.codes.flatMap((definition, index) => definition.block === parentIndex ? [{
    i: index,
    key: `block:${index}`,
    scopeType: scope,
    entityType: "code" as const,
    code: definition.code,
    label: definition.label,
    color: reference.classes[definition.class]?.color || "#607d9d",
    classIndex: definition.class,
    blockIndex: definition.block,
    nextScope: null
  }] : []);
}

function indexForRow(
  row: AtlasObservation,
  scope: TreemapScope,
  codes: readonly AtlasCodeReference[]
): number {
  if (scope === "root") return classIndexOf(row, codes);
  if (scope === "class") return blockIndexOf(row, codes);
  return row[3];
}

function annualRate(
  count: number,
  reference: TreemapReferenceData,
  selectedYear: AtlasYearFilter
): number | null {
  return calculateAnnualizedRate(
    count,
    { population2021: reference.populationTotal },
    "per100k",
    { year: selectedYear, availableYears: reference.years }
  )?.value ?? null;
}

function itemChange(
  yearCounts: readonly number[],
  yearPgpzh: readonly number[],
  reference: TreemapReferenceData,
  options: TreemapViewOptions
): number | null {
  if (!reference.years.length) return null;
  let firstYear = reference.years[0];
  let secondYear = reference.years[reference.years.length - 1];
  if (options.selectedYear !== "all") {
    secondYear = Number(options.selectedYear);
    firstYear = Math.max(reference.years[0], secondYear - 1);
    if (firstYear === secondYear) return null;
  }
  const firstIndex = reference.years.indexOf(firstYear);
  const secondIndex = reference.years.indexOf(secondYear);
  const source = options.metric === "pgpzh" ? yearPgpzh : yearCounts;
  const first = firstIndex >= 0 ? source[firstIndex] || 0 : 0;
  const second = secondIndex >= 0 ? source[secondIndex] || 0 : 0;
  return first > 0 ? (second - first) / first * 100 : null;
}

function metricValue(
  count: number,
  pgpzh: number,
  totalRows: number,
  reference: TreemapReferenceData,
  options: TreemapViewOptions
): number {
  if (options.metric === "share") return count / Math.max(totalRows, 1) * 100;
  if (options.metric === "pgpzh") return pgpzh;
  if (options.metric === "rate") return annualRate(count, reference, options.selectedYear) || 0;
  return count;
}

function sortItems<T extends AtlasObservation>(
  items: readonly TreemapItem<T>[],
  sort: TreemapSort
): TreemapItem<T>[] {
  return [...items].sort((left, right) => {
    if (sort === "name") return `${left.code} ${left.label}`.localeCompare(`${right.code} ${right.label}`, "ru");
    if (sort === "change") return (right.change ?? -Infinity) - (left.change ?? -Infinity);
    return right.value - left.value;
  });
}

function aggregateOther<T extends AtlasObservation>(
  items: readonly TreemapItem<T>[],
  reference: TreemapReferenceData,
  options: TreemapViewOptions
): TreemapItem<T> {
  const rows = items.flatMap((item) => item.rows);
  const summary = summarizeObservations(rows);
  const yearCounts = reference.years.map((_, index) => items.reduce((sum, item) => sum + (item.yearCounts[index] || 0), 0));
  const yearPgpzh = reference.years.map((_, index) => items.reduce((sum, item) => sum + (item.yearPgpzh[index] || 0), 0));
  return {
    i: -1,
    key: `other:${options.scope}:${options.parentIndex}`,
    scopeType: options.scope,
    entityType: "other",
    code: "Прочие",
    label: `${items.length} малых категорий`,
    color: "#718096",
    classIndex: -1,
    blockIndex: -1,
    nextScope: null,
    synthetic: true,
    children: [...items],
    rows,
    yearCounts,
    yearPgpzh,
    ...summary,
    value: items.reduce((sum, item) => sum + item.value, 0),
    rate: annualRate(summary.n, reference, options.selectedYear),
    share: items.reduce((sum, item) => sum + item.share, 0),
    change: itemChange(yearCounts, yearPgpzh, reference, options),
    series: [...yearCounts]
  };
}

export function treemapContextLabel(
  reference: TreemapReferenceData,
  scope: TreemapScope,
  parentIndex: number
): string {
  if (scope === "root") return "Все классы МКБ-10";
  if (scope === "class") {
    const definition = reference.classes[parentIndex];
    return `${definition?.roman || ""}. ${definition?.short || ""}`;
  }
  const block = reference.blocks[parentIndex];
  const cls = reference.classes[block?.class];
  return `${cls?.roman || ""} → ${block?.code || ""}`;
}

export function treemapBreadcrumbs(
  reference: TreemapReferenceData,
  scope: TreemapScope,
  parentIndex: number
): TreemapBreadcrumb[] {
  const parts: TreemapBreadcrumb[] = [{ level: "root", label: "Все классы", current: scope === "root" }];
  if (scope !== "root") {
    const classIndex = scope === "class" ? parentIndex : reference.blocks[parentIndex]?.class;
    const cls = reference.classes[classIndex];
    parts.push({ level: "class", label: `${cls?.roman || ""} · ${cls?.short || ""}`, current: scope === "class" });
  }
  if (scope === "block") {
    const block = reference.blocks[parentIndex];
    parts.push({ level: "block", label: `${block?.code || ""} · ${block?.label || ""}`, current: true });
  }
  return parts;
}

export function buildTreemapViewModel<T extends AtlasObservation>(
  currentRows: readonly T[],
  comparisonRows: readonly T[],
  reference: TreemapReferenceData,
  options: TreemapViewOptions
): TreemapViewModel<T> {
  const definitions = definitionsFor(reference, options.scope, options.parentIndex);
  const yearIndex = new Map(reference.years.map((year, index) => [year, index]));
  const grouped = new Map(definitions.map((definition) => [definition.i, {
    ...definition,
    rows: [] as T[],
    yearCounts: new Array(reference.years.length).fill(0) as number[],
    yearPgpzh: new Array(reference.years.length).fill(0) as number[]
  }]));

  currentRows.forEach((row) => {
    const entry = grouped.get(indexForRow(row, options.scope, reference.codes));
    if (entry) entry.rows.push(row);
  });
  comparisonRows.forEach((row) => {
    const entry = grouped.get(indexForRow(row, options.scope, reference.codes));
    const position = yearIndex.get(row[0]);
    if (!entry || position === undefined) return;
    entry.yearCounts[position] += 1;
    if (row[2] >= 0) entry.yearPgpzh[position] += Math.max(75 - row[2], 0);
  });

  const aggregated = [...grouped.values()].flatMap((entry) => {
    if (!entry.rows.length) return [];
    const summary = summarizeObservations(entry.rows);
    const value = metricValue(summary.n, summary.pgpzh, currentRows.length, reference, options);
    if (value <= 0) return [];
    return [{
      ...entry,
      ...summary,
      value,
      rate: annualRate(summary.n, reference, options.selectedYear),
      share: summary.n / Math.max(currentRows.length, 1) * 100,
      change: itemChange(entry.yearCounts, entry.yearPgpzh, reference, options),
      series: [...entry.yearCounts]
    } satisfies TreemapItem<T>];
  });

  const rawItems = sortItems(aggregated, options.sort);
  const totalValue = rawItems.reduce((sum, item) => sum + item.value, 0);
  const threshold = Math.max(0, Number.isFinite(options.minShare) ? options.minShare : 0);
  const small = threshold > 0
    ? rawItems.filter((item) => item.value / Math.max(totalValue, 1) * 100 < threshold)
    : [];
  const large = small.length >= 2 ? rawItems.filter((item) => !small.includes(item)) : rawItems;
  const items = small.length >= 2
    ? sortItems([...large, aggregateOther(small, reference, options)], options.sort)
    : rawItems;

  return {
    scopeKey: `${options.scope}:${options.parentIndex}`,
    contextLabel: treemapContextLabel(reference, options.scope, options.parentIndex),
    breadcrumbs: treemapBreadcrumbs(reference, options.scope, options.parentIndex),
    rawItems,
    items,
    currentRows,
    totalValue: items.reduce((sum, item) => sum + item.value, 0),
    totalRows: currentRows.length
  };
}
