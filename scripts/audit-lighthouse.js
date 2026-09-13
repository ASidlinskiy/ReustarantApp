import { spawn } from "node:child_process";
import { createServer } from "node:net";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";

const url = process.argv[2] || "http://127.0.0.1:4180";
const output = resolve(process.env.LIGHTHOUSE_OUTPUT || "test-results/lighthouse");
const repetitions = Number(process.env.LIGHTHOUSE_RUNS || 3);
const server = process.argv[2]
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "4180",
        "--strictPort",
      ],
      { windowsHide: true, stdio: "ignore" }
    );
const results = [];
try {
  if (server) {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (server.exitCode !== null) throw new Error("Lighthouse preview server could not start.");
      try {
        ready = (await fetch(url)).ok;
      } catch {
        /* Server is still starting. */
      }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error("Lighthouse preview server did not become ready.");
  }
  await mkdir(output, { recursive: true });
  for (const profile of ["mobile", "desktop"]) {
    for (let index = 1; index <= repetitions; index++) {
      const path = join(output, `${profile}-${index}`);
      const portServer = createServer();
      await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
      const port = portServer.address().port;
      await new Promise((resolve) => portServer.close(resolve));
      const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
      let report;
      try {
        const result = await lighthouse(
          url,
          {
            port,
            logLevel: "error",
            output: ["html", "json"],
            onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
          },
          profile === "desktop" ? desktopConfig : undefined
        );
        report = result.lhr;
        await writeFile(`${path}.report.html`, result.report[0]);
        await writeFile(`${path}.report.json`, result.report[1]);
      } finally {
        await browser.close();
      }
      const scores = Object.fromEntries(
        Object.entries(report.categories).map(([key, value]) => [
          key,
          Math.round(value.score * 100),
        ])
      );
      const result = {
        profile,
        run: index,
        scores,
        lighthouseVersion: report.lighthouseVersion,
        url: report.finalDisplayedUrl,
        report: `${path}.report.html`,
      };
      results.push(result);
      console.log(JSON.stringify(result));
    }
  }
  await writeFile(join(output, "summary.json"), JSON.stringify(results, null, 2));
  if (results.some(({ scores }) => Object.values(scores).some((score) => score < 98))) {
    process.exitCode = 1;
    console.error(
      "Lighthouse threshold failed: every category must score at least 98 on every run."
    );
  }
} finally {
  server?.kill();
}
