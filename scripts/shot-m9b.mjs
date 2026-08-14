import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
const OUT = "/tmp/claude-0/-home-user-AI-Agent/b21d6139-80c5-55eb-aa46-2d5f7a118bf4/scratchpad";

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
const page = await ctx.newPage();
await login(page, "quanly@sophia.com.vn", "quanly123");

// /followups
await page.goto(`${BASE}/followups`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/m9b-followups.png`, fullPage: true });

// /tasks overdue
await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const ov = page.getByRole("button", { name: /Quá hạn/ });
if (await ov.count()) { await ov.first().click(); await page.waitForTimeout(900); }
await page.screenshot({ path: `${OUT}/m9b-tasks-overdue.png`, fullPage: true });

// evidence sheet HTML
await page.goto(`file://${OUT}/m9-evidence-sheet.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const h = await page.evaluate(() => document.body.scrollHeight);
await ctx2Shot(page, h);
async function ctx2Shot(pg, height) {
  await pg.setViewportSize({ width: 1200, height: Math.min(height + 40, 4000) });
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${OUT}/m9b-evidence-sheet.png`, fullPage: true });
}

await browser.close();
console.log("DONE");
