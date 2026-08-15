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

for (const [path, name] of [["/services", "services"], ["/technologies", "technologies"], ["/protocols", "protocols"], ["/catalog", "catalog"], ["/form-templates", "forms"], ["/care-instructions", "care"]]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/m11-${name}.png`, fullPage: true });
}
await browser.close();
console.log("DONE m11 shots");
