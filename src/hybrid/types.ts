export type AtlasView =
  | "map"
  | "infrastructure"
  | "treemap"
  | "heatmap"
  | "arrow"
  | "pyramid"
  | "plot"
  | "dotogram";

export type AtlasSex = "all" | "1" | "2";
export type AtlasAge = "all" | "0_14" | "15_44" | "45_64" | "65_79" | "80P";

export interface LegacyStateSnapshot {
  view: AtlasView;
  year: "all" | string;
  sex: AtlasSex;
  age: AtlasAge;
}

export interface LegacyDataSummary {
  regionKey: string;
  regionName: string;
  period: string;
  records: number;
  years: number[];
  classes: number;
  blocks: number;
  codes: number;
  municipalities: number;
  settlements: number;
}

export type AtlasHeaderAction = "share" | "svg" | "csv" | "help";

export interface LegacyHeaderSummary {
  periodLabel: string;
  filteredRecords: number;
  svgAvailable: boolean;
  actionMessage: string;
}

export type AtlasMapPanel = "left" | "right";
export type AtlasMapAction = "fit";

export interface LegacyMapChromeSummary {
  active: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  compactInspector: boolean;
  mapMounted: boolean;
  selectedLabel: string;
}

export type AtlasInfrastructureAction = "fit";

export interface LegacyInfrastructureChromeSummary {
  active: boolean;
  panelOpen: boolean;
  mapMounted: boolean;
  facilities: number;
}

export interface LegacyNavigationSummary {
  activeView: AtlasView;
  panelOpen: boolean;
  viewCount: number;
}

export type AtlasTreemapLevel = "root" | "class" | "block";
export type AtlasTreemapMetric = "n" | "share" | "pgpzh" | "rate";
export type AtlasTreemapColor = "count" | "change" | "age";
export type AtlasTreemapSort = "value" | "name" | "change";

export interface LegacyTreemapBreadcrumb {
  level: AtlasTreemapLevel;
  label: string;
  current: boolean;
}

export interface LegacyTreemapItemSummary {
  key: string;
  code: string;
  label: string;
  color: string;
  entityType: "class" | "block" | "code" | "other";
  metricValue: string;
  metricUnit: string;
  deaths: number;
  share: number;
  rate: number | null;
  medianAge: number | null;
  pgpzh75: number;
  change: number | null;
  series: number[];
  drillLabel: string;
}

export interface LegacyTreemapSummary {
  active: boolean;
  level: AtlasTreemapLevel;
  metric: AtlasTreemapMetric;
  color: AtlasTreemapColor;
  sort: AtlasTreemapSort;
  showValues: boolean;
  minShare: number;
  contextLabel: string;
  breadcrumbs: LegacyTreemapBreadcrumb[];
  selected: LegacyTreemapItemSummary | null;
  children: LegacyTreemapItemSummary[];
}

export type AtlasTreemapOption = "metric" | "color" | "sort" | "showValues" | "minShare";

export type AtlasHeatmapUnit = "mo" | "settlement";
export type AtlasHeatmapMetric = "share" | "n" | "per1k" | "per10k" | "per100k";
export type AtlasHeatmapLimit = "25" | "50" | "all";

export interface LegacyHeatmapCellSummary {
  key: string;
  territory: string;
  territoryType: string;
  classIndex: number;
  classCode: string;
  className: string;
  classColor: string;
  metricValue: number | null;
  metricText: string;
  metricLabel: string;
  deaths: number;
  totalDeaths: number;
  population: number | null;
  share: number;
  territoryRank: number;
  territoryCount: number;
  causeRank: number;
  causeCount: number;
  formula: string;
}

export interface LegacyHeatmapSummary {
  active: boolean;
  unit: AtlasHeatmapUnit;
  metric: AtlasHeatmapMetric;
  limit: AtlasHeatmapLimit;
  rows: number;
  columns: number;
  selected: LegacyHeatmapCellSummary | null;
  topTerritories: LegacyHeatmapCellSummary[];
}

export type AtlasHeatmapOption = "unit" | "metric" | "limit";

export type AtlasRankView = "compare" | "trend";
export type AtlasRankCompare = "time" | "sex";
export type AtlasRankLevel = "class" | "block" | "code";
export type AtlasRankMetric = "n" | "share" | "pgpzh";
export type AtlasRankTop = "10" | "15" | "20";

