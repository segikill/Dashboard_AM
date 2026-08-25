const { chromium } = require("playwright");
const { chromiumLaunchOptions } = require("./playwright_launch.cjs");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const artifacts = path.join(root, "artifacts");
fs.mkdirSync(artifacts, { recursive: true });

const url = process.env.ATLAS_URL || "http://127.0.0.1:8765/";

let browser;

(async () => {
  console.log("launch");
  browser = await chromium.launch(chromiumLaunchOptions());
  const errors = [];
  const page = await browser.newPage({
    viewport: { width: 1600, height: 950 },
    deviceScaleFactor: 1
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`response: ${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText || "failed";
    if (errorText.includes("ERR_ABORTED")) return;
    errors.push(`request: ${request.url()} :: ${errorText}`);
  });

  console.log("goto");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log("click");
  await page.click('[data-view="infrastructure"]');
  console.log("canvas");
  await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 });
  console.log("layers");
  try {
    await page.waitForFunction(
      () => {
        const debug = window.AmurInfrastructureMap?.debug?.();
        return debug?.layers.length >= 22
          && debug.renderedFeatures.municipalities > 0
          && debug.renderedFeatures.facilities > 0
          && debug.images.facilities === 8
          && debug.images.donuts > 0;
      },
      null,
      { timeout: 40_000 }
    );
  } catch (error) {
    console.error("diagnostic", JSON.stringify({
      debug: await page.evaluate(() => window.AmurInfrastructureMap?.debug?.()),
      status: await page.locator(".infra-map-status").allTextContents(),
      errors
    }, null, 2));
    throw error;
  }

  const first = await page.evaluate(() => window.AmurInfrastructureMap.debug());
  if (!first.mounted || first.layers.length < 22) {
    throw new Error("MapLibre thematic layers did not reach a usable state");
  }
  if (first.sources.length !== 8) throw new Error(`Expected 8 custom sources including roads, got ${first.sources.length}`);
  if (!first.sources.includes("amur-infra-region-mask")) {
    throw new Error("Outside-region mask source is missing");
  }
  if (first.activeFacilityTypes.length !== 1 || first.activeFacilityTypes[0] !== "hospital") {
    throw new Error(`Expected only hospitals by default, got ${first.activeFacilityTypes.join(", ")}`);
  }
  if (first.clusteredFacilityInputCount !== 32) {
    throw new Error(`Expected 32 hospitals by default, got ${first.clusteredFacilityInputCount}`);
  }
  if (!first.layerState.isochrone20 || !first.layerState.isochrone60
      || !first.layerState.municipalities || !first.layerState.basemap) {
    throw new Error("Required default infrastructure layers are not enabled");
  }
  if (first.layerState.settlements || !first.layerState.settlementLabels) {
    throw new Error("Settlement symbols must be disabled and settlement labels enabled by default");
  }
  if (Math.abs(first.municipalityLabelMinzoom - 8.35) > 0.001) {
    throw new Error(`Expected municipality labels from zoom 8.35, got ${first.municipalityLabelMinzoom}`);
  }
  if (first.images.facilities !== 8) {
    throw new Error(`Expected 8 SVG facility icons, got ${first.images.facilities}`);
  }
  if (first.images.donuts < 1) throw new Error("Segmented cluster donuts were not generated");

  await page.click('[data-facility-type="fap"]');
  await page.waitForTimeout(250);
  const afterFap = await page.evaluate(() => window.AmurInfrastructureMap.debug());
  if (!afterFap.activeFacilityTypes.includes("fap")) throw new Error("FAP toggle did not update the filter");
  if (afterFap.clusteredFacilityInputCount !== 336) {
    throw new Error(`Expected 336 hospitals and FAPs, got ${afterFap.clusteredFacilityInputCount}`);
  }

  await page.click('[data-layer-toggle="isochrone60"]');
  const afterIso = await page.evaluate(() => window.AmurInfrastructureMap.debug());
  if (afterIso.layerState.isochrone60) throw new Error("60 minute isochrone toggle did not update");

  await page.click('[data-facility-action="all"]');
  await page.click('[data-layer-toggle="isochrone60"]');
  await page.waitForTimeout(1_200);
  await page.screenshot({
    path: path.join(artifacts, "infrastructure-1600x950.png"),
    fullPage: false
  });

  await page.setViewportSize({ width: 1300, height: 700 });
  await page.waitForTimeout(300);
  await page.click(".infra-fit-button");
  await page.waitForTimeout(900);
  await page.screenshot({
    path: path.join(artifacts, "infrastructure-1300x700.png"),
    fullPage: false
  });

  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.waitForTimeout(300);
  await page.click(".infra-fit-button");
  await page.waitForTimeout(900);
  await page.screenshot({
    path: path.join(artifacts, "infrastructure-2560x1440.png"),
    fullPage: false
  });

  const result = {
    url,
    title: await page.title(),
    viewport: page.viewportSize(),
    debug: await page.evaluate(() => window.AmurInfrastructureMap.debug()),
    dom: await page.evaluate(() => {
      const canvas = document.querySelector(".maplibregl-canvas");
      const container = document.querySelector(".infra-map");
      const column = document.querySelector(".infra-map-column");
      const shell = document.querySelector(".infra-shell");
      const composer = document.querySelector(".infra-layer-composer");
      const controls = document.querySelector(".maplibregl-control-container");
      return {
        shellRect: shell?.getBoundingClientRect().toJSON(),
        composerRect: composer?.getBoundingClientRect().toJSON(),
        columnRect: column?.getBoundingClientRect().toJSON(),
        mapRect: container?.getBoundingClientRect().toJSON(),
        canvasRect: canvas?.getBoundingClientRect().toJSON(),
        canvasBuffer: canvas ? [canvas.width, canvas.height] : null,
        canvasOpacity: canvas ? getComputedStyle(canvas).opacity : null,
        canvasVisibility: canvas ? getComputedStyle(canvas).visibility : null,
        canvasDisplay: canvas ? getComputedStyle(canvas).display : null,
        controlCount: controls?.querySelectorAll(".maplibregl-ctrl").length || 0,
        controlRect: controls?.getBoundingClientRect().toJSON()
      };
    }),
    errors
  };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exitCode = 2;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close().catch(() => {});
});
