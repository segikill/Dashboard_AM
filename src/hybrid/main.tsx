import { createRoot } from "react-dom/client";
import { GlobalFilters } from "./GlobalFilters";
import { HeaderStatus } from "./HeaderStatus";
import { HeatmapControls, HeatmapInspector } from "./HeatmapInterface";
import { DotogramControls, DotogramInspector } from "./DotogramInterface";
import { HybridRuntime } from "./HybridRuntime";
import { InfrastructureChrome, InfrastructurePanelHeader } from "./InfrastructureChrome";
import { MapChrome, MapInspectorHeader } from "./MapChrome";
import { NavigationRail } from "./NavigationRail";
import { PyramidControls, PyramidInspector } from "./PyramidInterface";
import { PlotControls, PlotInspector } from "./PlotInterface";
import { RankControls, RankInspector } from "./RankInterface";
import { TreemapBreadcrumbs, TreemapControls, TreemapInspector } from "./TreemapInterface";

const mountNode = document.querySelector<HTMLElement>("[data-react-hybrid-root]");
const globalFiltersNode = document.querySelector<HTMLElement>("[data-react-global-filters]");
const headerStatusNode = document.querySelector<HTMLElement>("[data-react-header-status]");
const navigationRailNode = document.querySelector<HTMLElement>("[data-react-navigation-rail]");
const treemapControlsNode = document.querySelector<HTMLElement>("[data-react-treemap-controls]");
const heatmapControlsNode = document.querySelector<HTMLElement>("[data-react-heatmap-controls]");
const rankControlsNode = document.querySelector<HTMLElement>("[data-react-rank-controls]");
const rankInspectorNode = document.querySelector<HTMLElement>("[data-react-rank-inspector]");
const pyramidControlsNode = document.querySelector<HTMLElement>("[data-react-pyramid-controls]");
const pyramidInspectorNode = document.querySelector<HTMLElement>("[data-react-pyramid-inspector]");
const plotControlsNode = document.querySelector<HTMLElement>("[data-react-plot-controls]");
const plotInspectorNode = document.querySelector<HTMLElement>("[data-react-plot-inspector]");
const dotogramControlsNode = document.querySelector<HTMLElement>("[data-react-dotogram-controls]");
const dotogramInspectorNode = document.querySelector<HTMLElement>("[data-react-dotogram-inspector]");

if (mountNode) {
  createRoot(mountNode).render(<HybridRuntime />);
}

if (globalFiltersNode) {
  createRoot(globalFiltersNode).render(<GlobalFilters />);
}

if (headerStatusNode) {
  createRoot(headerStatusNode).render(<HeaderStatus />);
}

if (navigationRailNode) {
  createRoot(navigationRailNode).render(<NavigationRail />);
}

if (treemapControlsNode) {
  createRoot(treemapControlsNode).render(<TreemapControls />);
}

if (heatmapControlsNode) {
  createRoot(heatmapControlsNode).render(<HeatmapControls />);
}

if (rankControlsNode) {
  createRoot(rankControlsNode).render(<RankControls />);
}

if (rankInspectorNode) {
  createRoot(rankInspectorNode).render(<RankInspector />);
}

if (pyramidControlsNode) {
  createRoot(pyramidControlsNode).render(<PyramidControls />);
}

if (pyramidInspectorNode) {
  createRoot(pyramidInspectorNode).render(<PyramidInspector />);
}

if (plotControlsNode) {
  createRoot(plotControlsNode).render(<PlotControls />);
}

if (plotInspectorNode) {
  createRoot(plotInspectorNode).render(<PlotInspector />);
}

if (dotogramControlsNode) {
  createRoot(dotogramControlsNode).render(<DotogramControls />);
}

if (dotogramInspectorNode) {
  createRoot(dotogramInspectorNode).render(<DotogramInspector />);
}