export interface LegacyRankClassOption {
  value: string;
  label: string;
}

export interface LegacyRankItemSummary {
  key: string;
  code: string;
  label: string;
  color: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryValue: string;
  changeValue: string;
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
  insight: string;
}

export interface LegacyRankSummary {
  active: boolean;
  view: AtlasRankView;
  compare: AtlasRankCompare;
  level: AtlasRankLevel;
  classIndex: string;
  metric: AtlasRankMetric;
  top: AtlasRankTop;
  onlyChanges: boolean;
  itemCount: number;
  slices: string[];
  classOptions: LegacyRankClassOption[];
  selected: LegacyRankItemSummary | null;
  movers: LegacyRankItemSummary[];
}

export type AtlasRankOption = "view" | "compare" | "level" | "classIndex" | "metric" | "top" | "onlyChanges";

export type AtlasPyramidView = "structure" | "trend" | "gap";
export type AtlasPyramidLevel = "class" | "block" | "code";
export type AtlasPyramidMetric = "n" | "share" | "pgpzh";
export type AtlasPyramidAgeStep = "5" | "10";
export type AtlasPyramidLabels = "major" | "all" | "off";

export interface LegacyPyramidOptionEntry {
  value: string;
  label: string;
}

export interface LegacyPyramidBinSummary {
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
  insight: string;
  rank: number;
  binCount: number;
}

export interface LegacyPyramidSummary {
  active: boolean;
  view: AtlasPyramidView;
  level: AtlasPyramidLevel;
  parentClass: string;
  cause: string;
  metric: AtlasPyramidMetric;
  ageStep: AtlasPyramidAgeStep;
  labels: AtlasPyramidLabels;
  firstYear: number;
  lastYear: number;
  periodLabel: string;
  causeLabel: string;
  classOptions: LegacyPyramidOptionEntry[];
  causeOptions: LegacyPyramidOptionEntry[];
  total: number;
  maleTotal: number;
  femaleTotal: number;
  peakLabel: string;
  selected: LegacyPyramidBinSummary | null;
  topBins: LegacyPyramidBinSummary[];
}

export type AtlasPyramidOption = "view" | "level" | "parentClass" | "cause" | "metric" | "ageStep" | "labels";

export type AtlasPlotView = "profile" | "compare" | "distribution";
export type AtlasPlotLevel = "class" | "block" | "code";
export type AtlasPlotInterval = "p10p90" | "range";
export type AtlasPlotSort = "n" | "medianAsc" | "medianDesc" | "spread" | "shift";
export type AtlasPlotMinN = "5" | "10" | "20" | "50";
export type AtlasPlotTop = "15" | "25";
export type AtlasPlotCompare = "time" | "sex";
export type AtlasPlotDistributionMetric = "n" | "share";

export interface LegacyPlotOptionEntry {
  value: string;
  label: string;
}

export interface LegacyPlotMetricEntry {
  label: string;
  value: string;
}

export interface LegacyPlotContextSummary {
  key: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryValue: string;
  changeValue: string;
  metrics: LegacyPlotMetricEntry[];
  details: LegacyPlotMetricEntry[];
  insight: string;
  action: { id: string; label: string; cause: string; level: string } | null;
}

export interface LegacyPlotItemSummary {
  key: string;
  index: number;
  code: string;
  label: string;
  color: string;
  n: number;
  median: number;
  q1: number;
  q3: number;
  p10: number;
  p90: number;
  min: number;
  max: number;
  iqr: number;
  pgpzh75: number;
  under75: number;
  firstMedian: number | null;
  secondMedian: number | null;
  deltaMedian: number | null;
  rank: number;
}

export interface LegacyPlotSummary {
  active: boolean;
  view: AtlasPlotView;
  level: AtlasPlotLevel;
  classIndex: string;
  cause: string;
  interval: AtlasPlotInterval;
  sort: AtlasPlotSort;
  minN: AtlasPlotMinN;
  top: AtlasPlotTop;
  compare: AtlasPlotCompare;
  yearA: string;
  yearB: string;
  distributionMetric: AtlasPlotDistributionMetric;
  years: number[];
  classOptions: LegacyPlotOptionEntry[];
  causeOptions: LegacyPlotOptionEntry[];
  sliceLabels: string[];
  itemCount: number;
  selectedKey: string | null;
  context: LegacyPlotContextSummary | null;
  topItems: LegacyPlotItemSummary[];
}

