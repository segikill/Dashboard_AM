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
    yearDisabled: document.getElementById("yearSelect")?.disabled,
    sexDisabled: [...document.querySelectorAll("#sexSeg button")].some((button) => button.disabled)
  }));
  if (initial.title !== "Возраст смерти по причинам" || initial.mode !== "profile") throw new Error(`Initial plot failed: ${JSON.stringify(initial)}`);
  if (initial.rows < 10 || initial.rows > 15 || initial.iqr !== initial.rows || initial.outer !== initial.rows || initial.reference !== 1 || initial.selected !== 0) {
    throw new Error(`Profile geometry failed: ${JSON.stringify(initial)}`);
  }
  if (initial.yearDisabled || initial.sexDisabled) throw new Error(`Unexpected disabled filters: ${JSON.stringify(initial)}`);

  await page.locator(".plot-cause-row").nth(2).click();
  await page.waitForTimeout(80);
  const selected = await page.evaluate(() => ({
    cause: state.plotCause,
    openDisabled: document.querySelector(".plot-distribution-open")?.disabled,
    inspector: document.querySelector(".hybrid-inspector__selection h4")?.textContent,
    metrics: document.querySelectorAll(".hybrid-inspector__metric").length,
    persistent: document.querySelectorAll(".plot-cause-row.is-selected").length
  }));
  if (selected.cause === "all" || selected.openDisabled || !selected.inspector || selected.metrics < 4 || selected.persistent) {
    throw new Error(`Profile selection failed: ${JSON.stringify(selected)}`);
  }

  await page.click(".plot-distribution-open");
  await page.waitForSelector(".plot-analysis--distribution .plot-density-area");
  const distribution = await page.evaluate(() => ({
    mode: state.plotView,
    cause: state.plotCause,
    density: document.querySelectorAll(".plot-density-area").length,
    histogram: document.querySelectorAll(".plot-histogram-bar").length,
    iqr: document.querySelectorAll(".plot-box-iqr").length,
    median: document.querySelectorAll(".plot-box-median").length,
    causeSelect: document.getElementById("plotCause")?.value,
    footnote: document.querySelector(".plot-analysis__footnote")?.textContent
  }));
  if (distribution.mode !== "distribution" || distribution.cause === "all" || distribution.density !== 1 || distribution.histogram !== 22 || distribution.iqr !== 1 || distribution.median !== 1) {
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

  await page.click('[data-plot-view="profile"]');
  await page.selectOption("#plotLevel", "block");
  await page.waitForSelector("#plotClass");
  await page.selectOption("#plotClass", "1");
  const detail = await page.evaluate(() => ({
    mode: state.plotView,
    level: state.plotLevel,
    classKey: state.plotClass,
    rows: document.querySelectorAll(".plot-cause-row").length,
    title: document.querySelector(".plot-analysis__summary strong")?.textContent
  }));
  if (detail.level !== "block" || detail.classKey !== "1" || !detail.rows) throw new Error(`Block detail failed: ${JSON.stringify(detail)}`);

  await page.selectOption("#plotLevel", "class");
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(180);
    const layout = await page.evaluate(() => {
      const host = document.getElementById("viz");
      const labels = [...document.querySelectorAll(".plot-row-label")];
      return {
        overflowX: host ? host.scrollWidth - host.clientWidth : 0,
        rows: document.querySelectorAll(".plot-cause-row").length,
        smallestLabel: labels.length ? Math.min(...labels.map((node) => parseFloat(getComputedStyle(node).fontSize))) : 0
      };
    });
    if (layout.overflowX > 2 || layout.rows < 10 || layout.smallestLabel < 8.5) throw new Error(`Layout failed at ${viewport.name}: ${JSON.stringify(layout)}`);
    await page.screenshot({ path: path.join(artifacts, `plot-profile-${viewport.name}.png`), fullPage: false });
  }

  await page.click('[data-view="treemap"]');
  await page.waitForSelector(".treemap-v2");
  const restored = await page.evaluate(() => ({
    yearDisabled: document.getElementById("yearSelect")?.disabled,
    sexDisabled: [...document.querySelectorAll("#sexSeg button")].some((button) => button.disabled)
  }));
  if (restored.yearDisabled || restored.sexDisabled) throw new Error(`Filters not restored: ${JSON.stringify(restored)}`);

  console.log(JSON.stringify({ url, initial, selected, distribution, timeCompare, sexCompare, detail, restored, errors }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close().catch(() => {});
});
