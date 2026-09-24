/**
 * Show-night simulator.
 *
 *   npm run build && npm run simulate          full show night, on a stand-in
 *   npm run simulate -- --live                 read-only checks of the real site
 *   npm run simulate -- --live=https://…       read-only checks of another URL
 *
 * Full mode runs the production build against a fake GitHub content store
 * (the driver production uses) and drives four browsers through a whole
 * night: a guest's phone, the host's phone, Run Show, and the projector.
 * Nothing real is touched. Live mode only reads: pages, the projector's QR,
 * where it leads, and the form's state. It never submits or signs in.
 *
 * Writes a scorecard to the terminal and simulator-report/index.html with
 * screenshots. Exits 1 if anything failed.
 *
 * Needs Playwright and jsQR, which are not site dependencies:
 *   npm i --no-save playwright jsqr && npx playwright install chromium
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";
import { startFakeGithub } from "./fake-github.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const REPORT = path.join(ROOT, "simulator-report");
const liveArg = process.argv.find((arg) => arg === "--live" || arg.startsWith("--live="));
const LIVE = liveArg ? (liveArg.split("=")[1] || "https://pinsandneedlescomedy.com").replace(/\/+$/, "") : null;

let playwright;
let jsQR;
try {
  playwright = await import("playwright");
  jsQR = (await import("jsqr")).default;
} catch {
  console.error("The simulator needs Playwright and jsQR:\n  npm i --no-save playwright jsqr && npx playwright install chromium");
  process.exit(2);
}

// ── scorecard ────────────────────────────────────────────────────────────────
const results = [];
const shots = [];
let current = "";
function section(title) {
  current = title;
  console.log(`\n${title}`);
}
async function check(name, run) {
  const started = Date.now();
  try {
    const detail = await run();
    results.push({ section: current, name, ok: true, detail: detail ?? "" });
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ""}`);
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0] : String(error);
    results.push({ section: current, name, ok: false, detail });
    console.log(`  FAIL  ${name}  → ${detail}  [${Date.now() - started} ms]`);
    return false;
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
async function until(test, timeoutMs, message) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try {
      const value = await test();
      if (value) return value;
    } catch {
      // keep trying until the deadline
    }
    if (Date.now() > end) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
async function shoot(page, name, caption) {
  const file = `${String(shots.length + 1).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: path.join(REPORT, file) }).catch(() => {});
  shots.push({ file, caption });
}

// ── helpers ──────────────────────────────────────────────────────────────────
/** Reads the QR the site draws (an SVG of stroked modules) back into its URL. */
function decodeQrSvg(svg) {
  const size = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1]);
  const d = svg.match(/stroke="#000000" d="([^"]+)"/)?.[1];
  if (!size || !d) throw new Error("QR image is not in the expected format");
  const grid = Array.from({ length: size }, () => new Array(size).fill(0));
  let x = 0;
  let y = 0;
  for (const m of d.matchAll(/([Mmh])([\d.]+)(?:\s([\d.]+))?/g)) {
    if (m[1] === "M") { x = Number(m[2]); y = Math.floor(Number(m[3])); }
    else if (m[1] === "m") { x += Number(m[2]); y += Math.floor(Number(m[3] || 0)); }
    else { for (let i = 0; i < Number(m[2]); i++) grid[y][x + i] = 1; x += Number(m[2]); }
  }
  const scale = 8;
  const width = size * scale;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let py = 0; py < width; py++) {
    for (let px = 0; px < width; px++) {
      const value = grid[Math.floor(py / scale)][Math.floor(px / scale)] ? 0 : 255;
      const o = (py * width + px) * 4;
      data[o] = data[o + 1] = data[o + 2] = value;
      data[o + 3] = 255;
    }
  }
  const decoded = jsQR(data, width, width);
  if (!decoded) throw new Error("QR did not decode");
  return decoded.data;
}

async function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function launchBrowser() {
  const proxy = LIVE && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  try {
    return await playwright.chromium.launch({ proxy });
  } catch (error) {
    // Some machines ship their own Chromium outside Playwright's cache.
    for (const candidate of [process.env.SIM_CHROMIUM, "/opt/pw-browsers/chromium"]) {
      if (candidate && existsSync(candidate)) return playwright.chromium.launch({ executablePath: candidate, proxy });
    }
    throw error;
  }
}

function watchErrors(page, bucket, label) {
  page.on("pageerror", (error) => bucket.push(`${label}: ${error.message}`));
  return page;
}

