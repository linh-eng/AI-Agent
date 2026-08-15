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
const ctx = await browser.newContext({ viewport: { width: 1360, height: 1100 } });
const page = await ctx.newPage();
await login(page, "quanly@sophia.com.vn", "quanly123");

// Gallery + KPI
await page.goto(`${BASE}/before-after`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/m10-gallery.png`, fullPage: true });

// zoom/compare: click first before image
const img = page.locator("img").first();
if (await img.count()) {
  await img.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/m10-zoom.png`, fullPage: true });
}

await browser.close();
console.log("DONE m10 shots");
