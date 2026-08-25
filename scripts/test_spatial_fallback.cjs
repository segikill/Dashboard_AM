const { chromium } = require("playwright");
const { chromiumLaunchOptions } = require("./playwright_launch.cjs");

const base = process.env.ATLAS_URL || "http://127.0.0.1:8765/";

(async () => {
  const browser = await chromium.launch(chromiumLaunchOptions());
  const errors = [];

  const analytical = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const analyticalResources = [];
  analytical.on("response", (response) => analyticalResources.push(response.url()));
  analytical.on("pageerror", (error) => errors.push(`analytical page: ${error.message}`));
  await analytical.goto(`${base}?view=treemap`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await analytical.waitForFunction(() => window.AtlasLegacyBridge?.getSnapshot?.().view === "treemap");
  await analytical.waitForSelector(".treev2-canvas .tile");
  const analyticalState = await analytical.evaluate(() => ({
    view: window.AtlasLegacyBridge.getSnapshot().view,
    records: window.AMUR_ATLAS_DATA.records.length,
    spatial: window.AmurAtlasDataLoader.getStatus(),
    bounds: window.AMUR_ATLAS_DATA.mapBounds3857
  }));
  if (analyticalResources.some((url) => /atlas-spatial\.js/.test(url))) {
    errors.push("analytical entry loaded atlas-spatial.js");
  }
  if (analyticalState.spatial.spatialReady || analyticalState.bounds !== null) {
    errors.push(`analytical entry contains spatial data: ${JSON.stringify(analyticalState)}`);
  }

  const fallback = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const fallbackResources = [];
  fallback.on("response", (response) => fallbackResources.push(response.url()));
  fallback.on("pageerror", (error) => errors.push(`fallback page: ${error.message}`));
  await fallback.route("**/assets/mortality-map.js*", (route) => route.abort());
  await fallback.route("**/assets/site.js*", (route) => route.abort());
  await fallback.goto(base, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await fallback.waitForFunction(() => window.AmurAtlasDataLoader?.isSpatialReady?.());
  await fallback.waitForSelector("#viz svg.svg-chart");
  const fallbackState = await fallback.evaluate(() => ({
    spatial: window.AmurAtlasDataLoader.getStatus(),
    bounds: window.AMUR_ATLAS_DATA.mapBounds3857?.length,
    municipalityGeometry: Boolean(window.AMUR_ATLAS_DATA.municipalities[0]?.geometry),
    settlementCoordinates: Number.isFinite(window.AMUR_ATLAS_DATA.settlements[0]?.x3857),
    svgPaths: document.querySelectorAll("#viz svg path").length,
    svgCircles: document.querySelectorAll("#viz svg circle").length
  }));
  if (!fallbackResources.some((url) => /atlas-spatial\.js/.test(url))) {
    errors.push("legacy fallback did not request atlas-spatial.js");
  }
  if (!fallbackState.spatial.spatialReady || fallbackState.bounds !== 4
    || !fallbackState.municipalityGeometry || !fallbackState.settlementCoordinates
    || fallbackState.svgPaths < 29 || fallbackState.svgCircles < 1) {
    errors.push(`legacy fallback is incomplete: ${JSON.stringify(fallbackState)}`);
  }

  console.log(JSON.stringify({ analyticalState, fallbackState, errors }, null, 2));
  await browser.close();
  if (errors.length) throw new Error(errors.join("\n"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
