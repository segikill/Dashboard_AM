const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const artifacts = path.join(root, "artifacts");
fs.mkdirSync(artifacts, { recursive: true });

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const base = process.env.ATLAS_URL || "http://127.0.0.1:8765/";
const url = `${base}${base.includes("?") ? "&" : "?"}view=pyramid`;
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
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".pyramid-analysis .pyramid-age-row", { timeout: 15_000 });

  const initial = await page.evaluate(() => ({
    title: document.getElementById("chartTitle")?.textContent,
    mode: state.pyramidView,
    rows: document.querySelectorAll(".pyramid-age-row").length,
    selected: document.querySelectorAll(".pyramid-age-row.is-selected").length,
    medianMarkers: document.querySelectorAll(".pyramid-median-marker, .pyramid-median-label").length,
    ageDisabled: document.getElementById("ageSelect")?.disabled,
    yearDisabled: document.getElementById("yearSelect")?.disabled,
    sexDisabled: [...document.querySelectorAll("#sexSeg button")].every((button) => button.disabled),
    meta: document.getElementById("chartMeta")?.textContent,
    inspectorTitle: document.querySelector(".hybrid-inspector__selection h4")?.textContent
  }));
  if (initial.title !== "Возрастно-половой профиль смертности") throw new Error(`Unexpected title: ${initial.title}`);
  if (initial.mode !== "structure" || initial.rows !== 18 || initial.selected !== 0 || initial.medianMarkers !== 0) throw new Error(`Initial pyramid failed: ${JSON.stringify(initial)}`);
  if (!initial.ageDisabled || !initial.sexDisabled || initial.yearDisabled) throw new Error(`Global filter state failed: ${JSON.stringify(initial)}`);
  if (!initial.meta.includes("оба пола") || !initial.meta.includes("все возрасты")) throw new Error(`Pyramid metadata failed: ${initial.meta}`);

  await page.locator(".pyramid-age-row").nth(3).hover();
  const hoverState = await page.evaluate(() => ({
    active: document.querySelectorAll(".pyramid-age-row.is-active").length,
    dimmed: [...document.querySelectorAll(".pyramid-age-row")].filter((node) => Number.parseFloat(getComputedStyle(node).opacity) < .99).length,
    focusMode: document.querySelector(".pyramid-analysis-svg")?.classList.contains("has-focus")
  }));
  if (hoverState.active !== 1 || hoverState.dimmed !== 0 || hoverState.focusMode) throw new Error(`Hover emphasis failed: ${JSON.stringify(hoverState)}`);

  await page.locator(".pyramid-age-row").nth(4).click();
  await page.waitForTimeout(80);
  const selection = await page.evaluate(() => ({
    selected: document.querySelectorAll(".pyramid-age-row.is-selected").length,
    title: document.querySelector(".hybrid-inspector__selection h4")?.textContent,
    metrics: document.querySelectorAll(".hybrid-inspector__metric").length,
    insight: document.querySelector(".hybrid-inspector__insight")?.textContent
  }));
  if (selection.selected !== 0 || !selection.title?.includes("Возраст") || selection.metrics < 4 || !selection.insight) {
    throw new Error(`Inspector interaction failed: ${JSON.stringify(selection)}`);
  }

  await page.click('[data-pyramid-view="trend"]');
  await page.waitForSelector(".pyramid-analysis--trend .pyramid-bar--baseline");
  const trend = await page.evaluate(() => ({
    mode: state.pyramidView,
    rows: document.querySelectorAll(".pyramid-age-row").length,
    baselines: document.querySelectorAll(".pyramid-bar--baseline").length,
    current: document.querySelectorAll(".pyramid-bar--current").length,
    yearDisabled: document.getElementById("yearSelect")?.disabled,
    note: document.querySelector(".pyramid-analysis__footnote")?.textContent
  }));
  if (trend.mode !== "trend" || trend.rows !== 18 || trend.baselines !== 36 || trend.current !== 36 || !trend.yearDisabled) {
    throw new Error(`Trend mode failed: ${JSON.stringify(trend)}`);
  }
  if (!trend.note.includes("2023") || !trend.note.includes("2025")) throw new Error(`Trend explanation missing: ${trend.note}`);
  await page.screenshot({ path: path.join(artifacts, "pyramid-analysis-trend-1600x900.png"), fullPage: false });

  await page.click('[data-pyramid-view="gap"]');
  await page.waitForSelector(".pyramid-analysis--gap .pyramid-ratio-pill");
  const gap = await page.evaluate(() => ({
    mode: state.pyramidView,
    ratios: document.querySelectorAll(".pyramid-ratio-pill").length,
    yearDisabled: document.getElementById("yearSelect")?.disabled
  }));
  if (gap.mode !== "gap" || gap.ratios !== 18 || gap.yearDisabled) throw new Error(`Gap mode failed: ${JSON.stringify(gap)}`);
  await page.screenshot({ path: path.join(artifacts, "pyramid-analysis-gap-1600x900.png"), fullPage: false });

  await page.selectOption("#pyramidAgeStep", "10");
  const ageStep = await page.evaluate(() => ({ step: state.pyramidAgeStep, rows: document.querySelectorAll(".pyramid-age-row").length }));
  if (ageStep.step !== "10" || ageStep.rows !== 9) throw new Error(`Age-step switch failed: ${JSON.stringify(ageStep)}`);

  await page.selectOption("#pyramidLevel", "block");
  await page.selectOption("#pyramidParentClass", "1");
  const firstBlock = await page.locator("#pyramidCause option").nth(1).getAttribute("value");
  if (!firstBlock) throw new Error("No block choices found");
  await page.selectOption("#pyramidCause", firstBlock);
  await page.selectOption("#pyramidMetric", "pgpzh");
  const detailed = await page.evaluate(() => ({
    level: state.pyramidLevel,
    classKey: state.pyramidParentClass,
    cause: state.pyramidCause,
    metric: state.pyramidMetric,
    title: document.querySelector(".pyramid-analysis__summary strong")?.textContent
  }));
  if (detailed.level !== "block" || detailed.classKey !== "1" || detailed.cause === "all" || detailed.metric !== "pgpzh" || !detailed.title) {
    throw new Error(`Cause detail failed: ${JSON.stringify(detailed)}`);
  }

  await page.selectOption("#pyramidLevel", "class");
  await page.selectOption("#pyramidMetric", "n");
  await page.selectOption("#pyramidAgeStep", "5");
  await page.click('[data-pyramid-view="structure"]');
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(180);
    const layout = await page.evaluate(() => {
      const host = document.getElementById("viz");
      const chart = document.querySelector(".pyramid-analysis");
      const labels = [...document.querySelectorAll(".pyramid-age-label")];
      return {
        overflowX: host ? host.scrollWidth - host.clientWidth : 0,
        overflowY: host ? host.scrollHeight - host.clientHeight : 0,
        hostWidth: host?.clientWidth,
        chartWidth: chart?.getBoundingClientRect().width,
        smallestLabel: labels.length ? Math.min(...labels.map((node) => parseFloat(getComputedStyle(node).fontSize))) : 0,
        rows: document.querySelectorAll(".pyramid-age-row").length
      };
    });
    if (layout.overflowX > 2 || layout.smallestLabel < 8.5 || layout.rows !== 18) throw new Error(`Layout failed at ${viewport.name}: ${JSON.stringify(layout)}`);
    await page.screenshot({ path: path.join(artifacts, `pyramid-analysis-${viewport.name}.png`), fullPage: false });
  }

  await page.click('[data-view="treemap"]');
  await page.waitForSelector(".treemap-v2-layout");
  const restored = await page.evaluate(() => ({
    view: state.view,
    bodyClass: document.body.className,
    localTitle: document.getElementById("localControls")?.textContent?.trim().slice(0, 120),
    ageDisabled: document.getElementById("ageSelect")?.disabled,
    yearDisabled: document.getElementById("yearSelect")?.disabled,
    sexDisabled: [...document.querySelectorAll("#sexSeg button")].some((button) => button.disabled)
  }));
  if (restored.ageDisabled || restored.yearDisabled || restored.sexDisabled) throw new Error(`Global controls not restored: ${JSON.stringify(restored)}`);

  console.log(JSON.stringify({ url, initial, selection, trend, gap, ageStep, detailed, restored, errors }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close().catch(() => {});
});
