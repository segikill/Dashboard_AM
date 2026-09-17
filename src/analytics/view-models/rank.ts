import { blockIndexOf, classIndexOf, type AtlasCodeReference } from "../classification";
import { quantile, type AtlasObservation } from "../core";
import { rankItemsDescending } from "../ranking";

export type RankLevel = "class" | "block" | "code";
export type RankMetric = "n" | "share" | "pgpzh";

export interface RankClassDefinition {
  roman: string;
  short: string;
  color: string;
}

export interface RankBlockDefinition {
  class: number;
  code: string;
  label: string;
}

export interface RankCodeDefinition extends AtlasCodeReference {
  code: string;
  label: string;
}

export interface RankReferenceData {
  classes: readonly RankClassDefinition[];
  blocks: readonly RankBlockDefinition[];
  codes: readonly RankCodeDefinition[];
}

export interface RankSlice<T extends AtlasObservation = AtlasObservation> {
  key: string;
  label: string;
  note: string;
  rows: readonly T[];
}

export interface RankViewOptions {
  level: RankLevel;
  classIndex: "all" | number;
  metric: RankMetric;
  top: number;
  onlyChanges: boolean;
}

export interface RankDefinition {
  key: string;
  index: number;
  classIndex: number;
  code: string;
  label: string;
  color: string;
}

export interface RankSeriesItem extends RankDefinition {
  rank: number;
  n: number;
  share: number;
  pgpzh: number;
  median: number | null;
  value: number;
}

export interface RankInspectorMetric {
  label: string;
  value: string;
  className?: string;
}

export interface RankInspectorContext {
  key: string;
  code: string;
  label: string;
  color: string;
  title: string;
  subtitle: string;
  primary: { label: string; value: string };
  change: { value: string };
  rankDelta: number;
  relativeDelta: number | null;
  valueDelta: number;
  shareDelta: number;
  rankBefore: number;
  rankAfter: number;
  valueBefore: number;
  valueAfter: number;
  valueBeforeText: string;
  valueAfterText: string;
  shareBefore: number;
  shareAfter: number;
  medianAge: number | null;
  pgpzh75: number;
  metrics: RankInspectorMetric[];
  details: RankInspectorMetric[];
  insight: string;
}

export interface RankTrajectory {
  definition: RankDefinition;
  series: RankSeriesItem[];
  context: RankInspectorContext;
}

export interface RankViewModel {
  labels: string[];
  slices: readonly RankSlice[];
  definitions: RankDefinition[];
  rankings: RankSeriesItem[][];
  items: RankTrajectory[];
}

const ruNumber = (value: number, digits = 0): string => new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits
}).format(Number(value) || 0);

