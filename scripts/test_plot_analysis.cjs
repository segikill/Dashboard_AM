const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const artifacts = path.join(root, "artifacts");
fs.mkdirSync(artifacts, { recursive: true });

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const base = process.env.ATLAS_URL || "http://127.0.0.1:8765/";
const url = `${base}${base.includes("?") ? "&" : "?"}view=plot`;
const viewports = [
  { width: 1366, height: 768, name: "1366x768" },
  { width: 1600, height: 900, name: "1600x900" },
  { width: 1920, height: 1080, name: "1920x1080" },
  { width: 2560, height: 1440, name: "2560x1440" }
];

let browser;

(async () => {
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const errors = [];
  const page = await browser.newPage({ viewport: viewports[0], deviceScaleFactor: 1 });
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".plot-analysis--profile .plot-cause-row", { timeout: 15_000 });

  const initial = await page.evaluate(() => ({
    title: document.getElementById("chartTitle")?.textContent,
    mode: state.plotView,
    rows: document.querySelectorAll(".plot-cause-row").length,
    iqr: document.querySelectorAll(".plot-iqr-interval").length,
    outer: document.querySelectorAll(".plot-outer-interval").length,
    reference: document.querySelectorAll(".plot-reference").length,
    selected: document.querySelectorAll(".plot-cause-row.is-selected").length,
    workspaceTabs: document.querySelectorAll(".plot-workspace-tabs [data-plot-view]").length,
    motionVisible: document.querySelector(".atlas-motion-control") ? getComputedStyle(document.querySelector(".atlas-motion-control")).display !== "none" : false,
    yearDisabled: document.getElementById("yearSelect")?.disabled,
    sexDisabled: [...document.querySelectorAll("#sexSeg button")].some((button) => button.disabled)
  }));
  if (initial.title !== "Возраст смерти по причинам" || initial.mode !== "profile") throw new Error(`Initial plot failed: ${JSON.stringify(initial)}`);
  if (initial.rows < 10 || initial.rows > 15 || initial.iqr !== initial.rows || initial.outer !== initial.rows || initial.reference !== 1 || initial.selected !== 0 || initial.workspaceTabs !== 3 || initial.motionVisible) {
    throw new Error(`Profile geometry failed: ${JSON.stringify(initial)}`);
  }
  if (initial.yearDisabled || initial.sexDisabled) throw new Error(`Unexpected disabled filters: ${JSON.stringify(initial)}`);

  await page.locator(".plot-cause-row").nth(2).click();
  await page.waitForTimeout(80);
  const selected = await page.evaluate(() => ({
    cause: state.plotCause,
    action: document.querySelector(".hybrid-inspector__action")?.textContent,
    inspector: document.querySelector(".hybrid-inspector__selection h4")?.textContent,
    metrics: document.querySelectorAll(".hybrid-inspector__metric").length,
    persistent: document.querySelectorAll(".plot-cause-row.is-selected").length
  }));
  if (selected.cause === "all" || !selected.action?.includes("распределение") || !selected.inspector || selected.metrics < 4 || selected.persistent !== 1) {
    throw new Error(`Profile selection failed: ${JSON.stringify(selected)}`);
  }

  await page.click(".hybrid-inspector__action");
  await page.waitForSelector(".plot-analysis--distribution .plot-density-area");
  const distribution = await page.evaluate(() => ({
    mode: state.plotView,
    cause: state.plotCause,
    density: document.querySelectorAll(".plot-density-area").length,
    histogram: document.querySelectorAll(".plot-histogram-bar").length,
    iqr: document.querySelectorAll(".plot-box-iqr").length,
    median: document.querySelectorAll(".plot-box-median").length,
    bands: document.querySelectorAll(".plot-age-band").length,
    quantiles: document.querySelectorAll(".plot-quantile-label").length,
    causeSelect: document.getElementById("plotCause")?.value,
    footnote: document.querySelector(".plot-analysis__footnote")?.textContent
  }));
  if (distribution.mode !== "distribution" || distribution.cause === "all" || distribution.density !== 1 || distribution.histogram !== 22 || distribution.iqr !== 1 || distribution.median !== 1 || distribution.bands !== 5 || distribution.quantiles !== 5) {
    throw new Error(`Distribution mode failed: ${JSON.stringify(distribution)}`);
  }
  if (distribution.causeSelect !== distribution.cause || !distribution.footnote.includes("медиана")) throw new Error(`Distribution context failed: ${JSON.stringify(distribution)}`);
  await page.screenshot({ path: path.join(artifacts, "plot-distribution-1600x900.png"), fullPage: false });

  await page.click('[data-plot-view="compare"]');
  await page.waitForSelector(".plot-analysis--compare .plot-cause-row");
  const timeCompare = await page.evaluate(() => ({
    mode: state.plotView,
    compare: state.plotCompare,
    rows: document.querySelectorAll(".plot-cause-row").length,
    medians: document.querySelectorAll(".plot-median-point").length,
    iqr: document.querySelectorAll(".plot-iqr-interval--compare").length,
    connectors: document.querySelectorAll(".plot-median-connector").length,
    yearDisabled: document.getElementById("yearSelect")?.disabled,
    sexDisabled: [...document.querySelectorAll("#sexSeg button")].some((button) => button.disabled)
  }));
  if (timeCompare.compare !== "time" || timeCompare.rows < 8 || timeCompare.medians !== timeCompare.rows * 2 || timeCompare.iqr !== timeCompare.rows * 2 || timeCompare.connectors !== timeCompare.rows) {
    throw new Error(`Time comparison failed: ${JSON.stringify(timeCompare)}`);
  }
  if (!timeCompare.yearDisabled || timeCompare.sexDisabled) throw new Error(`Time comparison filters failed: ${JSON.stringify(timeCompare)}`);

  await page.selectOption("#plotCompare", "sex");
  const sexCompare = await page.evaluate(() => ({
    compare: state.plotCompare,
    yearDisabled: document.getElementById("yearSelect")?.disabled,
    sexDisabled: [...document.querySelectorAll("#sexSeg button")].every((button) => button.disabled),
    rows: document.querySelectorAll(".plot-cause-row").length,
    title: document.querySelector(".plot-analysis__summary strong")?.textContent
  }));
  if (sexCompare.compare !== "sex" || sexCompare.yearDisabled || !sexCompare.sexDisabled || !sexCompare.title.includes("Мужчины")) {
    throw new Error(`Sex comparison failed: ${JSON.stringify(sexCompare)}`);
  }
  await page.screenshot({ path: path.join(artifacts, "plot-compare-1600x900.png"), fullPage: false });

  await page.click('.plot-workspace-tabs [data-plot-view="profile"]');
  await page.click('[data-plot-level="block"]');
  await page.waitForSelector("#plotClass");
  const blockLabels = await page.evaluate(() => {
    const labels = [...document.querySelectorAll(".plot-row-label")];
    const boxes = labels.map((label) => label.getBBox());
    return {
      labels: labels.length,
      wrapped: labels.filter((label) => label.querySelectorAll("tspan").length > 1).length,
      leftEdges: [...new Set(labels.map((label) => Number(label.getAttribute("x"))))],
      anchors: [...new Set(labels.map((label) => label.getAttribute("text-anchor")))],
      minimumX: boxes.length ? Math.min(...boxes.map((box) => box.x)) : 0,
      maximumRight: boxes.length ? Math.max(...boxes.map((box) => box.x + box.width)) : 0,
      svgWidth: document.querySelector(".plot-analysis-svg")?.viewBox.baseVal.width || 0
    };
  });
  if (!blockLabels.labels || blockLabels.wrapped < 1 || blockLabels.leftEdges.length !== 1 || blockLabels.anchors.join() !== "start" || blockLabels.minimumX < 5 || blockLabels.maximumRight > blockLabels.svgWidth) {
    throw new Error(`Block labels overflow: ${JSON.stringify(blockLabels)}`);
  }
  await page.screenshot({ path: path.join(artifacts, "plot-profile-block-labels-1600x900.png"), fullPage: false });
  await page.click('[data-plot-view="compare"]');
  const comparisonBlockLabels = await page.evaluate(() => {
    const labels = [...document.querySelectorAll(".plot-row-label")];
    const boxes = labels.map((label) => label.getBBox());
    return {
      labels: labels.length,
      wrapped: labels.filter((label) => label.querySelectorAll("tspan").length > 1).length,
      minimumX: boxes.length ? Math.min(...boxes.map((box) => box.x)) : 0
    };
  });
  if (!comparisonBlockLabels.labels || comparisonBlockLabels.wrapped < 1 || comparisonBlockLabels.minimumX < 5) {
    throw new Error(`Comparison block labels overflow: ${JSON.stringify(comparisonBlockLabels)}`);
  }
  await page.screenshot({ path: path.join(artifacts, "plot-compare-block-labels-1600x900.png"), fullPage: false });
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.waitForTimeout(260);
  const wideBlockLabels = await page.evaluate(() => {
    const labels = [...document.querySelectorAll(".plot-row-label")];
    const boxes = labels.map((label) => label.getBBox());
    return {
      wrapped: labels.filter((label) => label.querySelectorAll("tspan").length > 1).length,
      minimumX: boxes.length ? Math.min(...boxes.map((box) => box.x)) : 0
    };
  });
  if (wideBlockLabels.wrapped < 1 || wideBlockLabels.minimumX < 5) throw new Error(`Wide block labels overflow: ${JSON.stringify(wideBlockLabels)}`);
  await page.screenshot({ path: path.join(artifacts, "plot-compare-block-labels-2560x1440.png"), fullPage: false });
  await page.setViewportSize(viewports[0]);
  await page.waitForTimeout(220);
  await page.click('[data-plot-view="profile"]');
  await page.selectOption("#plotClass", "1");
  const detail = await page.evaluate(() => ({
    mode: state.plotView,
    level: state.plotLevel,
    classKey: state.plotClass,
    rows: document.querySelectorAll(".plot-cause-row").length,
    title: document.querySelector(".plot-analysis__summary strong")?.textContent
  }));
  if (detail.level !== "block" || detail.classKey !== "1" || !detail.rows) throw new Error(`Block detail failed: ${JSON.stringify(detail)}`);

  await page.click('[data-plot-level="class"]');
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(180);
    const layout = await page.evaluate(() => {
      const host = document.getElementById("viz");
      const canvas = document.querySelector(".plot-analysis__canvas");
      const labels = [...document.querySelectorAll(".plot-row-label")];
      return {
        overflowX: host ? host.scrollWidth - host.clientWidth : 0,
        canvasOverflowY: canvas ? canvas.scrollHeight - canvas.clientHeight : 0,
        rows: document.querySelectorAll(".plot-cause-row").length,
        smallestLabel: labels.length ? Math.min(...labels.map((node) => parseFloat(getComputedStyle(node).fontSize))) : 0
      };
    });
    if (layout.overflowX > 2 || layout.canvasOverflowY > 2 || layout.rows < 10 || layout.smallestLabel < 10.5) throw new Error(`Layout failed at ${viewport.name}: ${JSON.stringify(layout)}`);
    await page.screenshot({ path: path.join(artifacts, `plot-profile-${viewport.name}.png`), fullPage: false });
  }

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.click('[data-plot-top="25"]');
  const dense = await page.evaluate(() => {
    const canvas = document.querySelector(".plot-analysis__canvas");
    return {
      rows: document.querySelectorAll(".plot-cause-row").length,
      dense: document.querySelector(".plot-analysis--dense") !== null,
      canvasOverflowY: canvas ? canvas.scrollHeight - canvas.clientHeight : 0,
      overflowStyle: canvas ? getComputedStyle(canvas).overflowY : ""
    };
  });
  if (dense.rows <= 15 || !dense.dense || dense.canvasOverflowY > 2 || dense.overflowStyle !== "hidden") throw new Error(`Dense canvas failed: ${JSON.stringify(dense)}`);
  await page.screenshot({ path: path.join(artifacts, "plot-profile-dense-1366x768.png"), fullPage: false });

  await page.click('[data-view="treemap"]');
  await page.waitForSelector(".treemap-v2-layout");
  const restored = await page.evaluate(() => ({
    yearDisabled: document.getElementById("yearSelect")?.disabled,
    sexDisabled: [...document.querySelectorAll("#sexSeg button")].some((button) => button.disabled)
  }));
  if (restored.yearDisabled || restored.sexDisabled) throw new Error(`Filters not restored: ${JSON.stringify(restored)}`);

  console.log(JSON.stringify({ url, initial, selected, distribution, timeCompare, sexCompare, blockLabels, comparisonBlockLabels, wideBlockLabels, detail, dense, restored, errors }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close().catch(() => {});
});
