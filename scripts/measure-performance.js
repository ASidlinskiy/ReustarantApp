// Run against two production builds served at different URLs; no orders are sent.
import { chromium } from "@playwright/test";
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
const [baselineUrl, candidateUrl, baselineDir, candidateDir, output = "test-results/performance"] =
  process.argv.slice(2);
if (!candidateDir)
  throw new Error(
    "Usage: node scripts/measure-performance.js BASELINE_URL CANDIDATE_URL BASELINE_DIST CANDIDATE_DIST [OUTPUT]"
  );
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = {
  browser: browser.version(),
  viewport: { width: 320, height: 800 },
  cpuSlowdown: 4,
  cycles: 10,
  runs: 5,
  variants: {},
};
try {
  for (const [label, url, directory] of [
    ["baseline", baselineUrl, baselineDir],
    ["candidate", candidateUrl, candidateDir],
  ]) {
    const runs = [];
    for (let run = 0; run < 5; run++) {
      const page = await browser.newPage({ viewport: results.viewport });
      await page.goto(url, { waitUntil: "networkidle" });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Performance.enable");
      const metrics = async () =>
        Object.fromEntries(
          (await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value])
        );
      const events = [];
      if (run === 0) {
        cdp.on("Tracing.dataCollected", ({ value }) => events.push(...value));
        await cdp.send("Tracing.start", {
          categories: "devtools.timeline",
          transferMode: "ReportEvents",
        });
      }
      const before = await metrics();
      const elapsedMs = await page.evaluate(() => {
        const start = performance.now();
        for (let cycle = 0; cycle < 10; cycle++) {
          document.querySelectorAll(".menu-item-button-add").forEach((button) => button.click());
          document
            .querySelectorAll('[data-action="remove"], .menu-item-form-cart-btn')
            .forEach((button) => {
              // The baseline recreates rows on every click, so find the live button by item ID.
              const id = button.closest(".cart-row")?.dataset.menuId || button.dataset.menuId;
              const live = document.querySelector(
                `.cart-row[data-menu-id="${id}"] [data-action="remove"], .menu-item-form-cart-btn[data-menu-id="${id}"]`
              );
              live?.click();
            });
        }
        return performance.now() - start;
      });
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      );
      const after = await metrics();
      runs.push({
        elapsedMs,
        layoutCount: after.LayoutCount - before.LayoutCount,
        layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
        scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
      });
      if (run === 0) {
        const done = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
        await cdp.send("Tracing.end");
        await done;
        await writeFile(
          join(output, `${label}-trace.json`),
          JSON.stringify({ traceEvents: events })
        );
      }
      await page.close();
    }
    const assets = [];
    for (const file of [
      "index.html",
      ...(await readdir(join(directory, "assets")))
        .filter((name) => /\.(js|css)$/.test(name))
        .map((name) => `assets/${name}`),
    ]) {
      const bytes = await readFile(join(directory, file));
      assets.push({ file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
    }
    const median = (key) => runs.map((run) => run[key]).sort((a, b) => a - b)[2];
    results.variants[label] = {
      runs,
      median: Object.fromEntries(
        ["elapsedMs", "layoutCount", "layoutMs", "scriptMs"].map((key) => [key, median(key)])
      ),
      assets,
    };
  }
  const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
  await page.goto(candidateUrl);
  await page.getByRole("button", { name: "Add Pizza to cart", exact: true }).click();
  await page.screenshot({ path: join(output, "mobile-320.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(candidateUrl);
  await page.getByRole("button", { name: "Add Pizza to cart", exact: true }).click();
  await page.screenshot({ path: join(output, "desktop.png"), fullPage: true });
} finally {
  await browser.close();
}
await writeFile(join(output, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
