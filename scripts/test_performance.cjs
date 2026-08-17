const { chromium } = require("playwright");

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const base = process.env.ATLAS_URL || "http://127.0.0.1:8765/";

let browser;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

(async () => {
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  const started = Date.now();
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector('[data-view="map"]', { timeout: 15_000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const load = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
      resourceCount: resources.length,
      domNodes: document.getElementsByTagName("*").length
    };
  });

  const measureAction = async (label, selector, repeat = 3) => {
    const values = [];
    const samples = [];
    for (let index = 0; index < repeat; index += 1) {
      const sample = await page.evaluate(async ({ selector }) => {
        const target = document.querySelector(selector);
        if (!target) throw new Error(`Missing selector: ${selector}`);
        const start = performance.now();
        target.click();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const end = performance.now();
        return {
          duration: end - start,
          nodes: document.getElementsByTagName("*").length,
          svgNodes: document.querySelectorAll("#viz svg *").length,
          view: window.state?.view || null
        };
      }, { selector });
      values.push(sample.duration);
      samples.push(sample);
    }
    return {
      label,
      medianMs: Math.round(median(values) * 10) / 10,
      maxMs: Math.round(Math.max(...values) * 10) / 10,
      nodes: samples.at(-1).nodes,
      svgNodes: samples.at(-1).svgNodes,
      view: samples.at(-1).view
    };
  };

  const views = [];
  for (const view of ["treemap", "heatmap", "arrow", "pyramid", "plot", "dotogram"]) {
    views.push(await measureAction(view, `[data-view="${view}"]`, 3));
  }

  await page.click('[data-view="plot"]');
  await page.waitForSelector(".plot-analysis");
  const plotControls = [];
  for (const selector of ['[data-plot-level="code"]', '[data-plot-top="25"]', '[data-plot-view="compare"]']) {
    plotControls.push(await measureAction(selector, selector, 3));
  }

  const globalFilter = await page.evaluate(async () => {
    const select = document.getElementById("yearSelect");
    select.value = String(DATA.years[0]);
    const start = performance.now();
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Math.round((performance.now() - start) * 10) / 10;
  });

  const memory = await page.evaluate(() => performance.memory ? {
    usedMb: Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10,
    totalMb: Math.round(performance.memory.totalJSHeapSize / 1048576 * 10) / 10
  } : null);

  console.log(JSON.stringify({
    url: base,
    wallLoadMs: Date.now() - started,
    load,
    views,
    plotControls,
    globalFilterMs: globalFilter,
    memory,
    errors
  }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close().catch(() => {});
});
