import type {
  LegacyDataSummary,
  LegacyDotogramSummary,
  LegacyHeaderSummary,
  LegacyInfrastructureChromeSummary,
  LegacyHeatmapSummary,
  LegacyMapChromeSummary,
  LegacyNavigationSummary,
  LegacyPlotSummary,
  LegacyPyramidSummary,
  LegacyRankSummary,
  LegacyTreemapSummary,
  LegacyStateSnapshot
} from "./types";

const VALID_VIEWS = new Set([
  "map",
  "infrastructure",
  "treemap",
  "heatmap",
  "arrow",
  "pyramid",
  "plot",
  "dotogram"
]);

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateLegacyData(summary: LegacyDataSummary): ValidationResult {
  const errors: string[] = [];

  if (summary.regionKey !== "amur") errors.push("Неожиданный ключ региона");
  if (!summary.regionName.trim()) errors.push("Не задано название региона");
  if (summary.records <= 0) errors.push("Массив наблюдений пуст");
  if (summary.years.length === 0) errors.push("Не задан период наблюдений");
  if (summary.classes !== 22) errors.push(`Ожидалось 22 класса МКБ-10, получено ${summary.classes}`);
  if (summary.blocks <= 0 || summary.codes <= 0) errors.push("Справочник МКБ-10 неполон");
  if (summary.municipalities <= 0 || summary.settlements <= 0) errors.push("Географические справочники пусты");

  return { ok: errors.length === 0, errors };
}

