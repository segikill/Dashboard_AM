(function installAtlasLegacyBridge() {
  "use strict";

  if (window.AtlasLegacyBridge) return;

  const listeners = new Set();
  const dataSummary = Object.freeze({
    regionKey: String(DATA.regionKey),
    regionName: String(DATA.regionName),
    period: String(DATA.period),
    records: DATA.records.length,
    years: Object.freeze([...DATA.years]),
    classes: DATA.classes.length,
    blocks: DATA.blocks.length,
    codes: DATA.codes.length,
    municipalities: DATA.municipalities.length,
    settlements: DATA.settlements.length
  });
  const snapshot = () => Object.freeze({
    view: String(state.view),
    year: String(state.year),
    sex: String(state.sex),
    age: String(state.age)
  });
  let currentSnapshot = snapshot();
  let actionMessage = "";
  let filteredCountKey = "";
  let filteredCount = 0;
  let headerSummaryKey = "";
  let headerSummary;
  let mapChromeSummaryKey = "";
  let mapChromeSummary;
  let infrastructureChromeSummaryKey = "";
  let infrastructureChromeSummary;
  let navigationSummaryKey = "";
  let navigationSummary;
  let treemapSummaryKey = "";
  let treemapSummary;
  let heatmapSummaryKey = "";
  let heatmapSummary;
  let rankSummaryKey = "";
  let rankSummary;
  let pyramidSummaryKey = "";
  let pyramidSummary;
  let plotSummaryKey = "";
  let plotSummary;
  let dotogramSummaryKey = "";
  let dotogramSummary;

  const emit = () => {
    currentSnapshot = snapshot();
    listeners.forEach((listener) => listener());
    window.dispatchEvent(new CustomEvent("atlas:legacy-state", { detail: currentSnapshot }));
  };

  const originalRender = render;
  render = function reactCompatibleRender() {
    const result = originalRender.apply(this, arguments);
    queueMicrotask(emit);
    return result;
  };

  const validYears = new Set(["all", ...DATA.years.map(String)]);
  const validSexes = new Set(["all", "1", "2"]);
  const validAges = new Set(["all", "0_14", "15_44", "45_64", "65_79", "80P"]);
  const setGlobalFilters = (filters) => {
    if (!filters || typeof filters !== "object") return;
    let changed = false;

    if (filters.year !== undefined) {
      const year = String(filters.year);
      if (validYears.has(year) && year !== String(state.year)) {
        state.year = year;
        changed = true;
      }
    }
    if (filters.sex !== undefined) {
      const sex = String(filters.sex);
      if (validSexes.has(sex) && sex !== String(state.sex)) {
        state.sex = sex;
        changed = true;
      }
    }
    if (filters.age !== undefined) {
      const age = String(filters.age);
      if (validAges.has(age) && age !== String(state.age)) {
        state.age = age;
        changed = true;
      }
    }

    if (changed) render();
  };

  const validViews = new Set([
    "map",
    "infrastructure",
    "treemap",
    "heatmap",
    "arrow",
    "pyramid",
    "plot",
    "dotogram"
  ]);

  const setView = (view) => {
    const nextView = String(view);
    if (!validViews.has(nextView) || nextView === String(state.view)) return;
    state.view = nextView;
    render();
  };

  const getFilteredCount = () => {
    const key = `${state.year}|${state.sex}|${state.age}`;
    if (key !== filteredCountKey) {
      filteredCountKey = key;
      filteredCount = filtered().length;
    }
    return filteredCount;
  };

  const getHeaderSummary = () => {
    const svgButton = document.querySelector('[data-legacy-header-actions] [data-atlas-action="svg"]');
    const svgAvailable = Boolean(svgButton && !svgButton.disabled);
    const key = `${state.year}|${state.sex}|${state.age}|${state.view}|${svgAvailable}|${actionMessage}`;
    if (key !== headerSummaryKey || !headerSummary) {
      headerSummaryKey = key;
      headerSummary = Object.freeze({
        periodLabel: state.year === "all" ? String(DATA.period || "2023–2025") : String(state.year),
        filteredRecords: getFilteredCount(),
        svgAvailable,
        actionMessage
      });
    }
    return headerSummary;
  };

  const triggerHeaderAction = (action) => {
    if (action === "help") {
      document.getElementById("atlasHelpToggle")?.click();
      return;
    }
    if (!new Set(["share", "svg", "csv"]).has(action)) return;
    const button = document.querySelector(`[data-legacy-header-actions] [data-atlas-action="${action}"]`);
    if (button && !button.disabled) button.click();
  };

  const isCompactInspector = () => window.innerWidth <= 1540;
  const getMapChromeSummary = () => {
    const workspace = document.getElementById("atlasWorkspace");
    const compactInspector = isCompactInspector();
    const leftPanelOpen = !workspace?.classList.contains("drawer-collapsed");
    const rightPanelOpen = compactInspector
      ? document.body.classList.contains("shell-inspector-open")
      : !document.body.classList.contains("shell-inspector-collapsed");
    const mapMounted = Boolean(window.AmurMortalityMap?.debug?.().mounted);
    const selectedLabel = document.querySelector(".mortality-map-side .site-map-selection-card:not([hidden]) > b")
      ?.textContent?.trim() || "";
    const key = [state.view, leftPanelOpen, rightPanelOpen, compactInspector, mapMounted, selectedLabel].join("|");
    if (key !== mapChromeSummaryKey || !mapChromeSummary) {
      mapChromeSummaryKey = key;
      mapChromeSummary = Object.freeze({
        active: state.view === "map",
        leftPanelOpen,
        rightPanelOpen,
        compactInspector,
        mapMounted,
        selectedLabel
      });
    }
    return mapChromeSummary;
  };

  const scheduleMapResize = () => {
    window.AmurMortalityMap?.resize?.();
    window.setTimeout(() => window.AmurMortalityMap?.resize?.(), 230);
  };

  const setMapPanel = (panel, open) => {
    if (state.view !== "map") return;
    const nextOpen = Boolean(open);
    if (panel === "left") {
      const workspace = document.getElementById("atlasWorkspace");
      const currentOpen = !workspace?.classList.contains("drawer-collapsed");
      if (currentOpen !== nextOpen) document.getElementById("drawerRailToggle")?.click();
    } else if (panel === "right") {
      if (isCompactInspector()) {
        document.body.classList.toggle("shell-inspector-open", nextOpen);
      } else {
        document.body.classList.toggle("shell-inspector-collapsed", !nextOpen);
      }
    } else {
      return;
    }
    mapChromeSummaryKey = "";
    scheduleMapResize();
    queueMicrotask(emit);
  };

  const triggerMapAction = (action) => {
    if (state.view !== "map" || action !== "fit") return;
    document.querySelector("[data-mortality-fit]")?.click();
  };

  const getInfrastructureChromeSummary = () => {
    const shell = document.querySelector(".infra-shell");
    const panelOpen = Boolean(shell && !shell.classList.contains("is-panel-collapsed"));
    const mapMounted = Boolean(window.AmurInfrastructureMap?.debug?.().mounted);
    const facilities = Number(window.AMUR_INFRASTRUCTURE_DATA?.meta?.facilities || 0);
    const key = [state.view, panelOpen, mapMounted, facilities].join("|");
    if (key !== infrastructureChromeSummaryKey || !infrastructureChromeSummary) {
      infrastructureChromeSummaryKey = key;
      infrastructureChromeSummary = Object.freeze({
        active: state.view === "infrastructure",
        panelOpen,
        mapMounted,
        facilities
      });
    }
    return infrastructureChromeSummary;
  };

  const setInfrastructurePanel = (open) => {
    if (state.view !== "infrastructure") return;
    const shell = document.querySelector(".infra-shell");
    const currentOpen = Boolean(shell && !shell.classList.contains("is-panel-collapsed"));
    if (currentOpen !== Boolean(open)) shell?.querySelector("[data-legacy-infra-panel-toggle]")?.click();
    infrastructureChromeSummaryKey = "";
    window.AmurInfrastructureMap?.resize?.();
    window.setTimeout(() => window.AmurInfrastructureMap?.resize?.(), 230);
    queueMicrotask(emit);
  };

  const triggerInfrastructureAction = (action) => {
    if (state.view !== "infrastructure" || action !== "fit") return;
    document.querySelector(".infra-fit-button")?.click();
  };

  const getNavigationSummary = () => {
    const infrastructureView = state.view === "infrastructure";
    const shell = infrastructureView ? document.querySelector(".infra-shell") : null;
    const panelOpen = infrastructureView
      ? Boolean(shell && !shell.classList.contains("is-panel-collapsed"))
      : !document.getElementById("atlasWorkspace")?.classList.contains("drawer-collapsed");
    const key = `${state.view}|${panelOpen}`;
    if (key !== navigationSummaryKey || !navigationSummary) {
      navigationSummaryKey = key;
      navigationSummary = Object.freeze({
        activeView: String(state.view),
        panelOpen,
        viewCount: validViews.size
      });
    }
    return navigationSummary;
  };

  const setNavigationPanel = (open) => {
    if (state.view === "infrastructure") {
      setInfrastructurePanel(open);
      return;
    }
    const workspace = document.getElementById("atlasWorkspace");
    const currentOpen = !workspace?.classList.contains("drawer-collapsed");
    if (currentOpen !== Boolean(open)) document.getElementById("drawerRailToggle")?.click();
    navigationSummaryKey = "";
    queueMicrotask(emit);
  };

  const getTreemapSummary = () => {
    const api = window.AmurTreemapV2;
    if (!api) {
      return Object.freeze({
        active: false,
        level: "root",
        metric: "n",
        color: "count",
        sort: "value",
        showValues: true,
        minShare: .5,
        contextLabel: "Все классы МКБ-10",
        breadcrumbs: Object.freeze([]),
        selected: null,
        children: Object.freeze([])
      });
    }
    const key = [
      state.view,
      state.year,
      state.sex,
      state.age,
      state.treeType,
      state.treeIndex,
      state.treeMetric,
      state.treeColor,
      state.treeSort,
      state.treeShowValues,
      state.treeMinShare,
      document.querySelector(".treev2-canvas .tile.is-selected")?.dataset.treeKey || ""
    ].join("|");
    if (key !== treemapSummaryKey || !treemapSummary) {
      treemapSummaryKey = key;
      treemapSummary = api.getSummary();
    }
    return treemapSummary;
  };

  const setTreemapOption = (option, value) => {
    if (state.view !== "treemap") return;
    window.AmurTreemapV2?.setOption?.(option, value);
  };

  const setTreemapLevel = (level) => {
    if (state.view !== "treemap") return;
    window.AmurTreemapV2?.setLevel?.(level);
  };

  const triggerTreemapAction = (action) => {
    if (state.view !== "treemap") return;
    if (action === "reset") window.AmurTreemapV2?.reset?.();
    else if (action === "drill") window.AmurTreemapV2?.drill?.();
  };

  const selectTreemapChild = (key) => {
    if (state.view !== "treemap") return;
    window.AmurTreemapV2?.selectChild?.(String(key));
  };

  const getHeatmapSummary = () => {
    const api = window.AmurHeatmapV2;
    if (!api) {
      return Object.freeze({
        active: false,
        unit: "mo",
        metric: "share",
        limit: "25",
        rows: 0,
        columns: 0,
        selected: null,
        topTerritories: Object.freeze([])
      });
    }
    const key = [
      state.view,
      state.year,
      state.sex,
      state.age,
      state.heatUnit,
      state.heatMetric,
      state.heatLimit,
      document.querySelector(".heatv2-cell.is-selected")?.dataset.heatmapKey || ""
    ].join("|");
    if (key !== heatmapSummaryKey || !heatmapSummary) {
      heatmapSummaryKey = key;
      heatmapSummary = api.getSummary();
    }
    return heatmapSummary;
  };

  const setHeatmapOption = (option, value) => {
    if (state.view !== "heatmap") return;
    window.AmurHeatmapV2?.setOption?.(option, value);
  };

  const selectHeatmapCell = (key) => {
    if (state.view !== "heatmap") return;
    window.AmurHeatmapV2?.selectCell?.(String(key));
  };

  const getRankSummary = () => {
    const api = window.AmurRankAnalysis;
    if (!api) {
      return Object.freeze({
        active: false,
        view: "compare",
        compare: "time",
        level: "class",
        classIndex: "all",
        metric: "n",
        top: "15",
        onlyChanges: false,
        itemCount: 0,
        slices: Object.freeze([]),
        classOptions: Object.freeze([]),
        selected: null,
        movers: Object.freeze([])
      });
    }
    const key = [
      state.view,
      state.year,
      state.sex,
      state.age,
      state.rankView,
      state.rankCompare,
      state.rankLevel,
      state.rankClass,
      state.rankMetric,
      state.rankTop,
      state.rankOnlyChanges,
      document.querySelector(".rank-trajectory.is-selected")?.dataset.rankKey || ""
    ].join("|");
    if (key !== rankSummaryKey || !rankSummary) {
      rankSummaryKey = key;
      rankSummary = api.getSummary();
    }
    return rankSummary;
  };

  const setRankOption = (option, value) => {
    if (state.view !== "arrow") return;
    window.AmurRankAnalysis?.setOption?.(option, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  };

  const selectRankItem = (key) => {
    if (state.view !== "arrow") return;
    window.AmurRankAnalysis?.selectItem?.(String(key));
  };

  const getPyramidSummary = () => {
    const api = window.AmurPyramidAnalysis;
    if (!api) {
      return Object.freeze({
        active: false,
        view: "structure",
        level: "class",
        parentClass: "all",
        cause: "all",
        metric: "n",
        ageStep: "5",
        labels: "major",
        firstYear: DATA.years[0],
        lastYear: DATA.years[DATA.years.length - 1],
        periodLabel: String(DATA.period || ""),
        causeLabel: "Все причины смерти",
        classOptions: Object.freeze([]),
        causeOptions: Object.freeze([]),
        total: 0,
        maleTotal: 0,
        femaleTotal: 0,
        peakLabel: "н/д",
        selected: null,
        topBins: Object.freeze([])
      });
    }
    const key = [
      state.view,
      state.year,
      state.pyramidView,
      state.pyramidLevel,
      state.pyramidParentClass,
      state.pyramidCause,
      state.pyramidMetric,
      state.pyramidAgeStep,
      state.pyramidLabels,
      api.getSummary()?.selected?.key || ""
    ].join("|");
    if (key !== pyramidSummaryKey || !pyramidSummary) {
      pyramidSummaryKey = key;
      pyramidSummary = api.getSummary();
    }
    return pyramidSummary;
  };

  const setPyramidOption = (option, value) => {
    if (state.view !== "pyramid") return;
    window.AmurPyramidAnalysis?.setOption?.(String(option), String(value));
  };

  const selectPyramidItem = (key) => {
    if (state.view !== "pyramid") return;
    window.AmurPyramidAnalysis?.selectItem?.(String(key));
  };

  const getPlotSummary = () => {
    const api = window.AmurPlotAnalysis;
    if (!api) {
      return Object.freeze({
        active: false,
        view: "profile",
        level: "class",
        classIndex: "all",
        cause: "all",
        interval: "p10p90",
        sort: "n",
        minN: "10",
        top: "15",
        compare: "time",
        yearA: String(DATA.years[0]),
        yearB: String(DATA.years[DATA.years.length - 1]),
        distributionMetric: "n",
        years: Object.freeze([...DATA.years]),
        classOptions: Object.freeze([]),
        causeOptions: Object.freeze([]),
        sliceLabels: Object.freeze([]),
        itemCount: 0,
        selectedKey: null,
        context: null,
        topItems: Object.freeze([])
      });
    }
    const live = api.getSummary();
    const key = [
      state.view,
      state.year,
      state.sex,
      state.age,
      live.view,
      live.level,
      live.classIndex,
      live.cause,
      live.interval,
      live.sort,
      live.minN,
      live.top,
      live.compare,
      live.yearA,
      live.yearB,
      live.distributionMetric,
      live.context?.key || live.context?.title || ""
    ].join("|");
    if (key !== plotSummaryKey || !plotSummary) {
      plotSummaryKey = key;
      plotSummary = live;
    }
    return plotSummary;
  };

  const setPlotOption = (option, value) => {
    if (state.view !== "plot") return;
    window.AmurPlotAnalysis?.setOption?.(String(option), String(value));
  };

  const selectPlotItem = (key) => {
    if (state.view !== "plot") return;
    window.AmurPlotAnalysis?.selectItem?.(String(key));
  };

  const triggerPlotAction = (action) => {
    if (state.view !== "plot") return;
    window.AmurPlotAnalysis?.triggerAction?.(String(action));
  };

  const getDotogramSummary = () => {
    const api = window.AmurDotogramAnalysis;
    if (!api) {
      return Object.freeze({
        active: false,
        unit: "settlement",
        metric: "n",
        classIndex: "all",
        labels: "outliers",
        metricLabel: "количество смертей",
        classOptions: Object.freeze([]),
        itemCount: 0,
        medianValue: null,
        medianText: "н/д",
        selectedKey: null,
        selected: null,
        topItems: Object.freeze([])
      });
    }
    const live = api.getSummary();
    const key = [
      state.view,
      state.year,
      state.sex,
      state.age,
      live.unit,
      live.metric,
      live.classIndex,
      live.labels,
      live.itemCount,
      live.selectedKey || ""
    ].join("|");
    if (key !== dotogramSummaryKey || !dotogramSummary) {
      dotogramSummaryKey = key;
      dotogramSummary = live;
    }
    return dotogramSummary;
  };

  const setDotogramOption = (option, value) => {
    if (state.view !== "dotogram") return;
    window.AmurDotogramAnalysis?.setOption?.(String(option), String(value));
  };

  const selectDotogramItem = (key) => {
    if (state.view !== "dotogram") return;
    window.AmurDotogramAnalysis?.selectItem?.(String(key));
  };

  window.AtlasLegacyBridge = Object.freeze({
    version: "1",
    getSnapshot: () => currentSnapshot,
    getDataSummary: () => dataSummary,
    getHeaderSummary,
    getMapChromeSummary,
    getInfrastructureChromeSummary,
    getNavigationSummary,
    getTreemapSummary,
    getHeatmapSummary,
    getRankSummary,
    getPyramidSummary,
    getPlotSummary,
    getDotogramSummary,
    setGlobalFilters,
    setView,
    setNavigationPanel,
    triggerHeaderAction,
    setMapPanel,
    triggerMapAction,
    setInfrastructurePanel,
    triggerInfrastructureAction,
    setTreemapOption,
    setTreemapLevel,
    triggerTreemapAction,
    selectTreemapChild,
    setHeatmapOption,
    selectHeatmapCell,
    setRankOption,
    selectRankItem,
    setPyramidOption,
    selectPyramidItem,
    setPlotOption,
    selectPlotItem,
    triggerPlotAction,
    setDotogramOption,
    selectDotogramItem,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });

  window.addEventListener("atlas:dotogram-state", () => {
    dotogramSummaryKey = "";
    emit();
  });

  const legacyActionStatus = document.querySelector("[data-legacy-header-actions] .atlas-action-status");
  if (legacyActionStatus) {
    new MutationObserver(() => {
      actionMessage = legacyActionStatus.textContent?.trim() || "";
      headerSummaryKey = "";
      emit();
    }).observe(legacyActionStatus, { childList: true, characterData: true, subtree: true });
  }

  const syncMapChrome = () => {
    mapChromeSummaryKey = "";
    emit();
  };
  window.addEventListener("atlas:mortality-selection", syncMapChrome);
  window.addEventListener("atlas:infrastructure-panel", () => {
    infrastructureChromeSummaryKey = "";
    navigationSummaryKey = "";
    emit();
  });
  window.addEventListener("atlas:treemap-state", () => {
    treemapSummaryKey = "";
    emit();
  });
  window.addEventListener("atlas:heatmap-state", () => {
    heatmapSummaryKey = "";
    emit();
  });
  window.addEventListener("atlas:rank-state", () => {
    rankSummaryKey = "";
    emit();
  });
  window.addEventListener("atlas:pyramid-state", () => {
    pyramidSummaryKey = "";
    emit();
  });
  window.addEventListener("atlas:plot-state", () => {
    plotSummaryKey = "";
    emit();
  });
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(syncMapChrome);
  }, { passive: true });
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("#drawerRailToggle, #drawerToggle, [data-legacy-map-inspector-toggle]")) {
      navigationSummaryKey = "";
      queueMicrotask(syncMapChrome);
    }
  }, true);

  queueMicrotask(emit);

  const loadReactRuntime = () => {
    const moduleUrl = location.hostname === "127.0.0.1" && location.port === "5173"
      ? "/src/hybrid/main.tsx"
      : "./assets/react/atlas-hybrid.js?v=20260819-11";
    const moduleScript = document.createElement("script");
    moduleScript.type = "module";
    moduleScript.src = moduleUrl;
    moduleScript.addEventListener("error", (error) => {
      const root = document.querySelector("[data-react-hybrid-root]");
      if (root) root.dataset.reactStatus = "load-error";
      console.error("React hybrid runtime failed to load", error);
    });
    document.head.appendChild(moduleScript);
  };
  const scheduleReactRuntime = () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(loadReactRuntime, { timeout: 1500 });
    else window.setTimeout(loadReactRuntime, 0);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleReactRuntime, { once: true });
  } else {
    scheduleReactRuntime();
  }
})();