let activeMapChromeHost: HTMLElement | null = null;
let activeMapChromeRoot: ReturnType<typeof createRoot> | null = null;
let activeMapInspectorHost: HTMLElement | null = null;
let activeMapInspectorRoot: ReturnType<typeof createRoot> | null = null;
let activeInfrastructureChromeHost: HTMLElement | null = null;
let activeInfrastructureChromeRoot: ReturnType<typeof createRoot> | null = null;
let activeInfrastructurePanelHost: HTMLElement | null = null;
let activeInfrastructurePanelRoot: ReturnType<typeof createRoot> | null = null;
let activeTreemapBreadcrumbsHost: HTMLElement | null = null;
let activeTreemapBreadcrumbsRoot: ReturnType<typeof createRoot> | null = null;
let activeTreemapInspectorHost: HTMLElement | null = null;
let activeTreemapInspectorRoot: ReturnType<typeof createRoot> | null = null;
let activeHeatmapInspectorHost: HTMLElement | null = null;
let activeHeatmapInspectorRoot: ReturnType<typeof createRoot> | null = null;

function syncDynamicMapRoots() {
  const chromeHost = document.querySelector<HTMLElement>("[data-react-map-chrome]");
  if (chromeHost !== activeMapChromeHost) {
    activeMapChromeRoot?.unmount();
    activeMapChromeHost = chromeHost;
    activeMapChromeRoot = chromeHost ? createRoot(chromeHost) : null;
    activeMapChromeRoot?.render(<MapChrome />);
  }

  const inspectorHost = document.querySelector<HTMLElement>("[data-react-map-inspector]");
  if (inspectorHost !== activeMapInspectorHost) {
    activeMapInspectorRoot?.unmount();
    activeMapInspectorHost = inspectorHost;
    activeMapInspectorRoot = inspectorHost ? createRoot(inspectorHost) : null;
    activeMapInspectorRoot?.render(<MapInspectorHeader />);
  }

  const infrastructureChromeHost = document.querySelector<HTMLElement>("[data-react-infra-chrome]");
  if (infrastructureChromeHost !== activeInfrastructureChromeHost) {
    activeInfrastructureChromeRoot?.unmount();
    activeInfrastructureChromeHost = infrastructureChromeHost;
    activeInfrastructureChromeRoot = infrastructureChromeHost ? createRoot(infrastructureChromeHost) : null;
    activeInfrastructureChromeRoot?.render(<InfrastructureChrome />);
  }

  const infrastructurePanelHost = document.querySelector<HTMLElement>("[data-react-infra-panel]");
  if (infrastructurePanelHost !== activeInfrastructurePanelHost) {
    activeInfrastructurePanelRoot?.unmount();
    activeInfrastructurePanelHost = infrastructurePanelHost;
    activeInfrastructurePanelRoot = infrastructurePanelHost ? createRoot(infrastructurePanelHost) : null;
    activeInfrastructurePanelRoot?.render(<InfrastructurePanelHeader />);
  }

  const treemapBreadcrumbsHost = document.querySelector<HTMLElement>("[data-react-treemap-breadcrumbs]");
  if (treemapBreadcrumbsHost !== activeTreemapBreadcrumbsHost) {
    activeTreemapBreadcrumbsRoot?.unmount();
    activeTreemapBreadcrumbsHost = treemapBreadcrumbsHost;
    activeTreemapBreadcrumbsRoot = treemapBreadcrumbsHost ? createRoot(treemapBreadcrumbsHost) : null;
    activeTreemapBreadcrumbsRoot?.render(<TreemapBreadcrumbs />);
  }

  const treemapInspectorHost = document.querySelector<HTMLElement>("[data-react-treemap-inspector]");
  if (treemapInspectorHost !== activeTreemapInspectorHost) {
    activeTreemapInspectorRoot?.unmount();
    activeTreemapInspectorHost = treemapInspectorHost;
    activeTreemapInspectorRoot = treemapInspectorHost ? createRoot(treemapInspectorHost) : null;
    activeTreemapInspectorRoot?.render(<TreemapInspector />);
  }

  const heatmapInspectorHost = document.querySelector<HTMLElement>("[data-react-heatmap-inspector]");
  if (heatmapInspectorHost !== activeHeatmapInspectorHost) {
    activeHeatmapInspectorRoot?.unmount();
    activeHeatmapInspectorHost = heatmapInspectorHost;
    activeHeatmapInspectorRoot = heatmapInspectorHost ? createRoot(heatmapInspectorHost) : null;
    activeHeatmapInspectorRoot?.render(<HeatmapInspector />);
  }
}

const vizNode = document.getElementById("viz");
if (vizNode) {
  syncDynamicMapRoots();
  new MutationObserver(syncDynamicMapRoots).observe(vizNode, { childList: true, subtree: true });
}
