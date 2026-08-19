import { describe, expect, it } from "vitest";
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
import {
  validateLegacyData,
  validateLegacyDotogram,
  validateLegacyHeader,
  validateLegacyInfrastructureChrome,
  validateLegacyHeatmap,
  validateLegacyMapChrome,
  validateLegacyNavigation,
  validateLegacyPlot,
  validateLegacyPyramid,
  validateLegacyRank,
  validateLegacyState,
  validateLegacyTreemap
} from "./validation";

const validSummary: LegacyDataSummary = {
  regionKey: "amur",
  regionName: "Амурская область",
  period: "2023–2025",
  records: 30232,
  years: [2023, 2024, 2025],
  classes: 22,
  blocks: 133,
  codes: 577,
  municipalities: 29,
  settlements: 632
};

describe("legacy compatibility validation", () => {
  it("accepts the current atlas data contract", () => {
    expect(validateLegacyData(validSummary)).toEqual({ ok: true, errors: [] });
  });

  it("detects a broken ICD dictionary", () => {
    const result = validateLegacyData({ ...validSummary, classes: 21 });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("22 класса");
  });

  it("accepts the supported view and global filters", () => {
    const state: LegacyStateSnapshot = { view: "treemap", year: "2025", sex: "2", age: "65_79" };
    expect(validateLegacyState(state)).toEqual({ ok: true, errors: [] });
  });

  it("keeps the filtered header count inside the dataset boundary", () => {
    const header: LegacyHeaderSummary = {
      periodLabel: "2025",
      filteredRecords: 1850,
      svgAvailable: true,
      actionMessage: ""
    };
    expect(validateLegacyHeader(header, validSummary)).toEqual({ ok: true, errors: [] });
    expect(validateLegacyHeader({ ...header, filteredRecords: 40000 }, validSummary).ok).toBe(false);
  });

  it("accepts the map shell panel contract", () => {
    const map: LegacyMapChromeSummary = {
      active: true,
      leftPanelOpen: true,
      rightPanelOpen: false,
      compactInspector: true,
      mapMounted: true,
      selectedLabel: ""
    };
    expect(validateLegacyMapChrome(map)).toEqual({ ok: true, errors: [] });
  });

  it("accepts the infrastructure shell contract", () => {
    const infrastructure: LegacyInfrastructureChromeSummary = {
      active: true,
      panelOpen: true,
      mapMounted: true,
      facilities: 417
    };
    expect(validateLegacyInfrastructureChrome(infrastructure)).toEqual({ ok: true, errors: [] });
  });

  it("accepts the eight-view navigation contract", () => {
    const navigation: LegacyNavigationSummary = {
      activeView: "plot",
      panelOpen: true,
      viewCount: 8
    };
    expect(validateLegacyNavigation(navigation)).toEqual({ ok: true, errors: [] });
    expect(validateLegacyNavigation({ ...navigation, viewCount: 7 }).ok).toBe(false);
  });

  it("accepts the typed Treemap interface contract", () => {
    const treemap: LegacyTreemapSummary = {
      active: true,
      level: "root",
      metric: "n",
      color: "count",
      sort: "value",
      showValues: true,
      minShare: 0.5,
      contextLabel: "Все классы МКБ-10",
      breadcrumbs: [{ level: "root", label: "Все классы", current: true }],
      selected: {
        key: "root:8",
        code: "IX",
        label: "Болезни системы кровообращения",
        color: "#3677ac",
        entityType: "class",
        metricValue: "8 106",
        metricUnit: "смертей",
        deaths: 8106,
        share: 26.8,
        rate: 353.5,
        medianAge: 73,
        pgpzh75: 42000,
        change: -2.1,
        series: [2600, 2700, 2806],
        drillLabel: "Открыть крупные блоки"
      },
      children: []
    };
    expect(validateLegacyTreemap(treemap)).toEqual({ ok: true, errors: [] });
    expect(validateLegacyTreemap({ ...treemap, minShare: 4 }).ok).toBe(false);
  });

  it("accepts the typed Heatmap interface contract", () => {
    const heatmap: LegacyHeatmapSummary = {
      active: true,
      unit: "mo",
      metric: "share",
      limit: "25",
      rows: 29,
      columns: 22,
      selected: {
        key: "mo:3:8",
        territory: "Благовещенск (г.)",
        territoryType: "city",
        classIndex: 8,
        classCode: "IX",
        className: "Кровообращение",
        classColor: "#3677ac",
        metricValue: 45.2,
        metricText: "45,2%",
        metricLabel: "доля выбранного класса",
        deaths: 1830,
        totalDeaths: 4049,
        population: 241437,
        share: 45.2,
        territoryRank: 2,
        territoryCount: 29,
        causeRank: 1,
        causeCount: 22,
        formula: ""
      },
      topTerritories: []
    };
    expect(validateLegacyHeatmap(heatmap)).toEqual({ ok: true, errors: [] });
    expect(validateLegacyHeatmap({ ...heatmap, rows: -1 }).ok).toBe(false);
  });

  it("accepts the typed Arrow diagram interface contract", () => {
    const selected = {
      key: "class:8",
      code: "IX",
      label: "Болезни системы кровообращения",
      color: "#3677ac",
      title: "IX · Болезни системы кровообращения",
      subtitle: "2023 → 2025 · количество смертей",
      primaryLabel: "2025 · количество смертей",
      primaryValue: "4 470",
      changeValue: "−6,8%",
      rankDelta: 0,
      relativeDelta: -6.8,
      valueDelta: -328,
      shareDelta: -0.5,
      rankBefore: 1,
      rankAfter: 1,
      valueBefore: 4798,
      valueAfter: 4470,
      valueBeforeText: "4 798",
      valueAfterText: "4 470",
      shareBefore: 46.1,
      shareAfter: 45.6,
      medianAge: 73,
      pgpzh75: 32000,
      insight: "Ранг не изменился."
    };
    const rank: LegacyRankSummary = {
      active: true,
      view: "compare",
      compare: "time",
      level: "class",
      classIndex: "all",
      metric: "n",
      top: "15",
      onlyChanges: false,
      itemCount: 18,
      slices: ["2023", "2025"],
      classOptions: [{ value: "8", label: "IX. Кровообращение" }],
      selected,
      movers: [selected]
    };
    expect(validateLegacyRank(rank)).toEqual({ ok: true, errors: [] });
    expect(validateLegacyRank({ ...rank, top: "30" as "15" }).ok).toBe(false);
  });

  it("accepts the typed age-sex pyramid interface contract", () => {
    const selected = {
      key: "age:13",
      ageIndex: 13,
      ageLabel: "65–69",
      start: 65,
      end: 69,
      total: 3100,
      maleN: 1400,
      femaleN: 1700,
      maleShare: 14.2,
      femaleShare: 15.1,
      ratio: 0.82,
      pgpzhMale: 7200,
      pgpzhFemale: 8100,
      baselineTotal: 2950,
      changePercent: 5.1,
      leadingClass: "IX. Кровообращение",
      title: "Возраст 65–69 лет",
      subtitle: "Все причины смерти · 2023 → 2025",
      insight: "Женских наблюдений больше мужских.",
      rank: 1,
      binCount: 18
    };
    const pyramid: LegacyPyramidSummary = {
      active: true,
      view: "trend",
      level: "class",
      parentClass: "all",
      cause: "all",
      metric: "n",
      ageStep: "5",
      labels: "major",
      firstYear: 2023,
      lastYear: 2025,
      periodLabel: "2023 → 2025",
      causeLabel: "Все причины смерти",
      classOptions: [{ value: "8", label: "IX. Кровообращение" }],
      causeOptions: [{ value: "8", label: "IX · Кровообращение" }],
      total: 25000,
      maleTotal: 11500,
      femaleTotal: 13500,
      peakLabel: "65–69",
      selected,
      topBins: [selected]
    };
    expect(validateLegacyPyramid(pyramid)).toEqual({ ok: true, errors: [] });
    expect(validateLegacyPyramid({ ...pyramid, femaleTotal: 13000 }).ok).toBe(false);
  });

  it("accepts the typed age-at-death interface contract", () => {
    const plot: LegacyPlotSummary = {
      active: true,
      view: "profile",
      level: "block",
      classIndex: "8",
      cause: "41",
      interval: "p10p90",
      sort: "n",
      minN: "10",
      top: "15",
      compare: "time",
      yearA: "2023",
      yearB: "2025",
      distributionMetric: "n",
      years: [2023, 2024, 2025],
      classOptions: [{ value: "8", label: "IX. Кровообращение" }],
      causeOptions: [{ value: "41", label: "I20–I25 · Ишемическая болезнь сердца" }],
      sliceLabels: [],
      itemCount: 15,
      selectedKey: "block:41",
      context: {
        key: "block:41",
        title: "I20–I25 · Ишемическая болезнь сердца",
        subtitle: "2023–2025 · оба пола",
        primaryLabel: "медианный возраст смерти",
        primaryValue: "72,0 года",
        changeValue: "+3,0 года",
        metrics: [{ label: "Наблюдений", value: "5 815" }],
        details: [{ label: "Ширина IQR", value: "18,0 года" }],
        insight: "Медиана выше общей медианы текущего среза.",
        action: { id: "plot-distribution", label: "Открыть распределение", cause: "41", level: "block" }
      },
      topItems: [{
        key: "block:41",
        index: 41,
        code: "I20–I25",
        label: "Ишемическая болезнь сердца",
        color: "#2f6da5",
        n: 5815,
        median: 72,
        q1: 64,
        q3: 82,
        p10: 52,
        p90: 91,
        min: 18,
        max: 108,
        iqr: 18,
        pgpzh75: 38858,
        under75: 58.2,
        firstMedian: null,
        secondMedian: null,
        deltaMedian: null,
        rank: 1
      }]
    };
    expect(validateLegacyPlot(plot)).toEqual({ ok: true, errors: [] });
    expect(validateLegacyPlot({ ...plot, minN: "3" as "10" }).ok).toBe(false);
  });

  it("accepts the typed territory Dotogram interface contract", () => {
    const selected = {
      key: "settlement:41",
      index: 41,
      name: "Благовещенск",
      territoryType: "г",
      municipality: "Благовещенск (г.)",
      population: 241437,
      value: 18.7,
      valueText: "18,7",
      totalDeaths: 4049,
      selectedDeaths: 4049,
      share: 100,
      medianAge: 69,
      pgpzh75: 28000,
      leadingClass: "IX. Кровообращение",
      color: "#3677ac",
      formula: "4 049 / 241 437 / 3 × 1 000",
      rank: 1,
      isOutlier: true,
      insight: "Значение выше медианы территорий."
    };
    const dotogram: LegacyDotogramSummary = {
      active: true,
      unit: "settlement",
      metric: "per1k",
      classIndex: "all",
      labels: "outliers",
      metricLabel: "на 1 000 населения · в среднем за год",
      classOptions: [{ value: "8", label: "IX. Кровообращение" }],
      itemCount: 506,
      medianValue: 11.2,
      medianText: "11,2",
      selectedKey: selected.key,
      selected,
      topItems: [selected]
    };
    expect(validateLegacyDotogram(dotogram)).toEqual({ ok: true, errors: [] });
    expect(validateLegacyDotogram({ ...dotogram, labels: "all" as "top" }).ok).toBe(false);
  });
});
