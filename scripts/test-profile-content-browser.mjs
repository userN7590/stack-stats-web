// Local synthetic fixtures only. Requires Playwright and installed Chrome.
// Optional STACK_STATS_PLAYWRIGHT_PATH points to a temporary Playwright package.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.STACK_STATS_PLAYWRIGHT_PATH ? pathToFileURL(process.env.STACK_STATS_PLAYWRIGHT_PATH).href : "playwright");
const port = 3119;
const root = new URL("../", import.meta.url);
const route = new URL("src/app/phase9c-browser-fixture/", root);
const output = process.env.STACK_STATS_SCREENSHOTS || "/private/tmp/stack-stats-phase9c";
let server, browser, page, ownsRoute = false;
try {
  await mkdir(route); // Refuse to replace an existing user route.
  ownsRoute = true;
  await writeFile(new URL("page.tsx", route), 'import { ProfileContentPreview } from "../../../tests/fixtures/profile-content-preview";\nexport default function Page() { return <ProfileContentPreview />; }\n');
  await mkdir(output, { recursive: true });
  server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://phase9c.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-test-key" },
  });
  let log = ""; server.stdout.on("data", data => { log += data; }); server.stderr.on("data", data => { log += data; });
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error(log);
    try { const response = await fetch(`http://127.0.0.1:${port}/phase9c-browser-fixture`); if (response.ok) { ready = true; break; } } catch { /* Starting. */ }
    await setTimeout(500);
  }
  if (!ready) throw new Error(`Local fixture did not start: ${log}`);
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, reducedMotion: "reduce" });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); console.error("Browser error:", error.message); });
  let savedLayout, savedPrivacy;
  await page.route("https://phase9c.invalid/**", async route => {
    if (route.request().url().includes("update_profile_layout")) savedLayout = route.request().postDataJSON().p_layout;
    await route.fulfill({ status: 200, contentType: "application/json", body: "null", headers: { "access-control-allow-origin": "*" } });
  });
  await page.route("**/api/v2/sync/privacy", async route => { savedPrivacy = route.request().postDataJSON(); await route.fulfill({ json: { ok: true } }); });
  await page.goto(`http://127.0.0.1:${port}/phase9c-browser-fixture`);
  await page.getByRole("button", { name: "Test public", exact: true }).click();
  assert.equal(await page.getByText("Customize profile", { exact: true }).count(), 0);
  assert.equal(await page.locator("[data-profile-section]").count(), 9);
  const clippedLabels = await page.locator('svg[viewBox="0 0 510 265"] text').evaluateAll(nodes => nodes.filter(node => { const box = node.getBBox(); return box.x < 0 || box.x + box.width > 510; }).map(node => node.textContent));
  assert.deepEqual(clippedLabels, [], "Chart-axis labels must remain inside their viewBox");
  await page.screenshot({ path: `${output}/profile-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Mobile profile must not overflow");
  const spans = await page.locator("[data-profile-section]").evaluateAll(sections => sections.map(section => Math.round(section.getBoundingClientRect().width)));
  assert.equal(new Set(spans).size, 1, "Mobile sections must stack at a common width");
  await page.screenshot({ path: `${output}/profile-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.getByRole("button", { name: "Test owner", exact: true }).click();
  const order = () => page.locator("[data-profile-section]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-profile-section")));
  console.log("PASS desktop/mobile public layout");
  const beforeDrag = await order();
  const handle = page.getByRole("button", { name: "Drag Coding time section to reorder", exact: true });
  await handle.scrollIntoViewIfNeeded();
  const handleBox = await handle.boundingBox();
  const targetBox = await page.locator('[data-profile-section="sec_sessions"]').boundingBox();
  await page.mouse.move(handleBox.x + 20, handleBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(first => document.querySelector('[data-profile-section]')?.getAttribute('data-profile-section') !== first, beforeDrag[0]);
  await page.locator('[data-dragging="true"]').waitFor({ state: "detached" });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const pointerOrder = await order();
  await page.getByRole("button", { name: "Drag Coding time section to reorder", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.locator('[data-profile-section="sec_time"][data-dragging="true"]').waitFor();
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelector('[role="status"][id^="DndLiveRegion"]')?.textContent?.includes("position 2"));
  await page.keyboard.press("Space");
  await page.waitForFunction(previous => JSON.stringify(Array.from(document.querySelectorAll('[data-profile-section]'), node => node.getAttribute('data-profile-section'))) !== previous, JSON.stringify(pointerOrder));
  console.log("PASS pointer and keyboard drops");
  await page.getByRole("button", { name: "Language activity section options", exact: true }).click();
  await page.getByRole("button", { name: "Edit section", exact: true }).click();
  await page.getByLabel("Measure", { exact: true }).selectOption("editCount");
  await page.getByLabel("Presentation", { exact: true }).selectOption("donut");
  await page.getByText("Appearance", { exact: true }).last().click();
  await page.getByLabel("Color palette", { exact: true }).selectOption("mono");
  await page.getByRole("button", { name: "Done editing section" }).click();
  await page.getByRole("button", { name: "Stat grid section options", exact: true }).click();
  await page.getByRole("button", { name: "Edit section", exact: true }).click();
  await page.getByLabel("Grid layout", { exact: true }).selectOption("2x3");
  await page.getByLabel("Cell 6", { exact: true }).selectOption("activity.active_ms");
  await page.getByRole("button", { name: "Done editing section" }).click();
  await page.getByRole("button", { name: "Add section", exact: true }).click();
  await page.getByRole("button", { name: "Add Single stat", exact: true }).click();
  assert.equal(await page.getByLabel("Stat", { exact: true }).evaluate(node => node === document.activeElement), true);
  await page.getByLabel("Stat", { exact: true }).selectOption("activity.edits");
  await page.getByLabel("Presentation", { exact: true }).selectOption("context");
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Content changes section options", exact: true }).evaluate(node => node === document.activeElement), true);
  await page.getByRole("button", { name: "Content changes section options", exact: true }).click();
  await page.getByRole("button", { name: "Set half width", exact: true }).click();
  const newSection = page.locator('[data-profile-section]').last();
  assert.match(await newSection.getAttribute("class"), /profile-span-half/);
  await page.getByRole("button", { name: "Shift Content changes section up", exact: true }).click();
  await page.getByRole("button", { name: "Drag Content changes section to reorder", exact: true }).focus();
  await page.keyboard.press("Space"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Content changes section options", exact: true }).click();
  await page.getByRole("button", { name: "Hide Content changes section", exact: true }).click();
  await page.getByRole("button", { name: "Add section", exact: true }).click();
  await page.getByRole("button", { name: "Add Content changes", exact: true }).click();
  await page.getByRole("button", { name: "Content changes section options", exact: true }).click();
  await page.getByRole("button", { name: "Remove section", exact: true }).click();
  await page.getByRole("button", { name: "Undo removal", exact: true }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: /section options$/ }).count(), 0);
  await page.getByRole("button", { name: "Edit sections", exact: true }).click();
  await page.screenshot({ path: `${output}/profile-editor.png`, fullPage: true });
  // Save failure retains draft, then retry succeeds through the real client RPC.
  await page.route("https://phase9c.invalid/rest/v1/rpc/update_profile_layout", async route => {
    savedLayout = route.request().postDataJSON()?.p_layout;
    await route.fulfill({ status: 500, json: { message: "Synthetic failure" }, headers: { "access-control-allow-origin": "*" } });
  });
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Your changes are still here" }).waitFor();
  assert.equal(savedLayout.version, 3); assert.equal(savedLayout.modules.length, 10);
  assert.equal(savedLayout.modules.at(-1).metric, "activity.edits");
  assert.equal(savedLayout.modules.find(section => section.id === "sec_grid").columns, 2);
  assert.equal(savedLayout.modules.find(section => section.id === "sec_grid").cells[5], "activity.active_ms");
  assert.deepEqual(savedLayout.modules.find(section => section.id === "sec_languages").config, { dataset: "languagesByDay", metric: "languages.activity", renderer: "donut", measure: "editCount", appearance: { palette: "mono" } });
  await page.unroute("https://phase9c.invalid/rest/v1/rpc/update_profile_layout");
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await page.waitForURL("**/u/phase9c", { timeout: 15000 });
  await page.goto(`http://127.0.0.1:${port}/phase9c-browser-fixture`);
  await page.getByRole("button", { name: "Test privacy", exact: true }).click();
  const schedule = page.getByRole("checkbox", { name: /^Daily activity/ });
  assert.equal(await schedule.isDisabled(), true);
  await page.getByRole("checkbox", { name: /^Allow publication of activity dates/ }).check();
  await schedule.check();
  await page.getByRole("button", { name: "Save publication preferences" }).click();
  await page.getByRole("status").waitFor();
  assert.equal(savedPrivacy.publishSchedule, true); assert(savedPrivacy.metricIds.includes("schedule.daily"));
  await page.getByRole("checkbox", { name: /^Allow publication of activity dates/ }).uncheck();
  await page.getByRole("button", { name: "Save publication preferences" }).click();
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("saved"));
  assert.equal(savedPrivacy.publishSchedule, false); assert(!savedPrivacy.metricIds.includes("schedule.daily"));
  await page.getByRole("button", { name: "Test empty", exact: true }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  assert(await page.getByText("Not published", { exact: true }).count() > 0);
  await page.getByRole("button", { name: "Test low", exact: true }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  assert.equal(await page.locator('[data-profile-section="sec_time"]').getByText("0s", { exact: true }).count(), 1);
  assert.equal(await page.locator('[data-profile-section="sec_days"]').getByText("Not published", { exact: true }).count(), 1);
  assert.equal(await page.locator('[data-profile-section="sec_sessions"]').getByText("Unavailable", { exact: true }).count(), 1);
  assert.equal(await page.locator('[data-profile-section="sec_daily"] circle').count(), 1);
  assert.match(await page.locator('[data-profile-section="sec_hours"]').innerText(), /Unavailable/);
  assert.match(await page.locator('[data-profile-section="sec_histogram"]').innerText(), /All observed values are zero/);
  assert.match(await page.locator('[data-profile-section="sec_languages"]').innerText(), /No measured language activity/);
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Narrow low-data profile must not overflow");
  await page.screenshot({ path: `${output}/profile-low-data-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.getByRole("button", { name: "Test legacy", exact: true }).click();
  assert.equal(await page.locator('[data-profile-section="stats"]').count(), 1);
  await page.getByRole("button", { name: "Add section", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Add section", exact: true }).evaluate(node => node === document.activeElement), true);
  await page.getByRole("button", { name: "Test owner", exact: true }).click();
  await page.getByRole("button", { name: "Reset layout", exact: true }).click();
  assert.equal(await page.locator('[data-profile-section="sec_default-stats"]').count(), 1);
  assert.equal(await page.getByRole("button", { name: "Save layout", exact: true }).isDisabled(), false);
  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`http://127.0.0.1:${port}/phase9c-browser-fixture`);
  const touchHandle = touchPage.getByRole("button", { name: "Drag Coding time section to reorder", exact: true });
  await touchHandle.scrollIntoViewIfNeeded();
  const touchBox = await touchHandle.boundingBox();
  const touchTarget = await touchPage.locator('[data-profile-section="sec_days"]').boundingBox();
  const cdp = await touchContext.newCDPSession(touchPage);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchBox.x + 20, y: touchBox.y + 20 }] });
  for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: touchBox.x + 20, y: touchBox.y + 20 + (Math.min(750, touchTarget.y + touchTarget.height / 2) - touchBox.y - 20) * step / 8 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await touchPage.waitForFunction(() => document.querySelector('[data-profile-section]')?.getAttribute('data-profile-section') !== 'sec_time');
  console.log("PASS low-data, zero, unavailable, unpublished and touch drop checks");
  await touchContext.close();
  // Ignore only expected navigation to the deliberately unconfigured synthetic account.
  assert.equal(errors.filter(error => !error.includes("fetch failed") && !error.includes("Server Components render")).length, 0, errors.join("\n"));
  console.log(`PASS browser profile editing, publication, keyboard, preview, mobile, save/retry and legacy fixtures. Screenshots: ${output}`);
} catch (error) {
  console.error(error);
  if (page) { console.error((await page.locator("body").innerText()).slice(-10000)); await page.screenshot({ path: `${output}/failure.png`, fullPage: true }); }
  throw error;
} finally {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* Already stopped. */ } }
  if (ownsRoute) {
    await rm(route, { recursive: true, force: true });
    // The dev type validator imports the ephemeral page. Remove generated cache
    // entries so a subsequent standalone tsc does not reference a deleted route.
    await rm(new URL(".next/dev/types/app/phase9c-browser-fixture/", root), { recursive: true, force: true });
    await rm(new URL(".next/dev/types/validator.ts", root), { force: true });
  }
}
