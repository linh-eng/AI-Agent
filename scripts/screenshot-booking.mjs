// Chụp màn hình module Lịch hẹn để nghiệm thu.
import { chromium } from "playwright-core";
import fs from "node:fs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3300";
const OUT = process.argv[2] || "/tmp/bk-shots";
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "vi-VN", deviceScaleFactor: 1.4 });
const page = await ctx.newPage();
async function shot(file) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true }); console.log("OK", file); }
async function go(url) { await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }

try {
  await go("/login");
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // Điều hướng tới ngày có lịch demo (20/08/2026) — bấm ‹/› từ hôm nay khá xa, nên
  // dùng luôn chế độ Danh sách để thấy tất cả, rồi Tháng 8/2026.
  await go("/bookings");
  await page.waitForTimeout(800);
  // Chế độ Danh sách
  await page.locator('button:has-text("Danh sách")').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await shot("01-danh-sach");

  // Mở chi tiết lịch hẹn có liên kết phác đồ (BK-100004)
  const row = page.locator('tr:has-text("BK-100004")').first();
  if (await row.count()) { await row.click(); await page.waitForTimeout(1200); await shot("02-chi-tiet-lien-ket-phac-do"); await page.keyboard.press("Escape"); await page.waitForTimeout(400); }

  // Chi tiết lịch đã đổi lịch (BK-100005) — có lịch sử đổi lịch
  const row5 = page.locator('tr:has-text("BK-100005")').first();
  if (await row5.count()) { await row5.click(); await page.waitForTimeout(1000); await shot("03-chi-tiet-doi-lich"); await page.keyboard.press("Escape"); await page.waitForTimeout(400); }

  // Form tạo lịch hẹn (auto-duration + end time)
  await page.locator('button:has-text("Tạo lịch hẹn")').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await shot("04-form-tao-lich");
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);

  // Chế độ Tháng 8/2026 (điều hướng lùi từ hiện tại 13/08/2026 là cùng tháng)
  await page.locator('button:has-text("Tháng")').first().click().catch(() => {});
  await page.waitForTimeout(900);
  await shot("05-lich-thang");

  // Chế độ Ngày 20/08 (có công suất) — chuyển sang ngày rồi tiến tới 20/08
  await page.locator('button:has-text("Ngày")').first().click().catch(() => {});
  await page.waitForTimeout(700);
  await shot("06-lich-ngay-cong-suat");
} catch (e) { console.error("ERR", e.message); }
finally { await browser.close(); }
