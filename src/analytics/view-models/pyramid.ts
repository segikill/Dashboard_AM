import { blockIndexOf, classIndexOf, type AtlasCodeReference } from "../classification";
import { quantile, summarizeObservations, type AtlasObservation, type AtlasYearFilter } from "../core";

export type PyramidView = "structure" | "trend" | "gap";
export type PyramidLevel = "class" | "block" | "code";
export type PyramidMetric = "n" | "share" | "pgpzh";

export interface PyramidClassDefinition {
  roman: string;
  short: string;
  color?: string;
}

export interface PyramidBlockDefinition {
  class: number;
  code: string;
  label: string;
}

export interface PyramidCodeDefinition extends AtlasCodeReference {
  code: string;
  label: string;
}

export interface PyramidReferenceData {
  years: readonly number[];
  classes: readonly PyramidClassDefinition[];
  blocks: readonly PyramidBlockDefinition[];
  codes: readonly PyramidCodeDefinition[];
}

export interface PyramidViewOptions {
  view: PyramidView;
  level: PyramidLevel;
  parentClass: "all" | number;
  cause: "all" | number;
  metric: PyramidMetric;
  ageStep: 5 | 10;
  selectedYear: AtlasYearFilter;
}

export interface PyramidCauseDefinition {
  index: number;
  code: string;
  label: string;
  classIndex: number;
}

export interface PyramidSexAggregate {
  n: number;
  pgpzh: number;
  ages: number[];
  share: number;
  value: number;
}

export interface PyramidBin {
  index: number;
  start: number;
  end: number;
  label: string;
  male: PyramidSexAggregate;
  female: PyramidSexAggregate;
  total: number;
}

export interface PyramidAggregate {
  bins: PyramidBin[];
  maleTotal: number;
  femaleTotal: number;
  total: number;
  maleMedian: number | null;
  femaleMedian: number | null;
}

export interface PyramidContext {
  key: string;
  ageIndex: number;
  ageLabel: string;
  start: number;
  end: number;
  total: number;
  maleN: number;
  femaleN: number;
  maleShare: number;
  femaleShare: number;
  ratio: number | null;
  pgpzhMale: number;
  pgpzhFemale: number;
  baselineTotal: number | null;
  changePercent: number | null;
  leadingClass: string;
  title: string;
  subtitle: string;
  primary: { label: string; value: string };
  change?: { value: string };
  metrics: Array<{ label: string; value: string; className?: string; title?: string }>;
  details: Array<{ label: string; value: string }>;
  insight: string;
}

export interface PyramidKpis {
  total: number;
  median: number | null;
  pgpzh: number;
  linkedPercent: number | null;
  leadingClass: { index: number; count: number; definition: PyramidClassDefinition } | null;
}

export interface PyramidViewModel<T extends AtlasObservation = AtlasObservation> {
  firstYear: number;
  lastYear: number;
  periodLabel: string;
  causeLabel: string;
  definitions: PyramidCauseDefinition[];
  currentRows: T[];
  baselineRows: T[];
  kpiRows: T[];
  current: PyramidAggregate;
  baseline: PyramidAggregate | null;
  items: PyramidContext[];
  peak: PyramidBin | null;
  kpis: PyramidKpis;
}

const ruNumber = (value: number, digits = 0): string => new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
}).format(Number(value) || 0);

