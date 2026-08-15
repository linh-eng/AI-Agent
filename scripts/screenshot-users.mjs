// Chụp màn hình module Quản trị người dùng (/users) — nghiệm thu Mục 14.
import { chromium } from "playwright-core";
import fs from "node:fs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.BASE || "http://localhost:3100";
const OUT = process.argv[2] || "/tmp/m14-shots";
fs.mkdirSync(OUT, { recursive: true });
const ADMIN = { email: "admin@sophia.com.vn", password: "admin123" };

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "vi-VN", deviceScaleFactor: 1.4 });
const page = await ctx.newPage();
async function shot(file, { full = true } = {}) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full }); console.log("OK", file); }
async function go(url) { await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }

try {
  await go("/login");
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await go("/users");
  await page.waitForTimeout(1200);
  await shot("01-danh-sach-nguoi-dung");

  // Mở form thêm người dùng nếu có
  const add = page.locator('button:has-text("Thêm")').first();
  if (await add.count()) { await add.click().catch(() => {}); await page.waitForTimeout(800); await shot("02-them-nguoi-dung"); }
} catch (e) {
  console.error("ERR", e.message);
} finally {
  await browser.close();
}
