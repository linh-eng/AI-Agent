import { chromium } from "playwright-core";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
const OUT = "/tmp/m15-shots";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
for (const [email, pw, file] of [["cskh@sophia.com.vn", "cskh123", "10-cskh-sau-va"], ["quanly@sophia.com.vn", "quanly123", "11-quanly-sau-va"]]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "vi-VN", deviceScaleFactor: 1.3 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
  await page.click('button[type="submit"]'); await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
  console.log("OK", file); await ctx.close();
}
await browser.close();
