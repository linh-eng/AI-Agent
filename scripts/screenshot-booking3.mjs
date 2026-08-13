import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3300";
const OUT = process.argv[2] || "/tmp/bk3-shots";
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: "vi-VN", deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
async function shot(f) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${f}.png`, fullPage: true }); console.log("OK", f); }
async function go(u) { await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }
async function openDetail(code) {
  await go("/bookings");
  await page.locator('button:has-text("Danh sách")').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator(`tr:has-text("${code}")`).first().click();
  await page.waitForTimeout(1000);
}
try {
  await go("/login");
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await openDetail("BK-100012"); // Khách đã đến → Bắt đầu thực hiện
  await shot("01-khach-da-den-bat-dau");
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);

  await openDetail("BK-100013"); // Đang thực hiện + phác đồ → Ghi nhận lần thực hiện
  await shot("02-dang-thuc-hien-ghi-nhan");
} catch (e) { console.error("ERR", e.message); }
finally { await browser.close(); }
