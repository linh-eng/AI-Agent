// Chụp sidebar/nav theo 7 vai trò — bằng chứng UI visibility (Mục 15 N).
import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.BASE || "http://localhost:3100";
const OUT = process.argv[2] || "/tmp/m15-shots";
fs.mkdirSync(OUT, { recursive: true });

const ROLES = [
  ["admin@sophia.com.vn", "admin123", "01-admin"],
  ["quanly@sophia.com.vn", "quanly123", "02-quanly"],
  ["letan@sophia.com.vn", "letan123", "03-letan"],
  ["cskh@sophia.com.vn", "cskh123", "04-cskh"],
  ["chuyenvien@sophia.com.vn", "chuyenvien123", "05-chuyenvien"],
  ["thungan@sophia.com.vn", "thungan123", "06-thungan"],
  ["marketing@sophia.com.vn", "marketing123", "07-marketing"],
];

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
for (const [email, pw, file] of ROLES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN", deviceScaleFactor: 1.3 });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pw);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
    console.log("OK", file);
  } catch (e) { console.error("ERR", file, e.message); }
  await ctx.close();
}
await browser.close();
