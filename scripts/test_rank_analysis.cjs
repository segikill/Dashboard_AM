const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const artifacts = path.join(root, "artifacts");
fs.mkdirSync(artifacts, { recursive: true });

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const url = process.env.ATLAS_URL || "http://127.0.0.1:8765/";
const viewports = [
  { width: 1600, height: 900, name: "1600x900" },
  { width: 1920, height: 1080, name: "1920x1080" },
  { width: 2560, height: 1440, name: "2560x1440" }
];

let browser;

(async () => {
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const errors = [];
  const page = await browser.newPage({ viewport: viewports[0], deviceScaleFactor: 1 });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().startsWith("http://127.0.0.1")) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.click('[data-view="arrow"]');
  await page.waitForSelector(".rank-analysis .rank-trajectory", { timeout: 15_000 });

  const initial = await page.evaluate(() => ({
    title: document.getElementById("chartTitle")?.textContent,
    rankView: state.rankView,
    rankCompare: state.rankCompare,
    trajectories: document.querySelectorAll(".rank-analysis .rank-trajectory").length,
    selected: document.querySelectorAll(".rank-analysis .rank-trajectory.is-selected").length,
    inspectorTitle: document.querySelector(".hybrid-inspector__selection h4")?.textContent,
    changeMarker: (() => {
      const marker = document.querySelector(".rank-delta-pill");
      const text = document.querySelector(".rank-delta-text");
      return marker && text ? [Number(marker.getAttribute("width")), Number(marker.getAttribute("height")), parseFloat(getComputedStyle(text).fontSize)] : null;
    })(),
    hostOverflow: (() => {
      const host = document.getElementById("viz");
      return [host.clientWidth, host.scrollWidth, host.clientHeight, host.scrollHeight];
    })()
  }));
  if (initial.title !== "Анализ рангов причин смерти") throw new Error(`Unexpected title: ${initial.title}`);
  if (initial.rankView !== "compare" || initial.rankCompare !== "time") throw new Error("Initial rank mode is incorrect");
  if (initial.trajectories < 10 || initial.selected !== 1) throw new Error(`Unexpected initial trajectories: ${JSON.stringify(initial)}`);
  if (!initial.changeMarker || initial.changeMarker[0] < 34 || initial.changeMarker[1] < 22 || initial.changeMarker[2] < 9) {
    throw new Error(`Rank-change marker is too small: ${JSON.stringify(initial.changeMarker)}`);
  }

  await page.locator(".rank-trajectory").nth(2).click();
  await page.waitForTimeout(100);
  const selected = await page.evaluate(() => ({
    selected: document.querySelectorAll(".rank-trajectory.is-selected").length,
    title: document.querySelector(".hybrid-inspector__selection h4")?.textContent,
    metrics: [...document.querySelectorAll(".hybrid-inspector__metric")].map((node) => node.textContent.trim()),
    insight: document.querySelector(".hybrid-inspector__insight")?.textContent
  }));
  if (selected.selected !== 1 || !selected.title || selected.metrics.length < 4 || !selected.insight) {
    throw new Error(`Inspector selection failed: ${JSON.stringify(selected)}`);
  }

  await page.click('[data-rank-view="trend"]');
  await page.waitForSelector('.rank-analysis__summary strong:text("Траектории 2023–2025")');
  const trend = await page.evaluate(() => ({
    view: state.rankView,
    years: [...document.querySelectorAll(".rank-year-label")].map((node) => node.textContent),
    trajectories: document.querySelectorAll(".rank-trajectory").length,
    points: document.querySelectorAll(".rank-trajectory .rank-point").length,
    numberedMarker: (() => {
      const marker = document.querySelector(".rank-point--numbered");
      const text = document.querySelector(".rank-rank-number");
      return marker && text ? [Number(marker.getAttribute("r")), parseFloat(getComputedStyle(text).fontSize)] : null;
    })()
  }));
  if (trend.view !== "trend" || trend.years.join(",") !== "2023,2024,2025") throw new Error(`Trend mode failed: ${JSON.stringify(trend)}`);
  if (trend.points !== trend.trajectories * 3) throw new Error(`Trend point count mismatch: ${JSON.stringify(trend)}`);
  if (!trend.numberedMarker || trend.numberedMarker[0] < 8 || trend.numberedMarker[1] < 9) {
    throw new Error(`Annual rank marker is too small: ${JSON.stringify(trend.numberedMarker)}`);
  }
  await page.screenshot({ path: path.join(artifacts, "rank-analysis-trend-1600x900.png"), fullPage: false });

  await page.check("#rankOnlyChanges");
  const changedOnly = await page.evaluate(() => ({
    enabled: state.rankOnlyChanges,
    trajectories: document.querySelectorAll(".rank-trajectory").length
  }));
  if (changedOnly.enabled !== "1" || changedOnly.trajectories >= trend.trajectories) {
    throw new Error(`Changed-only filter failed: ${JSON.stringify(changedOnly)}`);
  }
  await page.uncheck("#rankOnlyChanges");

  await page.selectOption("#rankLevel", "block");
  await page.waitForSelector("#rankClass");
  await page.selectOption("#rankClass", "1");
  await page.selectOption("#rankMetric", "pgpzh");
  const detailed = await page.evaluate(() => ({
    level: state.rankLevel,
    classKey: state.rankClass,
    metric: state.rankMetric,
    trajectories: document.querySelectorAll(".rank-trajectory").length,
    subtitle: document.querySelector(".rank-analysis__summary span")?.textContent
  }));
  if (detailed.level !== "block" || detailed.classKey !== "1" || detailed.metric !== "pgpzh" || !detailed.trajectories) {
    throw new Error(`Detail controls failed: ${JSON.stringify(detailed)}`);
  }

  await page.click('[data-rank-view="compare"]');
  await page.selectOption("#rankCompare", "sex");
  const sex = await page.evaluate(() => ({
    compare: state.rankCompare,
    summary: document.querySelector(".rank-analysis__summary strong")?.textContent,
    note: document.querySelector(".rank-analysis__footnote")?.textContent
  }));
  if (sex.compare !== "sex" || !sex.summary.includes("Мужчины") || !sex.note.includes("не половозрастной")) {
    throw new Error(`Sex comparison failed: ${JSON.stringify(sex)}`);
  }

  await page.selectOption("#rankLevel", "class");
  await page.selectOption("#rankMetric", "n");
  await page.selectOption("#rankCompare", "time");
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    const layout = await page.evaluate(() => {
      const host = document.getElementById("viz");
      const chart = document.querySelector(".rank-analysis");
      const inspector = document.getElementById("hybridInspector");
      const labels = [...document.querySelectorAll(".rank-label")];
      return {
        host: host?.getBoundingClientRect().toJSON(),
        chart: chart?.getBoundingClientRect().toJSON(),
        inspector: inspector?.getBoundingClientRect().toJSON(),
        overflowX: host ? host.scrollWidth - host.clientWidth : 0,
        smallestLabel: labels.length ? Math.min(...labels.map((node) => parseFloat(getComputedStyle(node).fontSize))) : 0,
        trajectories: document.querySelectorAll(".rank-trajectory").length
      };
    });
    if (layout.overflowX > 2 || layout.smallestLabel < 8 || layout.trajectories < 10) {
      throw new Error(`Layout failed at ${viewport.name}: ${JSON.stringify(layout)}`);
    }
    await page.screenshot({ path: path.join(artifacts, `rank-analysis-${viewport.name}.png`), fullPage: false });
  }

  for (const view of ["treemap", "heatmap", "pyramid", "plot", "dotogram", "arrow"]) {
    await page.click(`[data-view="${view}"]`);
    await page.waitForTimeout(80);
    const visible = await page.evaluate(() => document.getElementById("viz")?.children.length || 0);
    if (!visible) throw new Error(`View ${view} did not render`);
  }

  await page.click('[data-view="map"]');
  await page.waitForSelector(".mortality-map .maplibregl-canvas", { timeout: 20_000 });
  await page.waitForFunction(() => {
    const debug = window.AmurMortalityMap?.debug?.();
    return debug?.mounted && debug.features > 0 && debug.layers.length > 0;
  }, null, { timeout: 20_000 });

  console.log(JSON.stringify({ url, initial, selected, trend, detailed, sex, errors }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close().catch(() => {});
});
