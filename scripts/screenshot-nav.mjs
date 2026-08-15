// Chụp sidebar 5 vai trò sau khi siết menu theo permission (Mục 15 N).
import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.BASE || "http://localhost:3100";
const OUT = process.argv[2] || "/tmp/m15n-shots";
fs.mkdirSync(OUT, { recursive: true });
const ROLES = [
  ["cskh@sophia.com.vn", "cskh123", "01-cskh"],
  ["chuyenvien@sophia.com.vn", "chuyenvien123", "02-chuyenvien"],
  ["thungan@sophia.com.vn", "thungan123", "03-thungan"],
  ["marketing@sophia.com.vn", "marketing123", "04-marketing"],
  ["quanly@sophia.com.vn", "quanly123", "05-quanly"],
  ["admin@sophia.com.vn", "admin123", "06-admin"],
];
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
for (const [email, pw, file] of ROLES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1150 }, locale: "vi-VN", deviceScaleFactor: 1.25 });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
    await page.click('button[type="submit"]'); await page.waitForTimeout(2600);
    // chụp riêng phần sidebar để thấy đủ menu
    const aside = page.locator("aside").first();
    await aside.screenshot({ path: `${OUT}/${file}.png` });
    console.log("OK", file);
  } catch (e) { console.error("ERR", file, e.message); }
  await ctx.close();
}
await browser.close();