const signed = (value: number | null, suffix = ""): string => {
  if (value == null || !Number.isFinite(value)) return "н/д";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${ruNumber(Math.abs(value), 1)}${suffix}`;
};

export function rankMetricLabel(metric: RankMetric): string {
  return ({ n: "количество смертей", share: "доля внутри среза", pgpzh: "ПГПЖ-75" })[metric];
}

export function formatRankMetric(value: number, metric: RankMetric): string {
  return metric === "share" ? `${ruNumber(value, 1)}%` : ruNumber(value, 0);
}

export function rankDefinitions(reference: RankReferenceData, options: Pick<RankViewOptions, "level" | "classIndex">): RankDefinition[] {
  if (options.level === "block") {
    return reference.blocks.map((definition, index) => ({
      key: `block:${index}`,
      index,
      classIndex: definition.class,
      code: definition.code,
      label: definition.label,
      color: reference.classes[definition.class]?.color || "#5c7f9f"
    })).filter((item) => options.classIndex === "all" || item.classIndex === options.classIndex);
  }
  if (options.level === "code") {
    return reference.codes.map((definition, index) => ({
      key: `code:${index}`,
      index,
      classIndex: definition.class,
      code: definition.code,
      label: definition.label,
      color: reference.classes[definition.class]?.color || "#5c7f9f"
    })).filter((item) => options.classIndex === "all" || item.classIndex === options.classIndex);
  }
  return reference.classes.map((definition, index) => ({
    key: `class:${index}`,
    index,
    classIndex: index,
    code: definition.roman,
    label: definition.short,
    color: definition.color
  }));
}

function rowCauseIndex(row: AtlasObservation, reference: RankReferenceData, level: RankLevel): number {
  if (level === "class") return classIndexOf(row, reference.codes);
  if (level === "block") return blockIndexOf(row, reference.codes);
  return row[3];
}

function aggregateSlice(
  rows: readonly AtlasObservation[],
  definitions: readonly RankDefinition[],
  reference: RankReferenceData,
  options: RankViewOptions
): RankSeriesItem[] {
  const byIndex = new Map(definitions.map((definition) => [definition.index, {
    ...definition,
    n: 0,
    pgpzh: 0,
    ages: [] as number[]
  }]));
  let denominator = 0;
  rows.forEach((row) => {
    const classIndex = classIndexOf(row, reference.codes);
    if (classIndex < 0 || (options.classIndex !== "all" && options.level !== "class" && classIndex !== options.classIndex)) return;
    const item = byIndex.get(rowCauseIndex(row, reference, options.level));
    if (!item) return;
    denominator += 1;
    item.n += 1;
    if (row[2] >= 0) {
      item.ages.push(row[2]);
      item.pgpzh += Math.max(75 - row[2], 0);
    }
  });
  const items = [...byIndex.values()].filter((item) => item.n > 0).map((item) => {
    const share = denominator ? item.n / denominator * 100 : 0;
    const value = options.metric === "share" ? share : options.metric === "pgpzh" ? item.pgpzh : item.n;
    return {
      key: item.key,
      index: item.index,
      classIndex: item.classIndex,
      code: item.code,
      label: item.label,
      color: item.color,
      rank: 0,
      n: item.n,
      share,
      pgpzh: item.pgpzh,
      median: quantile(item.ages, .5),
      value
    };
  });
  return rankItemsDescending(items, (item) => item.value, (left, right) => right.n - left.n || left.index - right.index);
}

function missingSeries(definition: RankDefinition, rank: number): RankSeriesItem {
  return { ...definition, rank, n: 0, share: 0, pgpzh: 0, median: null, value: 0 };
}

function positionWord(value: number): string {
  return value % 10 === 1 && value % 100 !== 11
    ? "позицию"
    : value % 10 >= 2 && value % 10 <= 4 && !(value % 100 >= 12 && value % 100 <= 14)
      ? "позиции"
      : "позиций";
}

export function buildRankContext(
  definition: RankDefinition,
  series: readonly RankSeriesItem[],
  labels: readonly string[],
  metric: RankMetric
): RankInspectorContext {
  const first = series[0];
  const last = series[series.length - 1];
  const rankDelta = first.rank - last.rank;
  const valueDelta = last.value - first.value;
  const relativeDelta = first.value > 0 ? valueDelta / first.value * 100 : null;
  const shareDelta = last.share - first.share;
  const count = Math.abs(rankDelta);
  const toneClass = rankDelta > 0 ? "is-rise" : rankDelta < 0 ? "is-fall" : "is-stable";
  const rankPhrase = rankDelta === 0
    ? `Ранг не изменился: ${first.rank}-е место`
    : `Ранг ${rankDelta > 0 ? "повысился" : "понизился"} на ${count} ${positionWord(count)}: с ${first.rank}-го на ${last.rank}-е место`;
  const volumePhrase = relativeDelta == null
    ? "Относительное изменение не рассчитывается из-за нулевого исходного значения."
    : relativeDelta > 0 ? `Выбранный показатель вырос на ${ruNumber(relativeDelta, 1)}%.`
      : relativeDelta < 0 ? `Выбранный показатель снизился на ${ruNumber(Math.abs(relativeDelta), 1)}%.`
        : "Выбранный показатель не изменился.";
  const metricLabel = rankMetricLabel(metric);
  const metricUnit = metric === "share" ? "%" : metric === "pgpzh" ? " лет" : "";
  return {
    key: definition.key,
    code: definition.code,
    label: definition.label,
    color: definition.color,
    title: `${definition.code} · ${definition.label}`,
    subtitle: `${labels[0]} → ${labels[labels.length - 1]} · ${metricLabel}`,
    primary: { label: `${labels[labels.length - 1]} · ${metricLabel}`, value: formatRankMetric(last.value, metric) },
    change: { value: signed(relativeDelta, "%") },
    rankDelta,
    relativeDelta,
    valueDelta,
    shareDelta,
    rankBefore: first.rank,
    rankAfter: last.rank,
    valueBefore: first.value,
    valueAfter: last.value,
    valueBeforeText: formatRankMetric(first.value, metric),
    valueAfterText: formatRankMetric(last.value, metric),
    shareBefore: first.share,
    shareAfter: last.share,
    medianAge: last.median,
    pgpzh75: last.pgpzh,
    metrics: [
      { label: "Изменение ранга", value: rankDelta === 0 ? "без изменения" : `${rankDelta > 0 ? "↑" : "↓"} ${Math.abs(rankDelta)}`, className: toneClass },
      { label: `${labels[0]} → ${labels[labels.length - 1]}`, value: `${first.rank} → ${last.rank} место` },
      { label: "Изменение значения", value: signed(valueDelta, metricUnit), className: relativeDelta != null && relativeDelta > 0 ? "is-rise" : relativeDelta != null && relativeDelta < 0 ? "is-fall" : "" },
      { label: "Изменение доли", value: signed(shareDelta, " п.п.") }
    ],
    details: [
      { label: `${labels[0]} · значение`, value: formatRankMetric(first.value, metric) },
      { label: `${labels[labels.length - 1]} · значение`, value: formatRankMetric(last.value, metric) },
      { label: `${labels[0]} · доля`, value: `${ruNumber(first.share, 1)}%` },
      { label: `${labels[labels.length - 1]} · доля`, value: `${ruNumber(last.share, 1)}%` },
      { label: "Медианный возраст", value: last.median == null ? "н/д" : `${ruNumber(last.median, 0)} лет` },
      { label: "ПГПЖ-75", value: ruNumber(last.pgpzh, 0) }
    ],
    insight: `${definition.code} · ${definition.label}. ${rankPhrase}. ${volumePhrase}`
  };
}

export function buildRankViewModel<T extends AtlasObservation>(
  slices: readonly RankSlice<T>[],
  reference: RankReferenceData,
  options: RankViewOptions
): RankViewModel {
  const definitions = rankDefinitions(reference, options);
  const rankings = slices.map((slice) => aggregateSlice(slice.rows, definitions, reference, options));
  const top = Math.max(5, options.top || 15);
  let keys = [...new Set(rankings.flatMap((list) => list.slice(0, top).map((item) => item.key)))];
  if (options.onlyChanges) {
    keys = keys.filter((key) => {
      const positions = rankings.map((list) => list.find((item) => item.key === key)?.rank ?? Number.MAX_SAFE_INTEGER);
      return positions.some((position, index) => index > 0 && position !== positions[index - 1]);
    });
  }
  const maps = rankings.map((list) => new Map(list.map((item) => [item.key, item])));
  const labels = slices.map((slice) => slice.label);
  const items = keys.flatMap((key) => {
    const definition = definitions.find((item) => item.key === key);
    if (!definition) return [];
    const series = maps.map((map, index) => map.get(key) || missingSeries(definition, rankings[index].length + 1));
    return [{ definition, series, context: buildRankContext(definition, series, labels, options.metric) }];
  });
  return { labels, slices, definitions, rankings, items };
}
