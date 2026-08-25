const { chromium } = require("playwright");
const { chromiumLaunchOptions } = require("./playwright_launch.cjs");

const base = process.env.ATLAS_URL || "http://127.0.0.1:8765/";

(async () => {
  const browser = await chromium.launch(chromiumLaunchOptions());
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.setDefaultTimeout(20_000);
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log("SMOKE: page loaded");
  await page.waitForFunction(
    () => document.querySelector("[data-react-hybrid-root]")?.dataset.reactStatus === "ready",
    { timeout: 15_000 }
  );
  console.log("SMOKE: React islands ready");
  await page.waitForFunction(
    () => document.querySelector("[data-react-global-filters]")?.dataset.reactStatus === "ready",
    { timeout: 15_000 }
  );
  await page.waitForFunction(
    () => document.querySelector("[data-react-header-status]")?.dataset.reactStatus === "ready",
    { timeout: 15_000 }
  );
  await page.waitForSelector("[data-react-navigation-ready]", { state: "visible" });
  await page.waitForFunction(() => window.AtlasLegacyBridge.getMapChromeSummary().mapMounted);

  const initial = await page.evaluate(() => ({
    analyticsCore: (() => {
      const core = window.AmurAtlasAnalyticsCore;
      const all = core?.stats(window.AMUR_ATLAS_DATA.records);
      const filtered = core?.filterRecords(
        window.AMUR_ATLAS_DATA.records,
        { year: "2025", sex: "2", age: "65_79" }
      );
      const classCounts = core?.classCounts(
        window.AMUR_ATLAS_DATA.records,
        window.AMUR_ATLAS_DATA.codes,
        window.AMUR_ATLAS_DATA.classes.length
      ) || [];
      const municipalities = core?.aggregateTerritories(
        window.AMUR_ATLAS_DATA.records,
        window.AMUR_ATLAS_DATA.codes,
        { unit: "mo", classCount: window.AMUR_ATLAS_DATA.classes.length, includeUnmappedCodes: false }
      );
      const settlements = core?.aggregateTerritories(
        window.AMUR_ATLAS_DATA.records,
        window.AMUR_ATLAS_DATA.codes,
        {
          unit: "settlement",
          classCount: window.AMUR_ATLAS_DATA.classes.length,
          selectedClass: "all",
          includeUnmappedCodes: true
        }
      );
      const territoryTotal = (items) => items
        ? [...items.values()].reduce((sum, item) => sum + item.total, 0)
        : null;
      const blagoveshchenskDeaths = window.AMUR_ATLAS_DATA.records
        .filter((record) => record[4] === 3).length;
      const blagoveshchenskRate = core?.calculateRate(
        blagoveshchenskDeaths,
        window.AMUR_ATLAS_DATA.municipalities[3],
        "per1k",
        { year: "all", availableYears: window.AMUR_ATLAS_DATA.years }
      );
      const rankedValues = core?.rankValues([0.2, 0.5, 0.3]) || [];
      return {
        version: core?.version || null,
        records: all?.n ?? null,
        median: all?.median ?? null,
        pgpzh: all?.pgpzh ?? null,
        filteredRecords: filtered?.length ?? null,
        mappedIcd: classCounts.reduce((sum, value) => sum + value, 0),
        leadingClass: classCounts.indexOf(Math.max(...classCounts)),
        leadingClassRecords: Math.max(...classCounts),
        municipalityIcdRows: territoryTotal(municipalities),
        municipalities: municipalities?.size ?? null,
        settlementRows: territoryTotal(settlements),
        settlements: settlements?.size ?? null,
        rateDeaths: blagoveshchenskDeaths,
        ratePopulation: blagoveshchenskRate?.population ?? null,
        ratePeriodYears: blagoveshchenskRate?.periodYears ?? null,
        rateDenominator: blagoveshchenskRate?.denominator ?? null,
        ratePer1k: blagoveshchenskRate ? Number(blagoveshchenskRate.value.toFixed(12)) : null,
        rateYearsLabel: core?.rateYearsLabel(blagoveshchenskRate?.periodYears ?? 0) ?? null,
        rankOrder: rankedValues.map((item) => item.i).join(","),
        ordinalRanks: rankedValues.map((item) => item.rank).join(",")
      };
    })(),
    summary: window.AtlasLegacyBridge.getDataSummary(),
    state: window.AtlasLegacyBridge.getSnapshot(),
    hidden: document.querySelector("[data-react-hybrid-root]").hidden,
    reactFiltersVisible: !document.querySelector("[data-react-global-filters]").hidden,
    legacyFiltersHidden: document.querySelector("[data-legacy-global-filters]").hidden,
    header: window.AtlasLegacyBridge.getHeaderSummary(),
    reactHeaderVisible: !document.querySelector("[data-react-header-status]").hidden,
    legacyHeaderHidden: document.querySelector("[data-legacy-header-status]").hidden
      && document.querySelector("[data-legacy-header-actions]").hidden,
    navigation: window.AtlasLegacyBridge.getNavigationSummary(),
    reactNavigationVisible: !document.querySelector("[data-react-navigation-rail]").hidden,
    legacyNavigationHidden: document.querySelector("[data-legacy-navigation-rail]").offsetParent === null,
    reactNavigationButtons: document.querySelectorAll("[data-react-navigation-view]").length,
    initialMapCanvas: Boolean(window.__initialMapCanvas = document.querySelector(".mortality-map canvas")),
    spatialStatus: window.AmurAtlasDataLoader?.getStatus?.(),
    spatialScriptPresent: Boolean(document.getElementById("amur-atlas-spatial-data"))
  }));
  if (
    initial.analyticsCore.version !== "1"
    || initial.analyticsCore.records !== 30232
    || initial.analyticsCore.median !== 69
    || initial.analyticsCore.pgpzh !== 337976
    || initial.analyticsCore.filteredRecords !== 1850
    || initial.analyticsCore.mappedIcd !== 30127
    || initial.analyticsCore.leadingClass !== 8
    || initial.analyticsCore.leadingClassRecords !== 13795
    || initial.analyticsCore.municipalityIcdRows !== 30045
    || initial.analyticsCore.municipalities !== 29
    || initial.analyticsCore.settlementRows !== 29506
    || initial.analyticsCore.settlements !== 503
    || initial.analyticsCore.rateDeaths !== 9480
    || initial.analyticsCore.ratePopulation !== 246767
    || initial.analyticsCore.ratePeriodYears !== 3
    || initial.analyticsCore.rateDenominator !== 740301
    || initial.analyticsCore.ratePer1k !== 12.805602045654
    || initial.analyticsCore.rateYearsLabel !== "3 года"
    || initial.analyticsCore.rankOrder !== "1,2,0"
    || initial.analyticsCore.ordinalRanks !== "1,2,3"
  ) {
    errors.push(`analytics core regression: ${JSON.stringify(initial.analyticsCore)}`);
  } else {
    console.log("SMOKE: typed analytics core matches control aggregates");
  }

  await page.click('[data-react-navigation-view="treemap"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getSnapshot().view === "treemap");
  await page.waitForSelector("[data-react-treemap-controls-ready]", { state: "visible" });
  await page.waitForSelector("[data-react-treemap-breadcrumbs-ready]", { state: "visible" });
  await page.waitForSelector("[data-react-treemap-inspector-ready]", { state: "visible" });
  const treemapInitial = await page.evaluate(() => ({
    summary: window.AtlasLegacyBridge.getTreemapSummary(),
    controlsVisible: !document.querySelector("[data-react-treemap-controls]").hidden,
    legacyControlsHidden: document.querySelector("[data-legacy-local-controls]").offsetParent === null,
    legacyBreadcrumbsHidden: document.querySelector("[data-legacy-treemap-breadcrumbs]").offsetParent === null,
    legacyInspectorHidden: document.querySelector("[data-legacy-treemap-inspector]").offsetParent === null
  }));
  if (
    !treemapInitial.summary.active
    || treemapInitial.summary.level !== "root"
    || !treemapInitial.summary.selected
    || !treemapInitial.controlsVisible
    || !treemapInitial.legacyControlsHidden
    || !treemapInitial.legacyBreadcrumbsHidden
    || !treemapInitial.legacyInspectorHidden
  ) {
    errors.push(`treemap fallback swap: ${JSON.stringify(treemapInitial)}`);
  }

  await page.selectOption('[data-react-treemap-option="metric"]', "rate");
  await page.selectOption('[data-react-treemap-option="color"]', "age");
  await page.locator('[data-react-treemap-option="minShare"]').fill("0.8");
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getTreemapSummary();
    return summary.metric === "rate" && summary.color === "age" && summary.minShare === 0.8;
  });

  const secondRootTile = page.locator('.treev2-canvas .tile[data-tree-key^="root:"]').nth(1);
  const selectedKey = await secondRootTile.getAttribute("data-tree-key");
  await secondRootTile.click();
  await page.waitForFunction((key) => window.AtlasLegacyBridge.getTreemapSummary().selected?.key === key, selectedKey);
  await secondRootTile.click();
  await page.waitForFunction(() => window.AtlasLegacyBridge.getTreemapSummary().level === "class");
  await page.click('[data-react-treemap-breadcrumbs-ready] button:first-of-type');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getTreemapSummary().level === "root");
  console.log("SMOKE: React Treemap controls, inspector and drill-down synchronized");

  await page.click('[data-react-navigation-view="heatmap"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getSnapshot().view === "heatmap");
  await page.waitForSelector("[data-react-heatmap-controls-ready]", { state: "visible" });
  await page.waitForSelector("[data-react-heatmap-inspector-ready]", { state: "visible" });
  const heatmapInitial = await page.evaluate(() => ({
    summary: window.AtlasLegacyBridge.getHeatmapSummary(),
    controlsVisible: !document.querySelector("[data-react-heatmap-controls]").hidden,
    legacyControlsHidden: document.querySelector("[data-legacy-local-controls]").offsetParent === null,
    legacyInspectorHidden: document.querySelector("[data-legacy-heatmap-inspector]").offsetParent === null
  }));
  if (
    !heatmapInitial.summary.active
    || heatmapInitial.summary.unit !== "mo"
    || heatmapInitial.summary.rows !== 29
    || heatmapInitial.summary.columns < 20
    || !heatmapInitial.summary.selected
    || !heatmapInitial.controlsVisible
    || !heatmapInitial.legacyControlsHidden
    || !heatmapInitial.legacyInspectorHidden
  ) {
    errors.push(`heatmap fallback swap: ${JSON.stringify(heatmapInitial)}`);
  }

  await page.selectOption('[data-react-heatmap-option="metric"]', "per100k");
  await page.waitForFunction(() => window.AtlasLegacyBridge.getHeatmapSummary().metric === "per100k");
  await page.selectOption('[data-react-heatmap-option="unit"]', "settlement");
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getHeatmapSummary();
    return summary.unit === "settlement" && summary.rows === 25;
  });
  await page.selectOption('[data-react-heatmap-option="limit"]', "50");
  await page.waitForFunction(() => window.AtlasLegacyBridge.getHeatmapSummary().rows === 50);
  await page.selectOption('[data-react-heatmap-option="unit"]', "mo");
  await page.waitForFunction(() => window.AtlasLegacyBridge.getHeatmapSummary().unit === "mo");
  const heatmapCell = page.locator(".heatv2-cell").nth(1);
  const heatmapCellKey = await heatmapCell.getAttribute("data-heatmap-key");
  await heatmapCell.click();
  await page.waitForFunction((key) => window.AtlasLegacyBridge.getHeatmapSummary().selected?.key === key, heatmapCellKey);
  console.log("SMOKE: React Heatmap controls, selection and territory limits synchronized");

  await page.click('[data-react-navigation-view="arrow"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getSnapshot().view === "arrow");
  await page.waitForSelector("[data-react-rank-controls-ready]", { state: "visible" });
  await page.waitForSelector("[data-react-rank-inspector-ready]", { state: "visible" });
  const rankInitial = await page.evaluate(() => ({
    summary: window.AtlasLegacyBridge.getRankSummary(),
    controlsVisible: !document.querySelector("[data-react-rank-controls]").hidden,
    legacyControlsHidden: document.querySelector("[data-legacy-local-controls]").offsetParent === null,
    legacyInspectorHidden: document.querySelector("[data-legacy-hybrid-inspector-content]").offsetParent === null
  }));
  if (
    !rankInitial.summary.active
    || rankInitial.summary.view !== "compare"
    || rankInitial.summary.compare !== "time"
    || rankInitial.summary.level !== "class"
    || rankInitial.summary.itemCount < 10
    || rankInitial.summary.slices.length !== 2
    || !rankInitial.summary.selected
    || !rankInitial.controlsVisible
    || !rankInitial.legacyControlsHidden
    || !rankInitial.legacyInspectorHidden
  ) {
    errors.push(`rank fallback swap: ${JSON.stringify(rankInitial)}`);
  }

  const secondMover = page.locator(".react-rank-movers button").nth(1);
  const moverKey = await secondMover.evaluate((button) => button.querySelector("b")?.textContent || "");
  await secondMover.click();
  await page.waitForFunction((code) => window.AtlasLegacyBridge.getRankSummary().selected?.code === code, moverKey);
  await page.click('[data-react-rank-option="compare"][data-value="sex"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getRankSummary().compare === "sex");
  await page.selectOption('[data-react-rank-option="level"]', "block");
  await page.waitForFunction(() => window.AtlasLegacyBridge.getRankSummary().level === "block");
  await page.selectOption('[data-react-rank-option="metric"]', "share");
  await page.selectOption('[data-react-rank-option="top"]', "10");
  await page.locator('input[data-react-rank-option="onlyChanges"]').check();
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getRankSummary();
    return summary.metric === "share" && summary.top === "10" && summary.onlyChanges;
  });
  await page.click('[data-react-rank-option="view"][data-value="trend"]');
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getRankSummary();
    return summary.view === "trend" && summary.slices.length === 3;
  });
  await page.click('[data-react-rank-option="view"][data-value="compare"]');
  await page.selectOption('[data-react-rank-option="level"]', "class");
  await page.selectOption('[data-react-rank-option="metric"]', "n");
  await page.selectOption('[data-react-rank-option="top"]', "15");
  await page.locator('input[data-react-rank-option="onlyChanges"]').uncheck();
  await page.click('[data-react-rank-option="compare"][data-value="time"]');
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getRankSummary();
    return summary.view === "compare" && summary.compare === "time" && summary.level === "class"
      && summary.metric === "n" && summary.top === "15" && !summary.onlyChanges;
  });
  console.log("SMOKE: React Arrow controls, inspector, modes and selection synchronized");

  await page.click('[data-react-navigation-view="pyramid"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getSnapshot().view === "pyramid");
  await page.waitForSelector("[data-react-pyramid-controls-ready]", { state: "visible" });
  await page.waitForSelector("[data-react-pyramid-inspector-ready]", { state: "visible" });
  const pyramidInitial = await page.evaluate(() => ({
    summary: window.AtlasLegacyBridge.getPyramidSummary(),
    controlsVisible: !document.querySelector("[data-react-pyramid-controls]").hidden,
    legacyControlsHidden: document.querySelector("[data-legacy-local-controls]").offsetParent === null,
    legacyInspectorHidden: document.querySelector("[data-legacy-hybrid-inspector-content]").offsetParent === null,
    yearDisabled: document.querySelector("[data-react-year-filter]").disabled,
    sexDisabled: document.querySelector("[data-react-sex-filter] button").disabled,
    ageDisabled: document.querySelector("[data-react-age-filter]").disabled
  }));
  if (
    !pyramidInitial.summary.active
    || pyramidInitial.summary.view !== "structure"
    || pyramidInitial.summary.level !== "class"
    || pyramidInitial.summary.metric !== "n"
    || pyramidInitial.summary.ageStep !== "5"
    || !pyramidInitial.summary.selected
    || pyramidInitial.summary.topBins.length === 0
    || pyramidInitial.summary.total !== pyramidInitial.summary.maleTotal + pyramidInitial.summary.femaleTotal
    || !pyramidInitial.controlsVisible
    || !pyramidInitial.legacyControlsHidden
    || !pyramidInitial.legacyInspectorHidden
    || pyramidInitial.yearDisabled
    || !pyramidInitial.sexDisabled
    || !pyramidInitial.ageDisabled
  ) {
    errors.push(`pyramid fallback swap: ${JSON.stringify(pyramidInitial)}`);
  }

  const secondAgeGroup = page.locator("[data-react-pyramid-key]").nth(1);
  const ageKey = await secondAgeGroup.getAttribute("data-react-pyramid-key");
  await secondAgeGroup.click();
  await page.waitForFunction((key) => window.AtlasLegacyBridge.getPyramidSummary().selected?.key === key, ageKey);
  await page.click('[data-react-pyramid-option="view"][data-value="trend"]');
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getPyramidSummary();
    return summary.view === "trend" && document.querySelector("[data-react-year-filter]").disabled;
  });
  await page.selectOption('[data-react-pyramid-option="level"]', "block");
  await page.selectOption('[data-react-pyramid-option="parentClass"]', "8");
  await page.selectOption('[data-react-pyramid-option="metric"]', "share");
  await page.selectOption('[data-react-pyramid-option="ageStep"]', "10");
  await page.selectOption('[data-react-pyramid-option="labels"]', "all");
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getPyramidSummary();
    return summary.level === "block" && summary.parentClass === "8" && summary.metric === "share"
      && summary.ageStep === "10" && summary.labels === "all" && summary.selected?.binCount === 9;
  });
  await page.click('[data-react-pyramid-option="view"][data-value="gap"]');
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getPyramidSummary();
    return summary.view === "gap" && !document.querySelector("[data-react-year-filter]").disabled;
  });
  await page.click('[data-react-pyramid-option="view"][data-value="structure"]');
  await page.selectOption('[data-react-pyramid-option="level"]', "class");
  await page.selectOption('[data-react-pyramid-option="metric"]', "n");
  await page.selectOption('[data-react-pyramid-option="ageStep"]', "5");
  await page.selectOption('[data-react-pyramid-option="labels"]', "major");
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getPyramidSummary();
    return summary.view === "structure" && summary.level === "class" && summary.metric === "n"
      && summary.ageStep === "5" && summary.labels === "major" && summary.selected?.binCount === 18;
  });
  console.log("SMOKE: React Pyramid controls, inspector, modes and age selection synchronized");

  await page.click('[data-react-navigation-view="plot"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getSnapshot().view === "plot");
  await page.waitForSelector("[data-react-plot-controls-ready]", { state: "visible" });
  await page.waitForSelector("[data-react-plot-inspector-ready]", { state: "visible" });
  const plotInitial = await page.evaluate(() => ({
    summary: window.AtlasLegacyBridge.getPlotSummary(),
    controlsVisible: !document.querySelector("[data-react-plot-controls]").hidden,
    legacyControlsHidden: document.querySelector("[data-legacy-local-controls]").offsetParent === null,
    legacyInspectorHidden: document.querySelector("[data-legacy-hybrid-inspector-content]").offsetParent === null,
    legacyTabsHidden: document.querySelector(".plot-workspace-tabs").offsetParent === null,
    yearDisabled: document.querySelector("[data-react-year-filter]").disabled,
    sexDisabled: document.querySelector("[data-react-sex-filter] button").disabled
  }));
  if (
    !plotInitial.summary.active
    || plotInitial.summary.view !== "profile"
    || plotInitial.summary.level !== "class"
    || plotInitial.summary.minN !== "10"
    || plotInitial.summary.top !== "15"
    || plotInitial.summary.itemCount < 10
    || !plotInitial.summary.context
    || plotInitial.summary.topItems.length === 0
    || !plotInitial.controlsVisible
    || !plotInitial.legacyControlsHidden
    || !plotInitial.legacyInspectorHidden
    || !plotInitial.legacyTabsHidden
    || plotInitial.yearDisabled
    || plotInitial.sexDisabled
  ) {
    errors.push(`plot fallback swap: ${JSON.stringify(plotInitial)}`);
  }

  const secondPlotItem = page.locator("[data-react-plot-key]").nth(1);
  const plotItemKey = await secondPlotItem.getAttribute("data-react-plot-key");
  await secondPlotItem.click();
  await page.waitForFunction((key) => window.AtlasLegacyBridge.getPlotSummary().selectedKey === key, plotItemKey);
  await page.click('[data-react-plot-action="distribution"]');
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getPlotSummary();
    return summary.view === "distribution" && summary.cause !== "all" && document.querySelectorAll(".plot-histogram-bar").length === 22;
  });
  await page.selectOption('[data-react-plot-option="distributionMetric"]', "share");
  await page.waitForFunction(() => window.AtlasLegacyBridge.getPlotSummary().distributionMetric === "share");

  await page.click('[data-react-plot-option="view"][data-value="compare"]');
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getPlotSummary();
    return summary.view === "compare" && summary.compare === "time" && document.querySelector("[data-react-year-filter]").disabled;
  });
  await page.selectOption('[data-react-plot-option="compare"]', "sex");
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getPlotSummary();
    return summary.compare === "sex" && !document.querySelector("[data-react-year-filter]").disabled
      && document.querySelector("[data-react-sex-filter] button").disabled;
  });
  await page.click('[data-react-plot-option="level"][data-value="block"]');
  await page.selectOption('[data-react-plot-option="classIndex"]', "8");
  await page.click('[data-react-plot-option="top"][data-value="25"]');
  await page.selectOption('[data-react-plot-option="interval"]', "range");
  await page.selectOption('[data-react-plot-option="sort"]', "spread");
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getPlotSummary();
    return summary.level === "block" && summary.classIndex === "8" && summary.top === "25"
      && summary.interval === "range" && summary.sort === "spread";
  });

  await page.click('[data-react-plot-option="view"][data-value="profile"]');
  await page.click('[data-react-plot-option="level"][data-value="class"]');
  await page.click('[data-react-plot-option="top"][data-value="15"]');
  await page.selectOption('[data-react-plot-option="interval"]', "p10p90");
  await page.selectOption('[data-react-plot-option="sort"]', "n");
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getPlotSummary();
    return summary.view === "profile" && summary.level === "class" && summary.top === "15"
      && summary.interval === "p10p90" && summary.sort === "n"
      && !document.querySelector("[data-react-year-filter]").disabled
      && !document.querySelector("[data-react-sex-filter] button").disabled;
  });
  console.log("SMOKE: React age-at-death controls, inspector, modes and selection synchronized");

  await page.click('[data-react-navigation-view="dotogram"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getSnapshot().view === "dotogram");
  await page.waitForSelector("[data-react-dotogram-controls-ready]", { state: "visible" });
  await page.waitForSelector("[data-react-dotogram-inspector-ready]", { state: "visible" });
  const dotogramInitial = await page.evaluate(() => ({
    summary: window.AtlasLegacyBridge.getDotogramSummary(),
    controlsVisible: !document.querySelector("[data-react-dotogram-controls]").hidden,
    legacyControlsHidden: document.querySelector("[data-legacy-local-controls]").offsetParent === null,
    legacyInspectorHidden: document.querySelector("[data-legacy-hybrid-inspector-content]").offsetParent === null,
    pointCount: document.querySelectorAll("#viz [data-dotogram-key]").length
  }));
  if (
    !dotogramInitial.summary.active
    || dotogramInitial.summary.unit !== "settlement"
    || dotogramInitial.summary.metric !== "n"
    || dotogramInitial.summary.itemCount < 500
    || dotogramInitial.summary.classOptions.length !== 22
    || !dotogramInitial.summary.selected
    || dotogramInitial.pointCount !== dotogramInitial.summary.itemCount
    || !dotogramInitial.controlsVisible
    || !dotogramInitial.legacyControlsHidden
    || !dotogramInitial.legacyInspectorHidden
  ) {
    errors.push(`dotogram fallback swap: ${JSON.stringify(dotogramInitial)}`);
  }

  const secondDotogramItem = page.locator("[data-react-dotogram-key]").nth(1);
  const dotogramItemKey = await secondDotogramItem.getAttribute("data-react-dotogram-key");
  await secondDotogramItem.click();
  await page.waitForFunction((key) => window.AtlasLegacyBridge.getDotogramSummary().selectedKey === key, dotogramItemKey);
  await page.selectOption('[data-react-dotogram-option="metric"]', "per100k");
  await page.click('[data-react-dotogram-option="unit"][data-value="mo"]');
  await page.selectOption('[data-react-dotogram-option="classIndex"]', "8");
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getDotogramSummary();
    return summary.unit === "mo" && summary.metric === "per100k" && summary.classIndex === "8"
      && summary.itemCount === 29 && document.querySelectorAll("#viz [data-dotogram-key]").length === 29;
  });
  const dotogramPointKey = await page.locator("#viz [data-dotogram-key]").first().getAttribute("data-dotogram-key");
  await page.locator("#viz [data-dotogram-key]").first().click();
  await page.waitForFunction((key) => window.AtlasLegacyBridge.getDotogramSummary().selectedKey === key, dotogramPointKey);
  await page.click('[data-react-dotogram-option="unit"][data-value="settlement"]');
  await page.selectOption('[data-react-dotogram-option="metric"]', "n");
  await page.selectOption('[data-react-dotogram-option="classIndex"]', "all");
  await page.selectOption('[data-react-dotogram-option="labels"]', "outliers");
  await page.waitForFunction(() => {
    const summary = window.AtlasLegacyBridge.getDotogramSummary();
    return summary.unit === "settlement" && summary.metric === "n" && summary.classIndex === "all"
      && summary.labels === "outliers" && summary.itemCount >= 500;
  });
  console.log("SMOKE: React Dotogram controls, SVG point selection and analytical context synchronized");

  await page.click('[data-react-navigation-view="treemap"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getSnapshot().view === "treemap");

  await page.selectOption("[data-react-year-filter]", "2025");
  await page.click('[data-react-sex-filter] [data-value="2"]');
  await page.selectOption("[data-react-age-filter]", "65_79");
  await page.waitForFunction(() => {
    const snapshot = window.AtlasLegacyBridge.getSnapshot();
    return snapshot.year === "2025" && snapshot.sex === "2" && snapshot.age === "65_79";
  });
  console.log("SMOKE: React filters synchronized");

  const changed = await page.evaluate(() => ({
    snapshot: window.AtlasLegacyBridge.getSnapshot(),
    header: window.AtlasLegacyBridge.getHeaderSummary(),
    reactPeriod: document.querySelector("[data-react-header-period]")?.textContent,
    reactCount: Number(document.querySelector("[data-react-header-count]")?.textContent.replace(/\D/g, "")),
    legacyYear: document.querySelector("#yearSelect").value,
    legacyAge: document.querySelector("#ageSelect").value,
    legacySex: document.querySelector("#sexSeg .active")?.dataset.value
  }));
  if (initial.summary.records !== 30232) errors.push(`records: ${initial.summary.records}`);
  if (initial.summary.classes !== 22) errors.push(`classes: ${initial.summary.classes}`);
  if (initial.summary.municipalities !== 29) errors.push(`municipalities: ${initial.summary.municipalities}`);
  if (!initial.hidden) errors.push("React diagnostic root must remain hidden without reactDebug=1");
  if (!initial.reactFiltersVisible || !initial.legacyFiltersHidden) errors.push(`filter fallback swap: ${JSON.stringify(initial)}`);
  if (!initial.reactHeaderVisible || !initial.legacyHeaderHidden || initial.header.filteredRecords !== 30232) {
    errors.push(`header fallback swap: ${JSON.stringify(initial)}`);
  }
  if (!initial.reactNavigationVisible || !initial.legacyNavigationHidden || initial.reactNavigationButtons !== 8
    || initial.navigation.viewCount !== 8 || initial.navigation.activeView !== "map" || !initial.initialMapCanvas) {
    errors.push(`navigation fallback swap: ${JSON.stringify(initial)}`);
  }
  if (initial.spatialStatus?.spatialReady || initial.spatialStatus?.spatialLoading || initial.spatialScriptPresent) {
    errors.push(`enhanced map unexpectedly loaded fallback geometry: ${JSON.stringify(initial.spatialStatus)}`);
  }
  await page.focus('[data-react-navigation-view="map"]');
  await page.keyboard.press("ArrowDown");
  const keyboardFocus = await page.evaluate(() => document.activeElement?.getAttribute("data-react-navigation-view"));
  if (keyboardFocus !== "infrastructure") errors.push(`navigation keyboard focus: ${keyboardFocus}`);
  await page.keyboard.press("ArrowUp");
  if (changed.snapshot.view !== "treemap" || changed.snapshot.year !== "2025" || changed.snapshot.sex !== "2" || changed.snapshot.age !== "65_79") {
    errors.push(`state bridge: ${JSON.stringify(changed)}`);
  }
  if (changed.legacyYear !== "2025" || changed.legacyAge !== "65_79" || changed.legacySex !== "2") {
    errors.push(`legacy synchronization: ${JSON.stringify(changed)}`);
  }
  if (changed.reactPeriod !== "2025" || changed.reactCount !== changed.header.filteredRecords || changed.header.filteredRecords >= 30232) {
    errors.push(`header synchronization: ${JSON.stringify(changed)}`);
  }

  await page.click("[data-react-navigation-panel]");
  await page.waitForFunction(() => !window.AtlasLegacyBridge.getNavigationSummary().panelOpen);
  await page.click("[data-react-navigation-panel]");
  await page.waitForFunction(() => window.AtlasLegacyBridge.getNavigationSummary().panelOpen);
  console.log("SMOKE: React navigation and parameter panel synchronized");

  await page.click("[data-react-header-status] .app-help-button");
  await page.waitForFunction(() => document.querySelector(".atlas-main .method")?.classList.contains("is-open"));
  await page.click("#atlasHelpToggle");
  await page.waitForFunction(() => !document.querySelector(".atlas-main .method")?.classList.contains("is-open"));

  await page.click('[data-react-navigation-view="infrastructure"]');
  await page.waitForFunction(() => document.body.dataset.shellView === "infrastructure");
  await page.waitForSelector("[data-react-infra-chrome-ready]", { state: "visible" });
  await page.waitForSelector("[data-react-infra-panel-ready]", { state: "visible" });
  await page.waitForFunction(() => window.AtlasLegacyBridge.getInfrastructureChromeSummary().mapMounted);
  console.log("SMOKE: infrastructure placeholder verified");
  const infrastructureFilters = await page.evaluate(() => ({
    visibility: getComputedStyle(document.querySelector("[data-react-global-filters] .filters")).visibility,
    barDisplay: getComputedStyle(document.querySelector(".global-filterbar")).display,
    state: window.AtlasLegacyBridge.getSnapshot(),
    svgDisabled: document.querySelector('[data-react-header-action="svg"]')?.disabled
  }));
  if (infrastructureFilters.visibility !== "hidden" || infrastructureFilters.barDisplay === "none" || !infrastructureFilters.svgDisabled) {
    errors.push(`infrastructure placeholder: ${JSON.stringify(infrastructureFilters)}`);
  }

  const infrastructureChromeBefore = await page.evaluate(() => {
    window.__infraMapCanvas = document.querySelector(".infra-map canvas");
    return window.AtlasLegacyBridge.getInfrastructureChromeSummary();
  });
  await page.click('[data-react-infra-chrome-ready] button[aria-controls="infrastructureLayerComposer"]');
  await page.waitForFunction(() => !window.AtlasLegacyBridge.getInfrastructureChromeSummary().panelOpen);
  await page.click('[data-react-infra-chrome-ready] button[aria-controls="infrastructureLayerComposer"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getInfrastructureChromeSummary().panelOpen);
  await page.click('[data-react-infra-chrome-ready] button:not([aria-controls])');
  const infrastructureChromeAfter = await page.evaluate(() => ({
    summary: window.AtlasLegacyBridge.getInfrastructureChromeSummary(),
    sameCanvas: window.__infraMapCanvas === document.querySelector(".infra-map canvas"),
    legacyToolbarHidden: document.querySelector("[data-legacy-infra-chrome]").offsetParent === null,
    legacyPanelHeaderHidden: document.querySelector("[data-legacy-infra-panel]").offsetParent === null
  }));
  if (
    !infrastructureChromeBefore.active
    || infrastructureChromeBefore.facilities !== 417
    || !infrastructureChromeAfter.summary.mapMounted
    || !infrastructureChromeAfter.sameCanvas
    || !infrastructureChromeAfter.legacyToolbarHidden
    || !infrastructureChromeAfter.legacyPanelHeaderHidden
  ) {
    errors.push(`infrastructure chrome migration: ${JSON.stringify({ infrastructureChromeBefore, infrastructureChromeAfter })}`);
  }
  console.log("SMOKE: React infrastructure panels synchronized without recreating MapLibre");

  await page.click('[data-react-navigation-view="map"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getSnapshot().view === "map");
  await page.waitForSelector("[data-react-map-chrome-ready]", { state: "visible" });
  await page.waitForSelector("[data-react-map-inspector-ready]", { state: "visible" });
  await page.waitForFunction(() => window.AtlasLegacyBridge.getMapChromeSummary().mapMounted);
  console.log("SMOKE: map restored");
  const preserved = await page.evaluate(() => ({
    ...window.AtlasLegacyBridge.getSnapshot(),
    sameInitialMapCanvas: window.__initialMapCanvas === document.querySelector(".mortality-map canvas")
  }));
  if (preserved.year !== "2025" || preserved.sex !== "2" || preserved.age !== "65_79") {
    errors.push(`filters not preserved between views: ${JSON.stringify(preserved)}`);
  }
  if (!preserved.sameInitialMapCanvas) errors.push("navigation recreated the mortality MapLibre canvas");

  const mapChromeBefore = await page.evaluate(() => {
    window.__atlasMapCanvas = document.querySelector(".mortality-map canvas");
    return window.AtlasLegacyBridge.getMapChromeSummary();
  });
  await page.click('[data-react-map-chrome-ready] button[aria-controls="atlasDrawer"]');
  await page.waitForFunction(() => !window.AtlasLegacyBridge.getMapChromeSummary().leftPanelOpen);
  await page.click('[data-react-map-chrome-ready] button[aria-controls="atlasDrawer"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getMapChromeSummary().leftPanelOpen);
  await page.click('[data-react-map-chrome-ready] button[aria-controls="mortalityMapInspector"]');
  await page.waitForFunction(() => !window.AtlasLegacyBridge.getMapChromeSummary().rightPanelOpen);
  await page.click('[data-react-map-chrome-ready] button[aria-controls="mortalityMapInspector"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getMapChromeSummary().rightPanelOpen);
  await page.click('[data-react-map-chrome-ready] button:not([aria-controls])');
  const mapChromeAfter = await page.evaluate(() => ({
    summary: window.AtlasLegacyBridge.getMapChromeSummary(),
    sameCanvas: window.__atlasMapCanvas === document.querySelector(".mortality-map canvas"),
    legacyToolbarHidden: document.querySelector("[data-legacy-map-chrome]").offsetParent === null
  }));
  if (!mapChromeBefore.active || !mapChromeAfter.summary.mapMounted || !mapChromeAfter.sameCanvas || !mapChromeAfter.legacyToolbarHidden) {
    errors.push(`map chrome migration: ${JSON.stringify({ mapChromeBefore, mapChromeAfter })}`);
  }
  console.log("SMOKE: React map panels synchronized without recreating MapLibre");

  await page.click("[data-react-filter-reset]");
  await page.waitForFunction(() => {
    const snapshot = window.AtlasLegacyBridge.getSnapshot();
    return snapshot.year === "all" && snapshot.sex === "all" && snapshot.age === "all";
  });
  console.log("SMOKE: filters reset");

  const renderedViews = [];
  for (const view of ["treemap", "heatmap", "arrow", "pyramid", "plot", "dotogram", "map", "infrastructure"]) {
    console.log(`SMOKE: restoring ${view}`);
    await page.click(`[data-react-navigation-view="${view}"]`);
    await page.waitForFunction((expectedView) => window.AtlasLegacyBridge.getSnapshot().view === expectedView, view);
    await page.waitForFunction(() => document.querySelector("#viz")?.childElementCount > 0);
    renderedViews.push(view);
  }
  console.log(`SMOKE: all views rendered (${renderedViews.join(", ")})`);

  await page.click('[data-react-navigation-view="treemap"]');
  await page.waitForFunction(() => window.AtlasLegacyBridge.getSnapshot().view === "treemap"
    && Boolean(document.querySelector(".treemap-v2-layout"))
    && Boolean(document.querySelector("[data-react-treemap-breadcrumbs-ready]"))
    && Boolean(document.querySelector("[data-react-treemap-controls-ready]"))
    && Boolean(document.querySelector("[data-react-treemap-inspector-ready]")));
  const treemapLayouts = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => Boolean(document.querySelector(".treemap-v2-layout"))
      && Boolean(document.querySelector("[data-react-treemap-breadcrumbs-ready]"))
      && Boolean(document.querySelector("[data-react-treemap-controls-ready]"))
      && Boolean(document.querySelector("[data-react-treemap-inspector-ready]")));
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => {
      const viz = document.querySelector("#viz").getBoundingClientRect();
      const layoutBox = document.querySelector(".treemap-v2-layout").getBoundingClientRect();
      const path = document.querySelector("[data-react-treemap-breadcrumbs-ready]");
      const controls = document.querySelector("[data-react-treemap-controls-ready]");
      return {
        viewport: innerWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        layoutInsideViz: layoutBox.left >= viz.left - 1
          && layoutBox.right <= viz.right + 1
          && layoutBox.top >= viz.top - 1
          && layoutBox.bottom <= viz.bottom + 1,
        pathOverflow: path.scrollWidth - path.clientWidth,
        controlsOverflow: controls.scrollWidth - controls.clientWidth,
        inspectorWidth: Math.round(document.querySelector(".treev2-inspector").getBoundingClientRect().width)
      };
    });
    treemapLayouts.push(layout);
    if (layout.pageOverflow > 1 || !layout.layoutInsideViz || layout.pathOverflow > 1
      || layout.controlsOverflow > 1 || layout.inspectorWidth < 240) {
      errors.push(`responsive treemap: ${JSON.stringify(layout)}`);
    }
  }
  console.log(`SMOKE: Treemap panels verified (${treemapLayouts.map((item) => item.viewport).join(", ")} px)`);

  await page.click('[data-react-navigation-view="heatmap"]');
  await page.waitForSelector("[data-react-heatmap-inspector-ready]", { state: "visible" });
  const heatmapLayouts = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const layout = document.querySelector(".heatmap-v2-layout");
      const controls = document.querySelector("[data-react-heatmap-controls-ready]");
      const inspector = document.querySelector("[data-react-heatmap-inspector-ready]");
      return Boolean(layout && controls && inspector && inspector.getBoundingClientRect().width > 0);
    });
    await page.waitForTimeout(75);
    const layout = await page.evaluate(() => {
      const viz = document.querySelector("#viz").getBoundingClientRect();
      const layoutBox = document.querySelector(".heatmap-v2-layout").getBoundingClientRect();
      const controls = document.querySelector("[data-react-heatmap-controls-ready]");
      const inspector = document.querySelector("[data-react-heatmap-inspector-ready]");
      return {
        viewport: innerWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        layoutInsideViz: layoutBox.left >= viz.left - 1
          && layoutBox.right <= viz.right + 1
          && layoutBox.top >= viz.top - 1
          && layoutBox.bottom <= viz.bottom + 1,
        controlsOverflow: controls.scrollWidth - controls.clientWidth,
        inspectorWidth: Math.round(inspector.getBoundingClientRect().width)
      };
    });
    heatmapLayouts.push(layout);
    if (layout.pageOverflow > 1 || !layout.layoutInsideViz
      || layout.controlsOverflow > 1 || layout.inspectorWidth < 240) {
      errors.push(`responsive heatmap: ${JSON.stringify(layout)}`);
    }
  }
  console.log(`SMOKE: Heatmap panels verified (${heatmapLayouts.map((item) => item.viewport).join(", ")} px)`);

  await page.click('[data-react-navigation-view="arrow"]');
  const rankLayouts = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const chart = document.querySelector(".rank-analysis");
      const controls = document.querySelector("[data-react-rank-controls-ready]");
      const inspector = document.querySelector("[data-react-rank-inspector-ready]");
      const svg = document.querySelector(".rank-analysis-svg");
      return Boolean(chart && controls && inspector && svg && inspector.getBoundingClientRect().width > 0);
    });
    await page.waitForTimeout(75);
    const layout = await page.evaluate(() => {
      const viz = document.querySelector("#viz").getBoundingClientRect();
      const chart = document.querySelector(".rank-analysis").getBoundingClientRect();
      const controls = document.querySelector("[data-react-rank-controls-ready]");
      const inspector = document.querySelector("[data-react-rank-inspector-ready]");
      return {
        viewport: innerWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chartInsideViz: chart.left >= viz.left - 1 && chart.right <= viz.right + 1
          && chart.top >= viz.top - 1 && chart.bottom <= viz.bottom + 1,
        controlsOverflow: controls.scrollWidth - controls.clientWidth,
        inspectorWidth: Math.round(inspector.getBoundingClientRect().width),
        svgWidth: Math.round(document.querySelector(".rank-analysis-svg").getBoundingClientRect().width)
      };
    });
    rankLayouts.push(layout);
    if (layout.pageOverflow > 1 || !layout.chartInsideViz || layout.controlsOverflow > 1
      || layout.inspectorWidth < 232 || layout.svgWidth < 650) {
      errors.push(`responsive rank: ${JSON.stringify(layout)}`);
    }
  }
  console.log(`SMOKE: Arrow panels verified (${rankLayouts.map((item) => item.viewport).join(", ")} px)`);

  await page.click('[data-react-navigation-view="pyramid"]');
  const pyramidLayouts = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const chart = document.querySelector(".pyramid-analysis");
      const controls = document.querySelector("[data-react-pyramid-controls-ready]");
      const inspector = document.querySelector("[data-react-pyramid-inspector-ready]");
      const svg = document.querySelector(".pyramid-analysis-svg");
      return Boolean(chart && controls && inspector && svg && inspector.getBoundingClientRect().width > 0);
    });
    await page.waitForTimeout(75);
    const layout = await page.evaluate(() => {
      const viz = document.querySelector("#viz").getBoundingClientRect();
      const chart = document.querySelector(".pyramid-analysis").getBoundingClientRect();
      const controls = document.querySelector("[data-react-pyramid-controls-ready]");
      const inspector = document.querySelector("[data-react-pyramid-inspector-ready]");
      return {
        viewport: innerWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chartInsideViz: chart.left >= viz.left - 1 && chart.right <= viz.right + 1
          && chart.top >= viz.top - 1 && chart.bottom <= viz.bottom + 1,
        controlsOverflow: controls.scrollWidth - controls.clientWidth,
        inspectorWidth: Math.round(inspector.getBoundingClientRect().width),
        svgWidth: Math.round(document.querySelector(".pyramid-analysis-svg").getBoundingClientRect().width)
      };
    });
    pyramidLayouts.push(layout);
    if (layout.pageOverflow > 1 || !layout.chartInsideViz || layout.controlsOverflow > 1
      || layout.inspectorWidth < 232 || layout.svgWidth < 650) {
      errors.push(`responsive pyramid: ${JSON.stringify(layout)}`);
    }
  }
  console.log(`SMOKE: Pyramid panels verified (${pyramidLayouts.map((item) => item.viewport).join(", ")} px)`);

  await page.click('[data-react-navigation-view="plot"]');
  const plotLayouts = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const chart = document.querySelector(".plot-analysis");
      const controls = document.querySelector("[data-react-plot-controls-ready]");
      const inspector = document.querySelector("[data-react-plot-inspector-ready]");
      const svg = document.querySelector(".plot-analysis-svg");
      return Boolean(chart && controls && inspector && svg && inspector.getBoundingClientRect().width > 0);
    });
    await page.waitForTimeout(75);
    const layout = await page.evaluate(() => {
      const viz = document.querySelector("#viz").getBoundingClientRect();
      const chart = document.querySelector(".plot-analysis").getBoundingClientRect();
      const controls = document.querySelector("[data-react-plot-controls-ready]");
      const inspector = document.querySelector("[data-react-plot-inspector-ready]");
      return {
        viewport: innerWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chartInsideViz: chart.left >= viz.left - 1 && chart.right <= viz.right + 1
          && chart.top >= viz.top - 1 && chart.bottom <= viz.bottom + 1,
        controlsOverflow: controls.scrollWidth - controls.clientWidth,
        inspectorWidth: Math.round(inspector.getBoundingClientRect().width),
        svgWidth: Math.round(document.querySelector(".plot-analysis-svg").getBoundingClientRect().width)
      };
    });
    plotLayouts.push(layout);
    if (layout.pageOverflow > 1 || !layout.chartInsideViz || layout.controlsOverflow > 1
      || layout.inspectorWidth < 232 || layout.svgWidth < 650) {
      errors.push(`responsive plot: ${JSON.stringify(layout)}`);
    }
  }
  console.log(`SMOKE: Age-at-death panels verified (${plotLayouts.map((item) => item.viewport).join(", ")} px)`);

  await page.click('[data-react-navigation-view="dotogram"]');
  const dotogramLayouts = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const chart = document.querySelector("#viz > .svg-chart");
      const controls = document.querySelector("[data-react-dotogram-controls-ready]");
      const inspector = document.querySelector("[data-react-dotogram-inspector-ready]");
      return Boolean(chart && controls && inspector && inspector.getBoundingClientRect().width > 0);
    });
    await page.waitForTimeout(75);
    const layout = await page.evaluate(() => {
      const viz = document.querySelector("#viz").getBoundingClientRect();
      const chart = document.querySelector("#viz > .svg-chart").getBoundingClientRect();
      const controls = document.querySelector("[data-react-dotogram-controls-ready]");
      const inspector = document.querySelector("[data-react-dotogram-inspector-ready]");
      return {
        viewport: innerWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chartInsideViz: chart.left >= viz.left - 1 && chart.right <= viz.right + 1
          && chart.top >= viz.top - 1 && chart.bottom <= viz.bottom + 1,
        controlsOverflow: controls.scrollWidth - controls.clientWidth,
        inspectorWidth: Math.round(inspector.getBoundingClientRect().width),
        svgWidth: Math.round(chart.width),
        pointCount: document.querySelectorAll("#viz [data-dotogram-key]").length
      };
    });
    dotogramLayouts.push(layout);
    if (layout.pageOverflow > 1 || !layout.chartInsideViz || layout.controlsOverflow > 1
      || layout.inspectorWidth < 232 || layout.svgWidth < 650 || layout.pointCount < 500) {
      errors.push(`responsive dotogram: ${JSON.stringify(layout)}`);
    }
  }
  console.log(`SMOKE: Dotogram panels verified (${dotogramLayouts.map((item) => item.viewport).join(", ")} px)`);

  await page.click('[data-react-navigation-view="map"]');
  const layouts = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => {
      const bar = document.querySelector(".global-filterbar").getBoundingClientRect();
      const filters = document.querySelector("[data-react-global-filters] .filters").getBoundingClientRect();
      const hero = document.querySelector(".atlas-main .hero").getBoundingClientRect();
      const context = document.querySelector("[data-react-header-status] .app-header-context").getBoundingClientRect();
      const actions = document.querySelector("[data-react-header-status] .app-header-actions").getBoundingClientRect();
      const mapToolbar = document.querySelector(".mortality-map-toolbar").getBoundingClientRect();
      const mapChrome = document.querySelector("[data-react-map-chrome-ready]").getBoundingClientRect();
      const rail = document.querySelector(".viz-rail").getBoundingClientRect();
      const reactRail = document.querySelector("[data-react-navigation-ready]").getBoundingClientRect();
      return {
        viewport: innerWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        filtersInsideBar: filters.left >= bar.left - 1 && filters.right <= bar.right + 1,
        headerInsideHero: context.left >= hero.left - 1 && actions.right <= hero.right + 1,
        mapChromeInsideToolbar: mapChrome.left >= mapToolbar.left - 1
          && mapChrome.right <= mapToolbar.right + 1
          && mapChrome.top >= mapToolbar.top - 1
          && mapChrome.bottom <= mapToolbar.bottom + 1,
        navigationInsideRail: reactRail.left >= rail.left - 1
          && reactRail.right <= rail.right + 1
          && reactRail.top >= rail.top - 1
          && reactRail.bottom <= rail.bottom + 1,
        barHeight: Math.round(bar.height)
      };
    });
    layouts.push(layout);
    if (layout.pageOverflow > 1 || !layout.filtersInsideBar || !layout.headerInsideHero
      || !layout.mapChromeInsideToolbar || !layout.navigationInsideRail) {
      errors.push(`responsive shell: ${JSON.stringify(layout)}`);
    }
  }
  console.log(`SMOKE: responsive toolbar verified (${layouts.map((item) => item.viewport).join(", ")} px)`);

  await page.click('[data-react-navigation-view="infrastructure"]');
  await page.waitForSelector("[data-react-infra-chrome-ready]", { state: "visible" });
  const infrastructureLayouts = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => {
      const toolbar = document.querySelector(".infra-map-toolbar").getBoundingClientRect();
      const chrome = document.querySelector("[data-react-infra-chrome-ready]").getBoundingClientRect();
      const panelHeader = document.querySelector("[data-react-infra-panel-ready]");
      return {
        viewport: innerWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chromeInsideToolbar: chrome.left >= toolbar.left - 1
          && chrome.right <= toolbar.right + 1
          && chrome.top >= toolbar.top - 1
          && chrome.bottom <= toolbar.bottom + 1,
        panelHeaderOverflow: panelHeader.scrollWidth - panelHeader.clientWidth
      };
    });
    infrastructureLayouts.push(layout);
    if (layout.pageOverflow > 1 || !layout.chromeInsideToolbar || layout.panelHeaderOverflow > 1) {
      errors.push(`responsive infrastructure shell: ${JSON.stringify(layout)}`);
    }
  }
  console.log(`SMOKE: infrastructure toolbar verified (${infrastructureLayouts.map((item) => item.viewport).join(", ")} px)`);

  await page.goto(`${base}?reactDebug=1`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector("[data-react-hybrid-root] aside", {
    state: "visible",
    timeout: 15_000
  });
  console.log("SMOKE: debug panel visible");
  const debugText = await page.locator("[data-react-hybrid-root]").innerText();
  if (!debugText.includes("React + TypeScript:")) errors.push(`debug panel: ${debugText}`);

  console.log(JSON.stringify({ initial, treemapInitial, heatmapInitial, rankInitial, pyramidInitial, plotInitial, dotogramInitial, changed, infrastructureFilters, infrastructureChromeBefore, infrastructureChromeAfter, preserved, mapChromeBefore, mapChromeAfter, renderedViews, treemapLayouts, heatmapLayouts, rankLayouts, pyramidLayouts, plotLayouts, dotogramLayouts, layouts, infrastructureLayouts, debugPanel: "visible", errors }, null, 2));
  await browser.close();
  if (errors.length) throw new Error(errors.join("\n"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