const bodyText = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const projectorSize = { viewport: { width: 1920, height: 1080 } };

// ── full simulation ─────────────────────────────────────────────────────────
async function simulate() {
  if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    console.error("No production build yet. Run `npm run build` first.");
    process.exit(2);
  }
  const fake = await startFakeGithub();
  // Put the real window days away, so the night starts "before doors"
  // whatever time the simulator is run. 8 PM is simulated later by opening it.
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const nyDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(new Date());
  const weekday = days[(days.indexOf(nyDay) + 3) % 7];
  fake.write("content/content.json", { weekly: { enabled: true, weekday, alwaysOpen: false }, shows: [] });

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const password = "simulator-password";
  // Only what the site needs: no real secrets or storage can leak in.
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", PORT: String(port),
    CONTENT_DRIVER: "github", CONTENT_GITHUB_TOKEN: "simulator", CONTENT_GITHUB_REPO: "simulator/content",
    CONTENT_GITHUB_API: fake.url, ADMIN_PASSWORD: password, ADMIN_SECRET: crypto.randomBytes(32).toString("hex"),
    NEXT_TELEMETRY_DISABLED: "1",
  };
  const server = spawn(process.execPath, [path.join(ROOT, "node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout.on("data", (chunk) => { serverLog += chunk; });
  server.stderr.on("data", (chunk) => { serverLog += chunk; });

  const browser = await launchBrowser();
  const errors = [];
  try {
    await until(async () => (await fetch(base)).ok, 30_000, "site did not start");

    const guestContext = await browser.newContext(phone);
    const hostContext = await browser.newContext(phone);
    const projectorContext = await browser.newContext(projectorSize);
    const guest = watchErrors(await guestContext.newPage(), errors, "guest");
    const runShow = watchErrors(await hostContext.newPage(), errors, "Run Show");
    const projector = watchErrors(await projectorContext.newPage(), errors, "projector");
    let key = "";
    const entry = () => `${base}/bad-decisions?qr=${key}`;
    const projectorText = async () => (await projector.locator("main").innerText()).trim();
    const adminAction = (body) =>
      runShow.evaluate(async (payload) => {
        const response = await fetch("/api/admin/decisions", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        return response.json();
      }, body);
    const sendFromPage = async (page, text) => {
      await page.locator("textarea").first().fill(text);
      await page.getByRole("button", { name: /^send it$/i }).click();
      await page.getByText(/in the pile/i).waitFor({ timeout: 10_000 });
      await page.getByRole("button", { name: /send another/i }).click();
    };

    section("1. The public site");
    for (const route of ["/", "/shows", "/news", "/about", "/contact", "/shop", "/hall-of-fame"]) {
      await check(`${route} loads`, async () => {
        const page = watchErrors(await guestContext.newPage(), errors, route);
        const response = await page.goto(base + route, { waitUntil: "networkidle" });
        expect(response?.status() === 200, `status ${response?.status()}`);
        if (route === "/") await shoot(page, "home", "Home page on a phone");
        await page.close();
      });
    }

    section("2. Projector and QR code");
    await check("projector screen opens, blank with the QR in the corner", async () => {
      await projector.goto(`${base}/bad-decisions/live`, { waitUntil: "networkidle" });
      expect((await projectorText()) === "", "screen is not blank");
      expect(await projector.locator('img[alt^="Scan"]').isVisible(), "no QR in the corner");
      await shoot(projector, "projector-blank", "Projector before the show: blank, QR in the corner");
    });
    await check("the QR on the projector decodes to the signed entry link", async () => {
      const svg = await (await fetch(`${base}/api/decisions/live/qr`)).text();
      const url = new URL(decodeQrSvg(svg));
      key = url.searchParams.get("qr") || "";
      expect(url.pathname === "/bad-decisions" && /^[a-f0-9]{64}$/.test(key), `unexpected ${url.pathname}`);
      return `${url.host}/bad-decisions?qr=${key.slice(0, 8)}…`;
    });
    await check("an old QR without the key is refused (404)", async () => {
      const response = await fetch(`${base}/bad-decisions`);
      expect(response.status === 404, `status ${response.status}`);
    });
    await check("a guest who scans before doors sees the countdown", async () => {
      await guest.goto(entry(), { waitUntil: "networkidle" });
      expect(/submissions open in/i.test(await bodyText(guest)), "no countdown");
      await shoot(guest, "guest-countdown", "Guest phone before doors: countdown");
    });

    section("3. Dress rehearsal (a separate practice copy)");
    const rehearsalShow = watchErrors(await hostContext.newPage(), errors, "rehearsal Run Show");
    const rehearsalScreen = watchErrors(await projectorContext.newPage(), errors, "rehearsal screen");
    const practicePhone = watchErrors(await guestContext.newPage(), errors, "practice phone");
    const rehearsalText = async () => (await rehearsalScreen.locator("main").innerText()).replace(/^\s*Rehearsal\s*/i, "").trim();
    const liveUntouched = async () => {
      expect(!fake.paths().some((p) => p.startsWith("submissions/")), "a practice question reached the live pile");
      expect((await projectorText()) === "", "the live projector changed");
    };
    let practiceEntry = "";
    await check("host signs in to Run Show", async () => {
      await runShow.goto(`${base}/admin/run-show`, { waitUntil: "networkidle" });
      await runShow.locator("input[type=password]").fill(password);
      await runShow.locator("button[type=submit]:not([disabled])").click();
      await runShow.getByText("Questions (0)").waitFor({ timeout: 10_000 });
    });
    await check("the rehearsal opens from Run Show, clearly marked", async () => {
      await runShow.getByRole("link", { name: /Dress rehearsal/ }).click();
      await runShow.getByText(/Dress rehearsal · practice only/i).waitFor({ timeout: 10_000 });
      await rehearsalShow.goto(`${base}/admin/run-show?mode=rehearsal`, { waitUntil: "networkidle" });
      await rehearsalShow.getByText("Practice questions (0)").waitFor({ timeout: 10_000 });
      await runShow.goto(`${base}/admin/run-show`, { waitUntil: "networkidle" });
      await shoot(rehearsalShow, "rehearsal-run-show", "The rehearsal's own Run Show");
    });
    await check("the rehearsal screen is its own screen, labelled REHEARSAL", async () => {
      await rehearsalScreen.goto(`${base}/bad-decisions/live?mode=rehearsal`, { waitUntil: "networkidle" });
      expect(await rehearsalScreen.getByText("Rehearsal", { exact: true }).isVisible(), "no REHEARSAL label");
      expect(await rehearsalScreen.locator('img[alt^="Scan"]').isVisible(), "no QR");
    });
    await check("its QR opens the practice form, not the real one", async () => {
      const svg = await (await fetch(`${base}/api/decisions/live/qr?mode=rehearsal`)).text();
      const url = new URL(decodeQrSvg(svg));
      expect(url.searchParams.get("mode") === "rehearsal" && url.searchParams.get("qr") === key, `unexpected ${url.search}`);
      practiceEntry = `${base}/bad-decisions?qr=${key}&mode=rehearsal`;
      return "…&mode=rehearsal";
    });
    await check("any phone gets the practice form before doors, marked practice only", async () => {
      await practicePhone.goto(practiceEntry, { waitUntil: "networkidle" });
      await practicePhone.locator("textarea").first().waitFor({ timeout: 10_000 });
      expect(/practice only/i.test(await bodyText(practicePhone)), "no practice banner");
      await shoot(practicePhone, "practice-form", "The practice form (always open, marked practice only)");
    });
    await check("two practice questions land in the practice pile", async () => {
      await sendFromPage(practicePhone, "PRACTICE: does the projector work?");
      await sendFromPage(practicePhone, "PRACTICE: second one");
      await rehearsalShow.getByRole("button", { name: "Refresh" }).click();
      await rehearsalShow.getByText("Practice questions (2)").waitFor({ timeout: 10_000 });
    });
    await check("the real show saw nothing: live pile empty, projector blank, guests on the countdown", async () => {
      await liveUntouched();
      await runShow.getByRole("button", { name: "Refresh" }).click();
      await runShow.getByText("Questions (0)").waitFor({ timeout: 10_000 });
      await guest.reload({ waitUntil: "networkidle" });
      expect(/submissions open in/i.test(await bodyText(guest)), "the real form opened");
    });
    await check("Show on screen puts practice on the rehearsal screen only", async () => {
      await rehearsalShow.locator("li", { hasText: "does the projector work" }).getByRole("button", { name: "Show on screen" }).click();
      await until(async () => (await rehearsalText()).includes("does the projector work"), 8_000, "rehearsal screen did not update");
      await projector.waitForTimeout(3_000);
      await liveUntouched();
      await shoot(rehearsalScreen, "rehearsal-screen", "The rehearsal screen showing a practice question");
    });
    await check("Clear screen blanks the rehearsal screen", async () => {
      await rehearsalShow.getByRole("button", { name: "Clear screen" }).click();
      await until(async () => (await rehearsalText()) === "", 8_000, "rehearsal screen not blank");
    });
    await check("Delete all practice questions empties the rehearsal", async () => {
      await rehearsalShow.locator("li", { hasText: "second one" }).getByRole("button", { name: "Show on screen" }).click();
      await until(async () => (await rehearsalText()).includes("second one"), 8_000, "rehearsal screen did not update");
      await rehearsalShow.getByRole("button", { name: "Delete all practice questions" }).click();
      await rehearsalShow.getByText(/Rehearsal cleared\. 2 practice questions deleted/).waitFor({ timeout: 20_000 });
      await until(async () => (await rehearsalText()) === "", 8_000, "rehearsal screen not blank");
      expect(!fake.paths().some((p) => p.startsWith("rehearsal/submissions/")), "practice files left behind");
      await liveUntouched();
    });

    section("4. 8 PM: the form opens");
    await check("the guest's countdown turns into the form by itself", async () => {
      const content = fake.read("content/content.json");
      fake.write("content/content.json", { ...content, weekly: { ...content.weekly, alwaysOpen: true } });
      await guest.locator("textarea").first().waitFor({ timeout: 45_000 });
      await shoot(guest, "guest-form", "Guest phone at 8 PM: the form, no reload needed");
    });
    await check("a guest sends one through the form", async () => {
      await sendFromPage(guest, "Should I text my ex during the show?");
    });
    await check("40 guests on the same wifi send at once, all saved", async () => {
      const statuses = await guest.evaluate(async (k) => Promise.all(Array.from({ length: 39 }, (_, i) =>
        fetch("/api/decisions", {
          method: "POST", headers: { "Content-Type": "application/json", "X-Decisions-QR": k },
          body: JSON.stringify({ decision: `Room decision ${i + 1}` }),
        }).then((response) => response.status))), key);
      const bad = statuses.filter((status) => status !== 200);
      expect(bad.length === 0, `${bad.length} refused: ${[...new Set(bad)].join(",")}`);
      return "40/40";
    });
    await check("Run Show lists all 40", async () => {
      await runShow.getByRole("button", { name: "Refresh" }).click();
      await runShow.getByText("Questions (40)").waitFor({ timeout: 10_000 });
      await shoot(runShow, "run-show-live", "Run Show during the show");
    });

    section("5. The show");
    await check("the host puts a question on the projector", async () => {
      await runShow.locator("li", { hasText: "text my ex" }).getByRole("button", { name: "Show on screen" }).click();
      await until(async () => (await projectorText()).includes("text my ex"), 8_000, "projector did not update");
      await shoot(projector, "projector-live", "Projector during the show");
    });
    await check("reloading the projector keeps the question", async () => {
      await projector.reload({ waitUntil: "networkidle" });
      await until(async () => (await projectorText()).includes("text my ex"), 8_000, "question lost on reload");
    });
    await check("the projector keeps its question through a wifi drop", async () => {
      await projector.route("**/api/decisions/live", (route) => route.abort("internetdisconnected"));
      await projector.waitForTimeout(6_500);
      const kept = (await projectorText()).includes("text my ex");
      await projector.unroute("**/api/decisions/live");
      expect(kept, "question vanished while offline");
    });
    await check("rehearsing during the show leaves the show alone", async () => {
      await practicePhone.goto(practiceEntry, { waitUntil: "networkidle" });
      await sendFromPage(practicePhone, "PRACTICE: mid-show check");
      await rehearsalShow.getByRole("button", { name: "Refresh" }).click();
      await rehearsalShow.locator("li", { hasText: "mid-show check" }).getByRole("button", { name: "Show on screen" }).click();
      await until(async () => (await rehearsalText()).includes("mid-show check"), 8_000, "rehearsal screen did not update");
      await projector.waitForTimeout(3_000);
      expect((await projectorText()).includes("text my ex"), "the live projector changed");
      await runShow.getByRole("button", { name: "Refresh" }).click();
      await runShow.getByText("Questions (40)").waitFor({ timeout: 10_000 });
      await rehearsalShow.getByRole("button", { name: "Delete all practice questions" }).click();
      await rehearsalShow.getByText(/Rehearsal cleared\. 1 practice question deleted/).waitFor({ timeout: 20_000 });
      expect((await projectorText()).includes("text my ex"), "clearing the rehearsal touched the live projector");
      return "live pile still 40, live projector unchanged";
    });
    await check("idle polling costs GitHub nothing (304 answers)", async () => {
      const before = { ...fake.stats };
      await projector.waitForTimeout(15_000);
      const free = fake.stats.notModified - before.notModified;
      const counted = fake.stats.counted - before.counted;
      expect(free > 0 && free >= counted, `${free} free vs ${counted} counted`);
      return `${free} free, ${counted} counted in 15 s`;
    });
    await check("Draw one picks a real decision", async () => {
      const result = await adminAction({ action: "draw" });
      expect(result.ok && result.drawn, JSON.stringify(result).slice(0, 80));
      return `“${result.drawn.decision}”`;
    });

    section("6. After the show");
    await check("Archive everything empties the pile and blanks the projector", async () => {
      let archived = 0;
      for (let round = 0; round < 10; round++) {
        const result = await adminAction({ action: "archive-all" });
        expect(result.ok, JSON.stringify(result).slice(0, 80));
        archived += result.archived;
        if (!result.remaining) break;
      }
      expect(archived === 40, `archived ${archived}`);
      await until(async () => (await projectorText()) === "", 8_000, "projector not blank");
      return `${archived} archived`;
    });
    await check("no storage write conflicts all night", async () => {
      expect(fake.stats.conflicts === 0, `${fake.stats.conflicts} conflicts`);
      return `${fake.stats.requests} storage requests, ${fake.stats.notModified} free`;
    });
    await check("no errors in any browser", async () => {
      expect(errors.length === 0, errors.slice(0, 3).join(" | "));
    });
  } finally {
    await browser.close();
    server.kill();
    await fake.close();
    if (results.some((result) => !result.ok)) writeFileSync(path.join(REPORT, "server.log"), serverLog);
  }
}

// ── live, read-only checks ──────────────────────────────────────────────────
async function liveChecks() {
  const browser = await launchBrowser();
  const errors = [];
  try {
    const context = await browser.newContext({ ...phone, ignoreHTTPSErrors: Boolean(process.env.HTTPS_PROXY) });
    const request = context.request;
    const get = async (url, options) => {
      for (let attempt = 0; ; attempt++) {
        try {
          const response = await request.get(url, options);
          if (response.status() < 500 || attempt >= 4) return response;
        } catch (error) {
          if (attempt >= 4) throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    };
    // A dropped connection or a one-off 5xx is retried after a pause, the
    // way a person would reload; a page that keeps failing still fails.
    const open = async (page, url) => {
      for (let attempt = 0; ; attempt++) {
        try {
          const response = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
          if ((response?.status() ?? 0) < 500 || attempt >= 4) return response;
        } catch (error) {
          if (attempt >= 4) throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    };
    let key = "";

    section(`Live site: ${LIVE} (read-only)`);
    for (const route of ["/", "/shows", "/news", "/about", "/contact", "/shop", "/hall-of-fame", "/admin/run-show"]) {
      await check(`${route} loads`, async () => {
        const page = watchErrors(await context.newPage(), errors, route);
        const response = await open(page, LIVE + route);
        expect(response?.status() === 200, `status ${response?.status()}`);
        if (route === "/shows") await shoot(page, "live-shows", "Live: /shows on a phone");
        if (route === "/admin/run-show") expect(/let me in|password/i.test(await bodyText(page)), "no sign-in form");
        await page.close();
      });
    }
    await check("next show is listed", async () => {
      const page = await context.newPage();
      await open(page, `${LIVE}/shows`);
      const text = await bodyText(page);
      await page.close();
      const next = text.match(/(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\s*,\s*\w+ \d+, \d{4}[^|]{0,40}/)?.[0];
      expect(next, "no upcoming show found");
      return next.trim();
    });
    await check("projector screen loads with its QR", async () => {
      const page = watchErrors(await context.newPage(), errors, "projector");
      await page.setViewportSize(projectorSize.viewport);
      const response = await open(page, `${LIVE}/bad-decisions/live`);
      expect(response?.status() === 200, `status ${response?.status()}`);
      expect(await page.locator('img[alt^="Scan"]').isVisible(), "no QR");
      await shoot(page, "live-projector", "Live: the projector screen right now");
      await page.close();
    });
    await check("the projector QR decodes to the signed entry link on this site", async () => {
      const svg = await (await get(`${LIVE}/api/decisions/live/qr`)).text();
      const url = new URL(decodeQrSvg(svg));
      key = url.searchParams.get("qr") || "";
      expect(url.origin === new URL(LIVE).origin, `QR points to ${url.origin}`);
      expect(url.pathname === "/bad-decisions" && /^[a-f0-9]{64}$/.test(key), "unexpected link");
      return `${url.host}/bad-decisions?qr=${key.slice(0, 8)}…`;
    });
    await check("the QR link opens the entry page", async () => {
      const page = watchErrors(await context.newPage(), errors, "entry");
      const response = await open(page, `${LIVE}/bad-decisions?qr=${key}`);
      expect(response?.status() === 200, `status ${response?.status()}`);
      const text = await bodyText(page);
      const form = await page.locator("textarea").count();
      await shoot(page, "live-entry", "Live: what a guest sees after scanning, right now");
      await page.close();
      if (/submissions open in/i.test(text)) return "showing the countdown";
      expect(form > 0, "neither the countdown nor the form is showing");
      return "showing the form";
    });
    await check("the form's schedule", async () => {
      const response = await get(`${LIVE}/api/decisions`, { headers: { "X-Decisions-QR": key } });
      const data = await response.json();
      expect(data.ok, JSON.stringify(data).slice(0, 80));
      const fmt = (iso) => iso ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "?";
      return data.open ? `OPEN now, closes ${fmt(data.closesAt)}` : `closed, opens ${fmt(data.opensAt)} New York time`;
    });
    await check("an old QR without the key is refused (404)", async () => {
      const response = await get(`${LIVE}/bad-decisions`);
      expect(response.status() === 404, `status ${response.status()}`);
    });
    await check("the projector's feed answers", async () => {
      const response = await get(`${LIVE}/api/decisions/live`);
      const data = await response.json();
      expect(response.status() === 200 && "question" in data, `status ${response.status()}`);
      return data.question ? "a question is on screen" : "screen is clear";
    });
    await check("no errors in any browser", async () => {
      expect(errors.length === 0, errors.slice(0, 3).join(" | "));
    });
  } finally {
    await browser.close();
  }
}

// ── report ───────────────────────────────────────────────────────────────────
function writeReport(title) {
  const passed = results.filter((result) => result.ok).length;
  const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const rows = results.map((result, index) => {
    const header = index === 0 || results[index - 1].section !== result.section
      ? `<tr><th colspan="3">${escape(result.section)}</th></tr>` : "";
    return `${header}<tr class="${result.ok ? "ok" : "bad"}"><td>${result.ok ? "PASS" : "FAIL"}</td><td>${escape(result.name)}</td><td>${escape(result.detail)}</td></tr>`;
  }).join("");
  const gallery = shots.map((shot) => `<figure><img src="${shot.file}" alt=""><figcaption>${escape(shot.caption)}</figcaption></figure>`).join("");
  writeFileSync(path.join(REPORT, "index.html"), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<style>body{font:15px/1.4 system-ui,sans-serif;margin:16px;max-width:980px;color:#111;background:#fff}h1{font-size:22px;margin:0 0 4px}
.sum{font-size:18px;font-weight:700;margin:0 0 14px}.sum.bad{color:#b00}.sum.ok{color:#070}table{border-collapse:collapse;width:100%}
td,th{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{background:#111;color:#fff}
tr.ok td:first-child{color:#070;font-weight:700}tr.bad td:first-child{color:#b00;font-weight:700}tr.bad{background:#fff0f0}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:18px}figure{margin:0}
img{width:100%;border:1px solid #ccc}figcaption{font-size:13px;color:#444}</style>
<h1>${escape(title)}</h1><p class="sum ${passed === results.length ? "ok" : "bad"}">${passed} of ${results.length} passed</p>
<p>${escape(new Date().toString())}</p><table>${rows}</table><div class="gallery">${gallery}</div>`);
  writeFileSync(path.join(REPORT, "report.json"), JSON.stringify({ title, passed, total: results.length, results }, null, 2));
}

rmSync(REPORT, { recursive: true, force: true });
mkdirSync(REPORT, { recursive: true });
const title = LIVE ? `Live site check: ${LIVE}` : "Show night simulation";
try {
  if (LIVE) await liveChecks();
  else await simulate();
} catch (error) {
  results.push({ section: current, name: "simulator crashed", ok: false, detail: error instanceof Error ? error.message : String(error) });
  console.error(error);
}
writeReport(title);
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed. Report: ${path.relative(process.cwd(), path.join(REPORT, "index.html"))}`);
process.exit(failed.length ? 1 : 0);
