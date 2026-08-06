import { chromium } from "playwright-core";

const OUT = process.env.SHOT_DIR;
const BASE = "http://localhost:3111";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const pages = [
  ["dashboard", "/dashboard"],
  ["inventory", "/inventory"],
  ["inbound", "/inbound"],
  ["work-orders", "/work-orders"],
  ["warranty", "/warranty"],
  ["stock-counts", "/stock-counts"],
  ["serials", "/serials"],
  ["reports", "/reports"],
];

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

// Login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input#password', "admin123");
await page.screenshot({ path: `${OUT}/00-login.png` });
await page.click('button[type=submit]');
await page.waitForURL("**/dashboard", { timeout: 15000 });
await page.waitForTimeout(1200);

let i = 1;
for (const [name, path] of pages) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${String(i).padStart(2, "0")}-${name}.png`, fullPage: true });
  console.log("shot:", name);
  i++;
}

// Serial trace modal
await page.goto(`${BASE}/serials`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const row = page.locator("tbody tr").first();
if (await row.count()) {
  await row.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/09-serial-trace.png` });
  console.log("shot: serial-trace");
}

await browser.close();
console.log("DONE");
