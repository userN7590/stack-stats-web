// Phase 9D/9D.1 homepage, profile-card and fingerprint browser checks with
// synthetic data only. Requires Playwright and installed Chrome;
// STACK_STATS_PLAYWRIGHT_PATH may point to a temporary Playwright package.
// Screenshots go to STACK_STATS_SCREENSHOTS.
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
const fixture = `${base}/phase9d-browser-fixture`;
const output = process.env.STACK_STATS_SCREENSHOTS || "/private/tmp/stack-stats-phase9d1";
const ownerUrl = "/api/v2/sync/datasets?dataset=hourlyUtc&period=30";
const FIG = ".activity-figure";

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

const ridgePaths = (page) => page.locator(`${FIG} [data-ridge]`).evaluateAll(nodes => nodes.map(node => node.getAttribute("d")));
const readout = (page) => page.locator(`${FIG} .fp-readout`).innerText();
// The stage bleeds past the frame toward the viewport edge; clip to the viewport width.
const figureClip = async (page) => { const box = await page.locator(FIG).boundingBox(); return { x: 0, y: box.y, width: page.viewportSize().width, height: box.height }; };
const activeRidge = (page) => page.locator(`${FIG} .fp-stage`).getAttribute("data-active-ridge");
const settle = async (page) => {
  // Interval polling: rAF polling would itself keep frames running.
  try { await page.waitForFunction(() => window.__phase9dIdle?.(), undefined, { timeout: 8000, polling: 200 }); }
  catch (error) { console.error("Animation frame sources:", await page.evaluate(() => window.__phase9dSources())); throw error; }
};
const framesDuring = async (page, ms) => {
  const start = await page.evaluate(() => window.__phase9dFrames());
  await page.waitForTimeout(ms);
  return page.evaluate(value => window.__phase9dFrames() - value, start);
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
// Screen point inside the frontmost ridge's tallest peak (its visible surface).
const frontPeakPoint = (page) => page.evaluate((selector) => {
  const paths = [...document.querySelectorAll(`${selector} [data-ridge]`)];
  const path = paths.at(-1), matrix = path.getScreenCTM();
  let top = { x: 0, y: Infinity };
  for (let length = 0; length < path.getTotalLength(); length += 2) { const point = path.getPointAtLength(length); if (point.y < top.y) top = point; }
  const screen = new DOMPoint(top.x, top.y + 24).matrixTransform(matrix);
  return { x: screen.x, y: screen.y, ridge: paths.length - 1 };
}, FIG);

let server, browser, ownsRoute = false;
const errors = [];
const watch = (page, label) => {
  page.on("pageerror", error => errors.push(`${label}: ${error.message}`));
  page.on("console", message => { if (message.type() === "error" && /hydrat|did not match|server rendered|Warning:/i.test(message.text())) errors.push(`${label}: ${message.text()}`); });
};
try {
  await mkdir(route); // Refuse to replace an existing user route.
  ownsRoute = true;
  await writeFile(new URL("page.tsx", route), 'import { HomePreview } from "../../../tests/fixtures/home-preview";\nexport const dynamic = "force-dynamic";\nexport default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <HomePreview searchParams={searchParams} />; }\n');
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

  // 1. Desktop: static composition, cards, fingerprint interaction and idle.
  const desktop = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: "no-preference" });
  await desktop.addInitScript(rafProbe);
  const page = await desktop.newPage();
  watch(page, "desktop");
  await page.goto(fixture, { waitUntil: "networkidle" });
  await page.locator(`${FIG} [data-interactive]`).waitFor({ timeout: 60000 });
  await page.waitForTimeout(2200); // One-shot entrance motion finishes here.
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Desktop homepage must not overflow");
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("h2").count(), 2);
  assert.equal(await page.locator("[data-sketch]").count(), 2, "Hero keeps one annotation (a pair of braces)");
  const cards = page.locator("[data-profile-card]");
  assert.equal(await cards.count(), 5);
  assert.match(await cards.first().getAttribute("class"), /pcard-front/);
  assert.equal(await cards.first().locator("a").getAttribute("href"), "/u/fil");
  assert.equal(await page.locator("[data-profile-card] article").count(), 4, "Example cards are not links");
  const coversHeadline = (view) => view.evaluate(() => {
    // Sample the rendered headline line boxes: a rotated card may sit beside
    // line two, but must never paint over any part of either line.
    const hits = [];
    for (const span of document.querySelectorAll("h1 > span")) {
      const range = document.createRange(); range.selectNodeContents(span);
      const rect = range.getBoundingClientRect();
      for (let x = rect.left + 2; x < rect.right; x += 6) for (let y = rect.top + 2; y < rect.bottom; y += 6) {
        if (document.elementFromPoint(x, y)?.closest(".pcard")) hits.push([Math.round(x), Math.round(y)]);
      }
    }
    return hits;
  });
  assert.deepEqual(await coversHeadline(page), [], "No card may cover the headline");
  assert.ok(await framesDuring(page, 1500) <= 2, "No animation loop may run while idle");
  const metrics = await page.evaluate((selector) => ({ nodes: document.querySelectorAll("*").length, fingerprintNodes: document.querySelector(`${selector} .fp-svg`).querySelectorAll("*").length }), FIG);
  await page.screenshot({ path: `${output}/home-desktop.png`, fullPage: true });
  await page.screenshot({ path: `${output}/hero-closeup.png` });
  const heroCards = await page.locator(".hero-cards").boundingBox();
  const cardsClip = { x: heroCards.x - 40, y: heroCards.y - 30, width: Math.min(1360 - heroCards.x + 40, heroCards.width + 80), height: heroCards.height + 80 };
  await page.screenshot({ path: `${output}/profile-cards.png`, clip: cardsClip });

  // Card hover: lifts forward, eases rotation, parts neighbours; purely CSS.
  const weekends = page.locator('[data-profile-card="weekends"]');
  const weekendBox = await weekends.boundingBox();
  await page.mouse.move(weekendBox.x + 24, weekendBox.y + weekendBox.height / 2);
  await page.waitForTimeout(500);
  assert.equal(await weekends.evaluate(node => getComputedStyle(node).zIndex), "10");
  assert.notEqual(await page.locator('[data-profile-card="earlybird"]').evaluate(node => getComputedStyle(node).translate), "none");
  await page.screenshot({ path: `${output}/profile-cards-hover.png`, clip: cardsClip });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(500);
  console.log("PASS hero composition, card stack order/labels/links, headline clearance and card hover");

  // Fingerprint: exact resting geometry, local accent, no cursor line.
  const stage = page.locator(`${FIG} .fp-stage`);
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const resting = await ridgePaths(page);
  assert.match(await readout(page), /^30 days of coding · example data$/);
  await page.screenshot({ path: `${output}/waterfall-idle.png`, clip: await figureClip(page) });
  const box = await stage.boundingBox();
  const beforeSweep = await page.evaluate(() => window.__phase9dLongTasks);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.55);
  for (let step = 0; step <= 30; step++) await page.mouse.move(box.x + box.width * (0.3 + step * 0.012), box.y + box.height * 0.55);
  await page.waitForTimeout(300);
  assert.ok((await ridgePaths(page)).some((path, index) => path !== resting[index]), "Pointer proximity must deform nearby ridges");
  assert.match(await readout(page), /day \d{2} — \d{2}:00–\d{2}:00 UTC — /);
  const structure = await page.evaluate((selector) => {
    const svg = document.querySelector(`${selector} .fp-svg`), stageNode = document.querySelector(`${selector} .fp-stage`);
    const live = [...svg.querySelectorAll(".fp-live")];
    return {
      cursorNodes: svg.querySelectorAll("[data-cursor], .fp-cursor").length,
      topLevelLive: [...svg.children].filter(node => node.classList.contains("fp-live")).length,
      liveGroups: [...new Set(live.map(node => node.parentElement.getAttribute("data-group")))],
      active: stageNode.getAttribute("data-active-ridge"),
      engaged: svg.hasAttribute("data-engaged"),
      marker: svg.querySelector(".fp-marker-dot")?.getAttribute("d"),
      activeClass: svg.querySelector(`[data-ridge="${stageNode.getAttribute("data-active-ridge")}"]`)?.getAttribute("class"),
    };
  }, FIG);
  assert.equal(structure.cursorNodes, 0, "No stack-wide cursor line exists");
  assert.equal(structure.topLevelLive, 0, "Selection marks are never painted above the whole stack");
  assert.deepEqual(structure.liveGroups, [structure.active], "Selection marks live inside the active ridge's own group (occluded by ridges in front)");
  assert.match(structure.marker, /^M[\d.]+,[\d.]+h0$/, "The marker is a point, not a line");
  assert.equal(structure.engaged, true);
  assert.match(structure.activeClass, /is-active/);
  await page.screenshot({ path: `${output}/waterfall-active.png`, clip: await figureClip(page) });

  // Stability: small jitter never flips the selection.
  const cx = box.x + box.width * 0.55, cy = box.y + box.height * 0.6;
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(120);
  let previous = await activeRidge(page), jitterChanges = 0;
  for (let step = 0; step < 50; step++) {
    await page.mouse.move(cx + ((step * 3) % 7) - 3, cy + ((step * 5) % 7) - 3);
    await page.waitForTimeout(16);
    const current = await activeRidge(page);
    if (current !== previous) jitterChanges++;
    previous = current;
  }
  assert.ok(jitterChanges <= 1, `Jitter caused ${jitterChanges} ridge switches`);
  // A slow vertical sweep across flat baselines advances ridge by ridge, never oscillating.
  const sequence = [];
  const flatX = box.x + box.width * 0.22;
  for (let step = 0; step <= 60; step++) {
    await page.mouse.move(flatX, box.y + box.height * 0.62 + step * 1.5);
    await page.waitForTimeout(16);
    const current = await activeRidge(page);
    if (current && current !== sequence.at(-1)) sequence.push(current);
  }
  const oscillations = sequence.filter((ridge, index) => index > 1 && ridge === sequence[index - 2]).length;
  assert.equal(oscillations, 0, `Selection oscillated: ${sequence.join(",")}`);
  assert.ok(sequence.map(Number).every((ridge, index, list) => index === 0 || ridge > list[index - 1]), `Downward sweep must move forward in depth: ${sequence.join(",")}`);
  // The visible surface wins: inside the front ridge's peak selects the front ridge.
  await page.mouse.move(5, 5);
  await settle(page);
  const peak = await frontPeakPoint(page);
  await page.mouse.move(peak.x, peak.y);
  await page.waitForTimeout(120);
  assert.equal(await activeRidge(page), String(peak.ridge), "Pointer over the front ridge's peak selects that ridge");
  // Held still: motion comes to rest and the loop stops.
  await page.waitForTimeout(1600);
  assert.ok(await framesDuring(page, 600) <= 2, "A still pointer must not keep the loop running");
  // Leaving: selection clears, geometry returns exactly, loop stops.
  await page.mouse.move(5, 5);
  await settle(page);
  assert.deepEqual(await ridgePaths(page), resting, "Settling must restore the exact server-rendered geometry");
  assert.match(await readout(page), /^30 days of coding · example data$/);
  assert.equal(await page.locator(`${FIG} .fp-svg[data-engaged]`).count(), 0);
  assert.ok(await framesDuring(page, 1000) <= 2, "The loop must stop after settling");
  const longTasks = await page.evaluate(start => window.__phase9dLongTasks - start, beforeSweep);
  console.log(`PASS fingerprint: local accent, no cursor line, jitter ${jitterChanges} switches, sweep ${sequence.join("→")}, visible-surface pick, held/settled idle (DOM ${metrics.nodes}, fingerprint SVG ${metrics.fingerprintNodes}, long tasks ${longTasks})`);

  // Keyboard exploration and off-screen pause.
  await stage.focus();
  await page.keyboard.press("ArrowUp");
  assert.match(await readout(page), /day \d{2}/);
  const keyed = await activeRidge(page);
  await page.keyboard.press("ArrowRight");
  assert.equal(await activeRidge(page), keyed);
  await page.keyboard.press("ArrowDown");
  assert.equal(await activeRidge(page), String(Number(keyed) + 1));
  await page.keyboard.press("Escape");
  assert.match(await readout(page), /^30 days of coding/);
  await stage.blur();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  assert.deepEqual(await ridgePaths(page), resting, "Off-screen fingerprint must stop and restore");
  assert.equal(await activeRidge(page), "");
  console.log("PASS keyboard and off-screen pause");
  await desktop.close();

  // 2. Reduced motion: static geometry, no loop, same information.
  const reduced = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: "reduce" });
  await reduced.addInitScript(rafProbe);
  const still = await reduced.newPage();
  watch(still, "reduced");
  await still.goto(fixture, { waitUntil: "networkidle" });
  await still.locator(`${FIG} [data-interactive]`).waitFor({ timeout: 60000 });
  assert.equal(await still.locator(`${FIG} .fp-ridge-group`).first().evaluate(node => getComputedStyle(node).animationName), "none");
  assert.equal(await still.locator("[data-sketch] path").first().evaluate(node => getComputedStyle(node).strokeDasharray), "none");
  await still.screenshot({ path: `${output}/reduced-motion.png` });
  const stillStage = still.locator(`${FIG} .fp-stage`);
  await stillStage.scrollIntoViewIfNeeded();
  const stillResting = await ridgePaths(still);
  const stillBox = await stillStage.boundingBox();
  const frames = await still.evaluate(() => window.__phase9dFrames());
  for (let step = 0; step < 12; step++) await still.mouse.move(stillBox.x + stillBox.width * (0.4 + step * 0.01), stillBox.y + stillBox.height * 0.55);
  await still.waitForTimeout(400);
  assert.deepEqual(await ridgePaths(still), stillResting, "Reduced motion must not deform ridges");
  assert.match(await readout(still), /UTC — /, "Reduced motion keeps the exact readout");
  assert.ok(await still.evaluate(start => window.__phase9dFrames() - start, frames) <= 14, "Reduced motion runs at most one frame per pointer event, never a loop");
  assert.ok(await framesDuring(still, 800) <= 1);
  await still.screenshot({ path: `${output}/waterfall-reduced-motion.png`, clip: await figureClip(still) });
  console.log("PASS reduced motion");
  await reduced.close();

  // 3. Phone, narrow phone, tablet and small laptop.
  for (const [width, height, name, touch] of [[390, 844, "home-mobile", true], [320, 740, "home-mobile-320", true], [820, 1180, "home-tablet", true], [1024, 768, "home-1024", false]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: touch && width < 700, hasTouch: touch, reducedMotion: "no-preference" });
    const view = await context.newPage();
    watch(view, name);
    await view.goto(fixture, { waitUntil: "networkidle" });
    await view.locator(`${FIG} [data-interactive]`).waitFor({ timeout: 60000 });
    await view.waitForTimeout(2000);
    assert.equal(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} must not overflow`);
    // Block height of the first headline span, in line heights.
    const lines = await view.locator("h1 > span").first().evaluate(span => span.getBoundingClientRect().height / parseFloat(getComputedStyle(span).lineHeight));
    assert.ok(lines < 1.5, `${name}: “Your development.” stays on one line (${lines.toFixed(2)} lines)`);
    if (width >= 900) assert.deepEqual(await coversHeadline(view), [], `${name}: no card may cover the headline`);
    if (width < 900) {
      const strip = await view.locator(".pcards").evaluate(node => ({ scrolls: node.scrollWidth > node.clientWidth, overflow: getComputedStyle(node).overflowX, snap: getComputedStyle(node).scrollSnapType }));
      assert.equal(strip.scrolls, true, `${name}: cards form a horizontal strip`);
      assert.match(strip.snap, /x mandatory/);
      assert.equal(await view.locator("[data-profile-card]").first().evaluate(node => node.getBoundingClientRect().left < innerWidth / 2), true, `${name}: live card comes first`);
    }
    if (touch) {
      const fingerprintStage = view.locator(`${FIG} .fp-stage`);
      await fingerprintStage.scrollIntoViewIfNeeded();
      const restingView = await ridgePaths(view);
      const stageBox = await fingerprintStage.boundingBox();
      await view.touchscreen.tap(stageBox.x + stageBox.width * 0.55, stageBox.y + stageBox.height * 0.62);
      await view.waitForTimeout(200);
      assert.match(await readout(view), /day \d{2}/, `${name}: a tap highlights the nearest date`);
      assert.deepEqual(await ridgePaths(view), restingView, `${name}: touch never deforms geometry`);
      await view.evaluate(() => window.scrollTo(0, 0));
    }
    await view.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    await context.close();
  }
  console.log("PASS 390/320 phones, 820 tablet, 1024 laptop: overflow, headline, card strip and touch");

  // 4. Signed-in owner: explicit, private, client-only; unobtrusive control.
  const ownerContext = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: "no-preference" });
  const owner = await ownerContext.newPage();
  watch(owner, "owner");
  const requested = [];
  let status = 200;
  await owner.route("**/api/v2/sync/datasets**", async request => {
    requested.push(new URL(request.request().url()));
    await request.fulfill(status === 200 ? { json: ownerPayload(), headers: { "cache-control": "no-store" } } : { status, json: { error: "insufficient_scope" } });
  });
  await owner.goto(`${fixture}?auth=1`, { waitUntil: "networkidle" });
  await owner.locator(`${FIG} [data-interactive]`).waitFor({ timeout: 60000 });
  assert.equal(requested.length, 0, "Owner data must not load without an explicit request");
  assert.equal(await owner.getByRole("link", { name: /View \/u\/phase9d/ }).count(), 2, "Signed-in CTA points to the owner's own profile");
  const exampleStats = await owner.locator(".activity-stats dd").allInnerTexts();
  await owner.getByRole("button", { name: "Use my activity" }).click();
  await owner.getByText("Your last 30 days · visible only to you").waitFor();
  // Statistics describe the same data as the fingerprint, never the example.
  const ownStats = await owner.locator(".activity-stats dd").allInnerTexts();
  assert.notDeepEqual(ownStats, exampleStats, "Owner statistics must follow the owner's fingerprint");
  assert.equal(ownStats[1], "24/30");
  assert.equal(requested.length, 1);
  assert.equal(`${requested[0].pathname}${requested[0].search}`, ownerUrl);
  assert.equal(await owner.locator(`${FIG} [data-fingerprint]`).getAttribute("data-ridges"), "30");
  assert.equal(await owner.locator(`${FIG} [data-status="missing"]`).count(), 4);
  assert.equal(await owner.locator(`${FIG} [data-status="unavailable"]`).count(), 2);
  await owner.waitForTimeout(1600);
  await owner.locator(".activity-frame").screenshot({ path: `${output}/home-authenticated-owner.png` });
  await owner.getByRole("button", { name: "Show example" }).click();
  await owner.getByText("30 days of coding · example data").waitFor();
  status = 403;
  await owner.getByRole("button", { name: "Use my activity" }).click();
  await owner.getByRole("status").filter({ hasText: "has not approved richer private aggregates" }).waitFor();
  assert.match(await readout(owner), /example data/);
  console.log("PASS owner fingerprint: click-only load, exact endpoint, private labelling and error fallback");
  await ownerContext.close();

  // 5. Real homepage route: labelled persona fronts the stack when the live profile is unreachable.
  const realContext = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const real = await realContext.newPage();
  watch(real, "home-route");
  await real.goto(base + "/", { waitUntil: "networkidle" });
  const front = real.locator(".pcard-front");
  assert.match(await front.innerText(), /Alex Rivera/);
  assert.match(await front.innerText(), /example/i);
  assert.equal(await front.locator("a").getAttribute("href"), "/example");
  await realContext.close();

  // 6. Profile shell rails and example profile (Phase 9D polish unchanged).
  const profileContext = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: "reduce" });
  const profile = await profileContext.newPage();
  watch(profile, "example-profile");
  await profile.goto(base + "/example", { waitUntil: "networkidle" });
  const rails = await profile.evaluate(() => {
    const nav = document.querySelector(".nav-rails").getBoundingClientRect(), frame = document.querySelector(".profile-frame").getBoundingClientRect();
    return [Math.round(nav.left - frame.left), Math.round(nav.right - frame.right)];
  });
  assert.deepEqual(rails, [0, 0], "Navigation rails must align with the profile frame");
  await profile.setViewportSize({ width: 390, height: 844 });
  assert.equal(await profile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Example profile must not overflow");
  await profileContext.close();
  console.log("PASS homepage fallback persona and profile rails");

  assert.deepEqual(errors, [], errors.join("\n"));
  console.log(`PASS Phase 9D.1 browser checks. Screenshots: ${output}`);
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
