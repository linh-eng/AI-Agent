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
await page.goto(`${BASE}/import-customers`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
// Dùng mẫu → auto map
await page.getByRole("button", { name: /Dùng mẫu/ }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/m12-mapping.png`, fullPage: true });
// Kiểm tra & xem trước (dry-run, không ghi)
await page.getByRole("button", { name: /Kiểm tra & xem trước/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/m12-preview.png`, fullPage: true });
await browser.close();
console.log("DONE m12 shots");