const signed = (value: number | null, suffix = ""): string => {
  if (value == null || !Number.isFinite(value)) return "н/д";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${ruNumber(Math.abs(value), 1)}${suffix}`;
};

export function pyramidMetricLabel(metric: PyramidMetric): string {
  return ({ n: "количество смертей", share: "доля внутри пола", pgpzh: "ПГПЖ-75" })[metric];
}

export function pyramidCauseDefinitions(
  reference: PyramidReferenceData,
  options: Pick<PyramidViewOptions, "level" | "parentClass">
): PyramidCauseDefinition[] {
  if (options.level === "block") {
    return reference.blocks.map((definition, index) => ({ index, code: definition.code, label: definition.label, classIndex: definition.class }))
      .filter((item) => options.parentClass === "all" || item.classIndex === options.parentClass);
  }
  if (options.level === "code") {
    return reference.codes.map((definition, index) => ({ index, code: definition.code, label: definition.label, classIndex: definition.class }))
      .filter((item) => options.parentClass === "all" || item.classIndex === options.parentClass);
  }
  return reference.classes.map((definition, index) => ({ index, code: definition.roman, label: definition.short, classIndex: index }));
}

export function pyramidCauseLabel(reference: PyramidReferenceData, options: PyramidViewOptions): string {
  const selected = pyramidCauseDefinitions(reference, options).find((item) => item.index === options.cause);
  if (selected) return `${selected.code} · ${selected.label}`;
  if (options.level !== "class" && options.parentClass !== "all") {
    const definition = reference.classes[options.parentClass];
    return definition ? `Все причины класса ${definition.roman}` : "Все причины";
  }
  return "Все причины смерти";
}

function rowCauseIndex(row: AtlasObservation, reference: PyramidReferenceData, level: PyramidLevel): number {
  if (level === "class") return classIndexOf(row, reference.codes);
  if (level === "block") return blockIndexOf(row, reference.codes);
  return row[3];
}

function matchesCause(row: AtlasObservation, reference: PyramidReferenceData, options: PyramidViewOptions): boolean {
  if (row[3] < 0 && (options.cause !== "all" || options.parentClass !== "all")) return false;
  if (options.level !== "class" && options.parentClass !== "all" && classIndexOf(row, reference.codes) !== options.parentClass) return false;
  return options.cause === "all" || rowCauseIndex(row, reference, options.level) === options.cause;
}

function periodRows<T extends AtlasObservation>(
  records: readonly T[],
  reference: PyramidReferenceData,
  options: PyramidViewOptions,
  year: number | null,
  applyCause = true
): T[] {
  return records.filter((row) => {
    if (row[2] < 0 || row[2] > 110) return false;
    if (year != null && row[0] !== year) return false;
    if (year == null && options.selectedYear !== "all" && row[0] !== Number(options.selectedYear)) return false;
    return !applyCause || matchesCause(row, reference, options);
  });
}

function binDefinitions(step: 5 | 10): Array<Pick<PyramidBin, "index" | "start" | "end" | "label">> {
  const count = step === 10 ? 9 : 18;
  return Array.from({ length: count }, (_, index) => {
    const start = index * step;
    const last = index === count - 1;
    return { index, start, end: last ? 110 : start + step - 1, label: last ? `${start}+` : `${start}–${start + step - 1}` };
  });
}

function aggregate(rows: readonly AtlasObservation[], options: PyramidViewOptions): PyramidAggregate {
  const bins: PyramidBin[] = binDefinitions(options.ageStep).map((definition) => ({
    ...definition,
    male: { n: 0, pgpzh: 0, ages: [], share: 0, value: 0 },
    female: { n: 0, pgpzh: 0, ages: [], share: 0, value: 0 },
    total: 0
  }));
  rows.forEach((row) => {
    if (row[1] !== 1 && row[1] !== 2) return;
    const bin = bins.find((item) => row[2] >= item.start && row[2] <= item.end);
    if (!bin) return;
    const target = row[1] === 1 ? bin.male : bin.female;
    target.n += 1;
    target.pgpzh += Math.max(75 - row[2], 0);
    target.ages.push(row[2]);
  });
  const maleTotal = bins.reduce((sum, item) => sum + item.male.n, 0);
  const femaleTotal = bins.reduce((sum, item) => sum + item.female.n, 0);
  bins.forEach((item) => {
    item.male.share = maleTotal ? item.male.n / maleTotal * 100 : 0;
    item.female.share = femaleTotal ? item.female.n / femaleTotal * 100 : 0;
    item.male.value = options.metric === "share" ? item.male.share : options.metric === "pgpzh" ? item.male.pgpzh : item.male.n;
    item.female.value = options.metric === "share" ? item.female.share : options.metric === "pgpzh" ? item.female.pgpzh : item.female.n;
    item.total = item.male.n + item.female.n;
  });
  return {
    bins,
    maleTotal,
    femaleTotal,
    total: maleTotal + femaleTotal,
    maleMedian: quantile(rows.filter((row) => row[1] === 1).map((row) => row[2]), .5),
    femaleMedian: quantile(rows.filter((row) => row[1] === 2).map((row) => row[2]), .5)
  };
}

function leadingClass(rows: readonly AtlasObservation[], reference: PyramidReferenceData): PyramidKpis["leadingClass"] {
  const counts = new Array(reference.classes.length).fill(0);
  rows.forEach((row) => {
    const index = classIndexOf(row, reference.codes);
    if (index >= 0) counts[index] += 1;
  });
  const maximum = Math.max(...counts, 0);
  const index = counts.indexOf(maximum);
  return index < 0 || !maximum ? null : { index, count: maximum, definition: reference.classes[index] };
}

function contextFor<T extends AtlasObservation>(
  bin: PyramidBin,
  current: PyramidAggregate,
  baseline: PyramidAggregate | null,
  records: readonly T[],
  reference: PyramidReferenceData,
  options: PyramidViewOptions,
  firstYear: number,
  lastYear: number,
  label: string
): PyramidContext {
  const baseBin = baseline?.bins.find((item) => item.index === bin.index);
  const baselineTotal = baseBin?.total ?? null;
  const changePercent = baselineTotal != null && baselineTotal > 0 ? (bin.total - baselineTotal) / baselineTotal * 100 : null;
  const ageRows = periodRows(records, reference, options, options.view === "trend" ? lastYear : null, false)
    .filter((row) => row[2] >= bin.start && row[2] <= bin.end);
  const lead = leadingClass(ageRows, reference);
  const maleShare = current.maleTotal ? bin.male.n / current.maleTotal * 100 : 0;
  const femaleShare = current.femaleTotal ? bin.female.n / current.femaleTotal * 100 : 0;
  const ratio = bin.female.n ? bin.male.n / bin.female.n : bin.male.n ? null : 0;
  const dominance = bin.male.n === bin.female.n
    ? "Число мужских и женских наблюдений одинаково."
    : bin.male.n > bin.female.n
      ? `Мужских наблюдений в ${ruNumber(bin.female.n ? bin.male.n / bin.female.n : bin.male.n, 1)} раза больше женских.`
      : `Женских наблюдений в ${ruNumber(bin.male.n ? bin.female.n / bin.male.n : bin.female.n, 1)} раза больше мужских.`;
  const trendText = options.view !== "trend" ? ""
    : changePercent == null ? `Для расчёта изменения между ${firstYear} и ${lastYear} недостаточно исходных наблюдений.`
      : changePercent > 0 ? `Между ${firstYear} и ${lastYear} число наблюдений выросло на ${ruNumber(changePercent, 1)}%.`
        : changePercent < 0 ? `Между ${firstYear} и ${lastYear} число наблюдений снизилось на ${ruNumber(Math.abs(changePercent), 1)}%.`
          : `Между ${firstYear} и ${lastYear} число наблюдений не изменилось.`;
  return {
    key: `age:${bin.index}`,
    ageIndex: bin.index,
    ageLabel: bin.label,
    start: bin.start,
    end: bin.end,
    total: bin.total,
    maleN: bin.male.n,
    femaleN: bin.female.n,
    maleShare,
    femaleShare,
    ratio,
    pgpzhMale: bin.male.pgpzh,
    pgpzhFemale: bin.female.pgpzh,
    baselineTotal,
    changePercent,
    leadingClass: lead ? `${lead.definition.roman}. ${lead.definition.short}` : "н/д",
    title: `Возраст ${bin.label} лет`,
    subtitle: `${label} · ${options.view === "trend" ? `${firstYear} → ${lastYear}` : options.selectedYear === "all" ? `${firstYear}–${lastYear}` : options.selectedYear}`,
    primary: { label: "наблюдений в возрастной группе", value: ruNumber(bin.total) },
    change: options.view === "trend" ? { value: signed(changePercent, "%") } : undefined,
    metrics: [
      { label: "Мужчины", value: `${ruNumber(bin.male.n)} · ${ruNumber(maleShare, 1)}%`, className: "is-male" },
      { label: "Женщины", value: `${ruNumber(bin.female.n)} · ${ruNumber(femaleShare, 1)}%`, className: "is-female" },
      { label: "Соотношение М / Ж", value: ratio == null ? "только мужчины" : ratio ? `${ruNumber(ratio, 2)} : 1` : "н/д" },
      { label: "Ведущий класс возраста", value: lead ? `${lead.definition.roman}. ${lead.definition.short}` : "н/д", title: lead?.definition.short || "" }
    ],
    details: [
      { label: "ПГПЖ-75 · мужчины", value: ruNumber(bin.male.pgpzh) },
      { label: "ПГПЖ-75 · женщины", value: ruNumber(bin.female.pgpzh) },
      ...(baseBin ? [
        { label: `${firstYear} · наблюдений`, value: ruNumber(baselineTotal || 0) },
        { label: `${lastYear} · наблюдений`, value: ruNumber(bin.total) }
      ] : [])
    ],
    insight: `${dominance} ${trendText}${lead ? ` Ведущий класс в этом возрасте — ${lead.definition.roman}. ${lead.definition.short}.` : ""}`.trim()
  };
}

export function buildPyramidViewModel<T extends AtlasObservation>(
  records: readonly T[],
  reference: PyramidReferenceData,
  options: PyramidViewOptions
): PyramidViewModel<T> {
  const sortedYears = [...reference.years].sort((left, right) => left - right);
  const firstYear = sortedYears[0];
  const lastYear = sortedYears[sortedYears.length - 1];
  const currentYear = options.view === "trend" ? lastYear : null;
  const currentRows = periodRows(records, reference, options, currentYear);
  const baselineRows = options.view === "trend" ? periodRows(records, reference, options, firstYear) : [];
  const current = aggregate(currentRows, options);
  const baseline = options.view === "trend" ? aggregate(baselineRows, options) : null;
  const kpiRows = options.view === "trend" ? [...baselineRows, ...currentRows] : [...currentRows];
  const causeLabel = pyramidCauseLabel(reference, options);
  const items = current.bins.map((bin) => contextFor(bin, current, baseline, records, reference, options, firstYear, lastYear, causeLabel));
  const peak = [...current.bins].sort((left, right) => right.total - left.total)[0] || null;
  const summary = summarizeObservations(kpiRows);
  const linked = kpiRows.filter((row) => row[5] >= 0).length;
  return {
    firstYear,
    lastYear,
    periodLabel: options.view === "trend" ? `${firstYear} → ${lastYear}` : options.selectedYear === "all" ? `${firstYear}–${lastYear}` : String(options.selectedYear),
    causeLabel,
    definitions: pyramidCauseDefinitions(reference, options),
    currentRows,
    baselineRows,
    kpiRows,
    current,
    baseline,
    items,
    peak,
    kpis: {
      total: kpiRows.length,
      median: summary.median,
      pgpzh: summary.pgpzh,
      linkedPercent: kpiRows.length ? linked / kpiRows.length * 100 : null,
      leadingClass: leadingClass(kpiRows, reference)
    }
  };
}