export function validateLegacyState(snapshot: LegacyStateSnapshot): ValidationResult {
  const errors: string[] = [];
  if (!VALID_VIEWS.has(snapshot.view)) errors.push(`Неизвестная визуализация: ${snapshot.view}`);
  if (!new Set(["all", "1", "2"]).has(snapshot.sex)) errors.push(`Неизвестный фильтр пола: ${snapshot.sex}`);
  if (!new Set(["all", "0_14", "15_44", "45_64", "65_79", "80P"]).has(snapshot.age)) {
    errors.push(`Неизвестный возрастной фильтр: ${snapshot.age}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateLegacyHeader(
  header: LegacyHeaderSummary,
  data: LegacyDataSummary
): ValidationResult {
  const errors: string[] = [];
  if (!header.periodLabel.trim()) errors.push("Не задан период в верхней строке");
  if (!Number.isInteger(header.filteredRecords) || header.filteredRecords < 0) {
    errors.push("Некорректное число наблюдений в фильтре");
  }
  if (header.filteredRecords > data.records) {
    errors.push("Число наблюдений в фильтре превышает общий объём данных");
  }
  return { ok: errors.length === 0, errors };
}

export function validateLegacyMapChrome(map: LegacyMapChromeSummary): ValidationResult {
  const errors: string[] = [];
  if (typeof map.active !== "boolean") errors.push("Некорректное состояние карты");
  if (typeof map.leftPanelOpen !== "boolean" || typeof map.rightPanelOpen !== "boolean") {
    errors.push("Некорректное состояние панелей карты");
  }
  if (typeof map.mapMounted !== "boolean" || typeof map.compactInspector !== "boolean") {
    errors.push("Некорректное состояние картографической оболочки");
  }
  return { ok: errors.length === 0, errors };
}

export function validateLegacyInfrastructureChrome(
  infrastructure: LegacyInfrastructureChromeSummary
): ValidationResult {
  const errors: string[] = [];
  if (typeof infrastructure.active !== "boolean" || typeof infrastructure.panelOpen !== "boolean") {
    errors.push("Некорректное состояние панели инфраструктуры");
  }
  if (typeof infrastructure.mapMounted !== "boolean") {
    errors.push("Некорректное состояние инфраструктурной карты");
  }
  if (!Number.isInteger(infrastructure.facilities) || infrastructure.facilities < 0) {
    errors.push("Некорректное число медицинских объектов");
  }
  return { ok: errors.length === 0, errors };
}

export function validateLegacyNavigation(navigation: LegacyNavigationSummary): ValidationResult {
  const errors: string[] = [];
  if (!VALID_VIEWS.has(navigation.activeView)) {
    errors.push(`Неизвестная активная вкладка: ${navigation.activeView}`);
  }
  if (typeof navigation.panelOpen !== "boolean") {
    errors.push("Некорректное состояние боковой панели");
  }
  if (navigation.viewCount !== VALID_VIEWS.size) {
    errors.push(`Ожидалось ${VALID_VIEWS.size} вкладок, получено ${navigation.viewCount}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateLegacyTreemap(treemap: LegacyTreemapSummary): ValidationResult {
  const errors: string[] = [];
  if (!new Set(["root", "class", "block"]).has(treemap.level)) {
    errors.push(`Неизвестный уровень Treemap: ${treemap.level}`);
  }
  if (!new Set(["n", "share", "pgpzh", "rate"]).has(treemap.metric)) {
    errors.push(`Неизвестная метрика Treemap: ${treemap.metric}`);
  }
  if (!new Set(["count", "change", "age"]).has(treemap.color)) {
    errors.push(`Неизвестная цветовая шкала Treemap: ${treemap.color}`);
  }
  if (treemap.minShare < 0 || treemap.minShare > 3) {
    errors.push("Порог малых категорий выходит за допустимый диапазон");
  }
  if (treemap.active && (!treemap.selected || treemap.breadcrumbs.length === 0)) {
    errors.push("Активный Treemap не содержит выбранной категории или пути");
  }
  return { ok: errors.length === 0, errors };
}

export function validateLegacyHeatmap(heatmap: LegacyHeatmapSummary): ValidationResult {
  const errors: string[] = [];
  if (!new Set(["mo", "settlement"]).has(heatmap.unit)) {
    errors.push(`Неизвестный уровень территории Heatmap: ${heatmap.unit}`);
  }
  if (!new Set(["share", "n", "per1k", "per10k", "per100k"]).has(heatmap.metric)) {
    errors.push(`Неизвестная метрика Heatmap: ${heatmap.metric}`);
  }
  if (!new Set(["25", "50", "all"]).has(heatmap.limit)) {
    errors.push(`Неизвестный лимит Heatmap: ${heatmap.limit}`);
  }
  if (heatmap.rows < 0 || heatmap.columns < 0) {
    errors.push("Размер матрицы не может быть отрицательным");
  }
  if (heatmap.active && (!heatmap.selected || heatmap.rows === 0 || heatmap.columns === 0)) {
    errors.push("Активная матрица не содержит выбранной ячейки или измерений");
  }
  return { ok: errors.length === 0, errors };
}

export function validateLegacyRank(rank: LegacyRankSummary): ValidationResult {
  const errors: string[] = [];
  if (!new Set(["compare", "trend"]).has(rank.view)) errors.push(`Неизвестный режим рангов: ${rank.view}`);
  if (!new Set(["time", "sex"]).has(rank.compare)) errors.push(`Неизвестное сравнение рангов: ${rank.compare}`);
  if (!new Set(["class", "block", "code"]).has(rank.level)) errors.push(`Неизвестный уровень рангов: ${rank.level}`);
  if (!new Set(["n", "share", "pgpzh"]).has(rank.metric)) errors.push(`Неизвестная метрика рангов: ${rank.metric}`);
  if (!new Set(["10", "15", "20"]).has(rank.top)) errors.push(`Некорректный размер рейтинга: ${rank.top}`);
  if (rank.itemCount < 0) errors.push("Число причин в рейтинге не может быть отрицательным");
  if (rank.active && (!rank.selected || rank.itemCount === 0 || rank.slices.length < 2)) {
    errors.push("Активная диаграмма рангов не содержит выбранной причины или сравниваемых срезов");
  }
  return { ok: errors.length === 0, errors };
}

export function validateLegacyPyramid(pyramid: LegacyPyramidSummary): ValidationResult {
  const errors: string[] = [];
  if (!new Set(["structure", "trend", "gap"]).has(pyramid.view)) {
    errors.push(`Неизвестный режим пирамиды: ${pyramid.view}`);
  }
  if (!new Set(["class", "block", "code"]).has(pyramid.level)) {
    errors.push(`Неизвестный уровень пирамиды: ${pyramid.level}`);
  }
  if (!new Set(["n", "share", "pgpzh"]).has(pyramid.metric)) {
    errors.push(`Неизвестная метрика пирамиды: ${pyramid.metric}`);
  }
  if (!new Set(["5", "10"]).has(pyramid.ageStep)) {
    errors.push(`Некорректный шаг возрастных групп: ${pyramid.ageStep}`);
  }
  if (!new Set(["major", "all", "off"]).has(pyramid.labels)) {
    errors.push(`Неизвестный режим подписей пирамиды: ${pyramid.labels}`);
  }
  if (pyramid.total < 0 || pyramid.maleTotal < 0 || pyramid.femaleTotal < 0) {
    errors.push("Число наблюдений пирамиды не может быть отрицательным");
  }
  if (pyramid.total !== pyramid.maleTotal + pyramid.femaleTotal) {
    errors.push("Итог пирамиды не совпадает с суммой мужского и женского профилей");
  }
  if (pyramid.active && (!pyramid.selected || pyramid.topBins.length === 0)) {
    errors.push("Активная пирамида не содержит выбранной или ведущей возрастной группы");
  }
  return { ok: errors.length === 0, errors };
}

export function validateLegacyPlot(plot: LegacyPlotSummary): ValidationResult {
  const errors: string[] = [];
  if (!new Set(["profile", "compare", "distribution"]).has(plot.view)) errors.push(`Неизвестный режим возраста: ${plot.view}`);
  if (!new Set(["class", "block", "code"]).has(plot.level)) errors.push(`Неизвестный уровень возраста: ${plot.level}`);
  if (!new Set(["p10p90", "range"]).has(plot.interval)) errors.push(`Неизвестный внешний интервал: ${plot.interval}`);
  if (!new Set(["n", "medianAsc", "medianDesc", "spread", "shift"]).has(plot.sort)) errors.push(`Неизвестная сортировка возраста: ${plot.sort}`);
  if (!new Set(["5", "10", "20", "50"]).has(plot.minN)) errors.push(`Некорректный порог выборки: ${plot.minN}`);
  if (!new Set(["15", "25"]).has(plot.top)) errors.push(`Некорректное число строк: ${plot.top}`);
  if (!new Set(["time", "sex"]).has(plot.compare)) errors.push(`Неизвестный режим сравнения возраста: ${plot.compare}`);
  if (!new Set(["n", "share"]).has(plot.distributionMetric)) errors.push(`Неизвестная шкала распределения: ${plot.distributionMetric}`);
  if (plot.itemCount < 0 || plot.topItems.some((item) => item.n < 0 || item.q1 > item.q3 || item.p10 > item.p90)) {
    errors.push("Некорректные агрегаты возраста");
  }
  if (plot.active && !plot.context) errors.push("Активная вкладка возраста не содержит аналитического контекста");
  return { ok: errors.length === 0, errors };
}

export function validateLegacyDotogram(dotogram: LegacyDotogramSummary): ValidationResult {
  const errors: string[] = [];
  if (!new Set(["settlement", "mo"]).has(dotogram.unit)) {
    errors.push(`Неизвестный уровень Dotogram: ${dotogram.unit}`);
  }
  if (!new Set(["n", "share", "median", "pgpzh", "per1k", "per10k", "per100k"]).has(dotogram.metric)) {
    errors.push(`Неизвестная метрика Dotogram: ${dotogram.metric}`);
  }
  if (!new Set(["outliers", "top", "off"]).has(dotogram.labels)) {
    errors.push(`Неизвестный режим подписей Dotogram: ${dotogram.labels}`);
  }
  if (dotogram.itemCount < 0 || dotogram.topItems.some((item) => item.rank < 1 || item.totalDeaths < 0 || item.selectedDeaths < 0)) {
    errors.push("Некорректные агрегаты территорий Dotogram");
  }
  if (dotogram.active && (!dotogram.selected || dotogram.itemCount === 0 || !dotogram.metricLabel.trim())) {
    errors.push("Активная Dotogram не содержит выбранной территории или показателя");
  }
  return { ok: errors.length === 0, errors };
}
