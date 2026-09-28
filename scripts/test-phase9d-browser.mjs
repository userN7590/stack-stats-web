// Phase 9D homepage/fingerprint browser checks with synthetic data only.
// Requires Playwright and installed Chrome; STACK_STATS_PLAYWRIGHT_PATH may point
// to a temporary Playwright package. Screenshots go to STACK_STATS_SCREENSHOTS.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.STACK_STATS_PLAYWRIGHT_PATH ? pathToFileURL(process.env.STACK_STATS_PLAYWRIGHT_PATH).href : "playwright");
const port = 3141;
const base = `http://127.0.0.1:${port}`;
const root = new URL("../", import.meta.url);
const route = new URL("src/app/phase9d-browser-fixture/", root);
const output = process.env.STACK_STATS_SCREENSHOTS || "/private/tmp/stack-stats-phase9d";
const ownerUrl = "/api/v2/sync/datasets?dataset=hourlyUtc&period=30";

// Synthetic owner payload: a late-working pattern with missing and unavailable dates.
function ownerPayload() {
  const coverage = { source: "sessions-v1", dateBasis: "collector-local", historyCompleteness: "unknown", partial: true, recordCount: 26, v1Records: 0, v2Records: 26,
    firstUploadedDate: "2026-08-30", lastUploadedDate: "2026-09-28", uploadedDates: 26, firstObservedDate: "2026-08-30", lastObservedDate: "2026-09-28", earliestUploadFromDate: "2026-06-30", latestUploadFromDate: "2026-06-30", hourlyRecords: 24, hourlyDates: 24, frozenHourlyRecords: 0, lateInputIgnoredRecords: 0 };
  const rows = [];
  for (let day = 0; day < 30; day++) {
    const date = new Date(Date.UTC(2026, 7, 30 + day)).toISOString().slice(0, 10);
    if (day % 9 === 4 || day === 17) continue; // No record.
    const unavailable = day === 2 || day === 21;
    const active = Array.from({ length: 24 }, (_, hour) => {
      const late = hour >= 18 || hour <= 1 ? 40 - Math.abs(21 - (hour + 24) % 24) * 6 : hour >= 12 ? 14 : 0;
      return Math.max(0, late + ((day * 7 + hour * 3) % 11) - 5) * 60_000;
    });
    rows.push({ date, coverage, hourlyUtc: unavailable ? null : { source: "telemetry-v2", dateBasis: "UTC", activeMsByHour: active, editCountByHour: active.map(value => Math.floor(value / 20_000)), linesAddedByHour: Array(24).fill(0), linesRemovedByHour: Array(24).fill(0) } });
  }
  return { schemaVersion: "2", dataset: "hourlyUtc", from: "2026-08-30", to: "2026-09-28", dateBasis: "UTC", coverage, rows };
}

const ridgePaths = (page) => page.locator(".hero-figure [data-ridge]").evaluateAll(nodes => nodes.map(node => node.getAttribute("d")));
const readout = (page) => page.locator(".hero-figure .fp-readout").innerText();
const settle = async (page) => {
  // Interval polling: rAF polling would itself keep frames running.
  try { await page.waitForFunction(() => window.__phase9dIdle?.(), undefined, { timeout: 8000, polling: 200 }); }
  catch (error) { console.error("Animation frame sources:", await page.evaluate(() => window.__phase9dSources())); throw error; }
};
const rafProbe = () => {
  // Counts animation frames so the runner can prove the engine goes idle.
  let frames = 0, last = performance.now();
  const original = window.requestAnimationFrame.bind(window);
  const sources = new Map();
  window.requestAnimationFrame = (callback) => {
    const site = (new Error().stack || "").split("\n")[2]?.trim().slice(0, 140) ?? "?";
    sources.set(site, (sources.get(site) ?? 0) + 1);
    return original((time) => { frames++; last = performance.now(); callback(time); });
  };
  window.__phase9dSources = () => [...sources].sort((a, b) => b[1] - a[1]).slice(0, 5);
  window.__phase9dFrames = () => frames;
  window.__phase9dIdle = () => performance.now() - last > 400;
  window.__phase9dLongTasks = 0;
  try { new PerformanceObserver(list => { window.__phase9dLongTasks += list.getEntries().length; }).observe({ type: "longtask", buffered: false }); } catch { /* Unsupported. */ }
};