export type AtlasPlotOption = "view" | "level" | "classIndex" | "cause" | "interval" | "sort" | "minN" | "top" | "compare" | "yearA" | "yearB" | "distributionMetric";

export type AtlasDotogramUnit = "settlement" | "mo";
export type AtlasDotogramMetric = "n" | "share" | "median" | "pgpzh" | "per1k" | "per10k" | "per100k";
export type AtlasDotogramLabels = "outliers" | "top" | "off";

export interface LegacyDotogramOptionEntry {
  value: string;
  label: string;
}

export interface LegacyDotogramItemSummary {
  key: string;
  index: number;
  name: string;
  territoryType: string;
  municipality: string;
  population: number | null;
  value: number;
  valueText: string;
  totalDeaths: number;
  selectedDeaths: number;
  share: number;
  medianAge: number | null;
  pgpzh75: number;
  leadingClass: string;
  color: string;
  formula: string;
  rank: number;
  isOutlier: boolean;
  insight?: string;
}

export interface LegacyDotogramSummary {
  active: boolean;
  unit: AtlasDotogramUnit;
  metric: AtlasDotogramMetric;
  classIndex: string;
  labels: AtlasDotogramLabels;
  metricLabel: string;
  classOptions: LegacyDotogramOptionEntry[];
  itemCount: number;
  medianValue: number | null;
  medianText: string;
  selectedKey: string | null;
  selected: LegacyDotogramItemSummary | null;
  topItems: LegacyDotogramItemSummary[];
}

export type AtlasDotogramOption = "unit" | "metric" | "classIndex" | "labels";

export interface AtlasLegacyBridge {
  readonly version: "1";
  getSnapshot(): LegacyStateSnapshot;
  getDataSummary(): LegacyDataSummary;
  getHeaderSummary(): LegacyHeaderSummary;
  getMapChromeSummary(): LegacyMapChromeSummary;
  getInfrastructureChromeSummary(): LegacyInfrastructureChromeSummary;
  getNavigationSummary(): LegacyNavigationSummary;
  getTreemapSummary(): LegacyTreemapSummary;
  getHeatmapSummary(): LegacyHeatmapSummary;
  getRankSummary(): LegacyRankSummary;
  getPyramidSummary(): LegacyPyramidSummary;
  getPlotSummary(): LegacyPlotSummary;
  getDotogramSummary(): LegacyDotogramSummary;
  setGlobalFilters(filters: Partial<Pick<LegacyStateSnapshot, "year" | "sex" | "age">>): void;
  setView(view: AtlasView): void;
  setNavigationPanel(open: boolean): void;
  triggerHeaderAction(action: AtlasHeaderAction): void;
  setMapPanel(panel: AtlasMapPanel, open: boolean): void;
  triggerMapAction(action: AtlasMapAction): void;
  setInfrastructurePanel(open: boolean): void;
  triggerInfrastructureAction(action: AtlasInfrastructureAction): void;
  setTreemapOption(option: AtlasTreemapOption, value: string | number | boolean): void;
  setTreemapLevel(level: AtlasTreemapLevel): void;
  triggerTreemapAction(action: "reset" | "drill"): void;
  selectTreemapChild(key: string): void;
  setHeatmapOption(option: AtlasHeatmapOption, value: string): void;
  selectHeatmapCell(key: string): void;
  setRankOption(option: AtlasRankOption, value: string | boolean): void;
  selectRankItem(key: string): void;
  setPyramidOption(option: AtlasPyramidOption, value: string): void;
  selectPyramidItem(key: string): void;
  setPlotOption(option: AtlasPlotOption, value: string): void;
  selectPlotItem(key: string): void;
  triggerPlotAction(action: "distribution"): void;
  setDotogramOption(option: AtlasDotogramOption, value: string): void;
  selectDotogramItem(key: string): void;
  subscribe(listener: () => void): () => void;
}

declare global {
  interface Window {
    AtlasLegacyBridge?: AtlasLegacyBridge;
    AmurDotogramAnalysis?: {
      getSummary(): LegacyDotogramSummary;
      setOption(option: AtlasDotogramOption, value: string): void;
      selectItem(key: string): void;
    };
  }
}