let server, browser, ownsRoute = false;
const errors = [];
const watch = (page, label) => {
  page.on("pageerror", error => errors.push(`${label}: ${error.message}`));
  page.on("console", message => { if (message.type() === "error" && /hydrat|did not match|server rendered|Warning:/i.test(message.text())) errors.push(`${label}: ${message.text()}`); });
};
try {
  await mkdir(route); // Refuse to replace an existing user route.
  ownsRoute = true;
  await writeFile(new URL("page.tsx", route), 'import { HomePreview } from "../../../tests/fixtures/home-preview";\nexport const dynamic = "force-dynamic";\nexport default function Page() { return <HomePreview />; }\n');
  await mkdir(output, { recursive: true });
  server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://phase9d.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-test-key" },
  });
  let log = ""; server.stdout.on("data", data => { log += data; }); server.stderr.on("data", data => { log += data; });
  for (const path of ["/", "/phase9d-browser-fixture", "/example"]) {
    let ready = false;
    for (let attempt = 0; attempt < 120 && !ready; attempt++) {
      if (server.exitCode !== null) throw new Error(log);
      try { ready = (await fetch(base + path)).ok; } catch { /* Starting. */ }
      if (!ready) await setTimeout(500);
    }
    if (!ready) throw new Error(`Local route ${path} did not start: ${log}`);
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });

  // 1. Anonymous desktop: static composition, hydration, interaction, idle.
  const desktop = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: "no-preference" });
  await desktop.addInitScript(rafProbe);
  const page = await desktop.newPage();
  watch(page, "desktop");
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator(".hero-figure [data-interactive]").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2200); // Entrance motion is one-shot and finishes here.
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Desktop homepage must not overflow");
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator(".hero-figure [data-ridge]").count(), 30);
  assert.match(await page.locator(".hero-figure .fp-source").innerText(), /not your activity/);
  const resting = await ridgePaths(page);
  const idleStart = await page.evaluate(() => window.__phase9dFrames());
  await page.waitForTimeout(1500);
  assert.ok(await page.evaluate(start => window.__phase9dFrames() - start, idleStart) <= 2, "No animation loop may run while idle");
  const metrics = await page.evaluate(() => ({ nodes: document.querySelectorAll("*").length, fingerprintNodes: document.querySelector(".hero-figure .fp-svg").querySelectorAll("*").length }));
  await page.screenshot({ path: `${output}/home-desktop.png`, fullPage: true });
  await page.screenshot({ path: `${output}/home-desktop-fold.png` });
  await page.locator(".hero-figure .fp-stage").screenshot({ path: `${output}/fingerprint-closeup.png` });

  const accent = await page.locator(".hero-figure .is-accent").boundingBox();
  const target = { x: accent.x + accent.width * 0.42, y: accent.y + 6 };
  await page.mouse.move(target.x - 120, target.y + 40);
  const beforeSweep = await page.evaluate(() => window.__phase9dLongTasks);
  for (let step = 0; step <= 24; step++) await page.mouse.move(target.x - 120 + step * 10, target.y + 40 - step * 1.6);
  await page.waitForTimeout(250);
  const deformed = await ridgePaths(page);
  if (deformed.every((path, index) => path === resting[index])) console.error("Stage:", await page.locator(".hero-figure .fp-stage").evaluate(node => JSON.stringify(node.dataset)), "Readout:", await readout(page), "Hit:", await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 120), target));
  assert.ok(deformed.some((path, index) => path !== resting[index]), "Pointer proximity must deform nearby ridges");
  assert.match(await readout(page), /day \d{2} — \d{2}:00–\d{2}:00 UTC — /);
  assert.equal(await page.locator(".hero-figure [data-cursor]").count(), 1);
  await page.screenshot({ path: `${output}/fingerprint-interaction.png`, clip: { x: 0, y: 200, width: 1360, height: 680 } });
  await page.waitForTimeout(1600); // Held still over the object: motion must come to rest.
  const holding = await page.evaluate(() => window.__phase9dFrames());
  await page.waitForTimeout(600);
  assert.ok(await page.evaluate(start => window.__phase9dFrames() - start, holding) <= 2, "A still pointer must not keep the loop running");
  assert.notDeepEqual(await ridgePaths(page), resting, "Held deformation stays rendered without a loop");
  await page.mouse.move(5, 5);
  await settle(page);
  assert.deepEqual(await ridgePaths(page), resting, "Settling must restore the exact server-rendered geometry");
  assert.match(await readout(page), /^Highlighted: busiest day/);
  const longTasks = await page.evaluate(start => window.__phase9dLongTasks - start, beforeSweep);
  const afterSettle = await page.evaluate(() => window.__phase9dFrames());
  await page.waitForTimeout(1000);
  assert.ok(await page.evaluate(start => window.__phase9dFrames() - start, afterSettle) <= 2, "The loop must stop after settling");
  console.log(`PASS desktop static/hydration/interaction/idle (DOM ${metrics.nodes} nodes, fingerprint SVG ${metrics.fingerprintNodes} nodes, long tasks during sweep ${longTasks})`);

  // Keyboard exploration and off-screen pause.
  await page.locator(".hero-figure .fp-stage").focus();
  await page.keyboard.press("ArrowUp");
  assert.match(await readout(page), /day \d{2}/);
  await page.keyboard.press("ArrowRight");
  const moved = await readout(page);
  await page.keyboard.press("Escape");
  assert.match(await readout(page), /^Highlighted/);
  assert.notEqual(moved, await readout(page));
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(120);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  assert.deepEqual(await ridgePaths(page), resting, "Off-screen fingerprint must stop and restore");
  await page.locator(".hero-figure details summary").click();
  await page.getByRole("button", { name: "Show all hourly values" }).click();
  assert.equal(await page.locator(".hero-figure .fp-matrix tbody tr").count(), 30);
  console.log("PASS keyboard, values table and off-screen pause");
  await desktop.close();

  // 2. Reduced motion: static geometry, no deformation, same information.
  const reduced = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: "reduce" });
  await reduced.addInitScript(rafProbe);
  const still = await reduced.newPage();
  watch(still, "reduced");
  await still.goto(base + "/", { waitUntil: "networkidle" });
  await still.locator(".hero-figure [data-interactive]").waitFor({ timeout: 60000 });
  assert.equal(await still.locator(".hero-figure .fp-ridge-group").first().evaluate(node => getComputedStyle(node).animationName), "none");
  assert.equal(await still.locator("[data-sketch] path").first().evaluate(node => getComputedStyle(node).strokeDasharray), "none");
  await still.screenshot({ path: `${output}/hero-reduced-motion.png` });
  const stillResting = await ridgePaths(still);
  const box = await still.locator(".hero-figure .is-accent").boundingBox();
  const frames = await still.evaluate(() => window.__phase9dFrames());
  for (let step = 0; step < 10; step++) await still.mouse.move(box.x + box.width * 0.3 + step * 12, box.y + 6);
  await still.waitForTimeout(400);
  assert.deepEqual(await ridgePaths(still), stillResting, "Reduced motion must not deform ridges");
  assert.match(await readout(still), /UTC — /, "Reduced motion keeps the exact readout");
  assert.ok(await still.evaluate(start => window.__phase9dFrames() - start, frames) <= 2, "Reduced motion must not start an animation loop");
  console.log("PASS reduced motion");
  await reduced.close();

  // 3. Mobile/touch and tablet widths.
  for (const [width, height, name] of [[390, 844, "home-mobile"], [320, 740, "home-mobile-320"], [820, 1180, "home-tablet"]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: true, reducedMotion: "no-preference" });
    const mobile = await context.newPage();
    watch(mobile, name);
    await mobile.goto(base + "/", { waitUntil: "networkidle" });
    await mobile.locator(".hero-figure [data-interactive]").waitFor({ timeout: 60000 });
    await mobile.waitForTimeout(2000);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} must not overflow`);
    const title = await mobile.locator("h1 > span").first().boundingBox();
    assert.ok(title.height < 80 * (width / 390) + 40, `${name}: first headline line must not wrap`);
    const stage = await mobile.locator(".hero-figure .fp-stage").boundingBox();
    const restingMobile = await ridgePaths(mobile);
    await mobile.touchscreen.tap(stage.x + stage.width * 0.55, stage.y + stage.height * 0.62);
    await mobile.waitForTimeout(200);
    assert.match(await readout(mobile), /day \d{2}/, `${name}: a tap highlights the nearest date`);
    assert.deepEqual(await ridgePaths(mobile), restingMobile, `${name}: touch never deforms geometry`);
    await mobile.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    await context.close();
  }
  console.log("PASS mobile 390/320, tablet 820 and touch highlighting");

  // 4. Signed-in owner: explicit, private, client-only.
  const ownerContext = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: "no-preference" });
  const owner = await ownerContext.newPage();
  watch(owner, "owner");
  const requested = [];
  let status = 200;
  await owner.route("**/api/v2/sync/datasets**", async request => {
    requested.push(new URL(request.request().url()));
    await request.fulfill(status === 200 ? { json: ownerPayload(), headers: { "cache-control": "no-store" } } : { status, json: { error: "insufficient_scope" } });
  });
  await owner.goto(base + "/phase9d-browser-fixture", { waitUntil: "networkidle" });
  await owner.locator(".hero-figure [data-interactive]").waitFor({ timeout: 60000 });
  assert.equal(requested.length, 0, "Owner data must not load without an explicit request");
  assert.match(await owner.locator("h1").innerText(), /Your development/);
  await owner.getByRole("button", { name: "Show my last 30 days" }).click();
  await owner.getByText("Only you can see this view.").waitFor();
  assert.equal(requested.length, 1);
  assert.equal(`${requested[0].pathname}${requested[0].search}`, ownerUrl);
  assert.equal(await owner.locator(".hero-figure [data-fingerprint]").getAttribute("data-ridges"), "30");
  assert.equal(await owner.locator('.hero-figure [data-status="missing"]').count(), 4);
  assert.equal(await owner.locator('.hero-figure [data-status="unavailable"]').count(), 2);
  assert.match(await readout(owner), /(Aug|Sep) \d+/);
  await owner.evaluate(() => window.scrollTo(0, 0));
  await owner.waitForTimeout(1600);
  await owner.screenshot({ path: `${output}/home-authenticated-owner.png` });
  await owner.getByRole("button", { name: "Show example data" }).click();
  await owner.getByText("not your activity").waitFor();
  status = 403;
  await owner.getByRole("button", { name: "Show my last 30 days" }).click();
  await owner.getByRole("status").filter({ hasText: "has not approved richer private aggregates" }).waitFor();
  assert.match(await owner.locator(".hero-figure .fp-source").innerText(), /not your activity/);
  console.log("PASS owner fingerprint: explicit load, exact endpoint, statuses, private labelling and error fallback");
  await ownerContext.close();

  // 5. Profile shell rails and example profile at desktop/mobile.
  const profileContext = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: "reduce" });
  const profile = await profileContext.newPage();
  watch(profile, "example-profile");
  await profile.goto(base + "/example", { waitUntil: "networkidle" });
  const rails = await profile.evaluate(() => {
    const nav = document.querySelector(".nav-rails").getBoundingClientRect(), frame = document.querySelector(".profile-frame").getBoundingClientRect();
    return [Math.round(nav.left - frame.left), Math.round(nav.right - frame.right)];
  });
  assert.deepEqual(rails, [0, 0], "Navigation rails must align with the profile frame");
  await profile.screenshot({ path: `${output}/example-profile-desktop.png`, fullPage: true });
  await profile.setViewportSize({ width: 390, height: 844 });
  assert.equal(await profile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Example profile must not overflow");
  await profile.screenshot({ path: `${output}/example-profile-mobile.png`, fullPage: true });
  await profileContext.close();
  console.log("PASS profile rails alignment and example profile");

  assert.deepEqual(errors, [], errors.join("\n"));
  console.log(`PASS Phase 9D browser checks. Screenshots: ${output}`);
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* Already stopped. */ } }
  if (ownsRoute) {
    await rm(route, { recursive: true, force: true });
    await rm(new URL(".next/dev/types/app/phase9d-browser-fixture/", root), { recursive: true, force: true });
    await rm(new URL(".next/dev/types/validator.ts", root), { force: true });
  }
}
