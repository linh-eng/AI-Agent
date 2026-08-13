// Chụp màn hình module Khách hàng / Hồ sơ 360° để nghiệm thu.
import { chromium } from "playwright-core";
import fs from "node:fs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3300";
const OUT = process.argv[2] || "/tmp/cust-shots";
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "vi-VN", deviceScaleFactor: 1.4 });
const page = await ctx.newPage();
async function shot(file, { full = true } = {}) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full }); console.log("OK", file); }
async function go(url) { await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }
async function clickTab(name) { const t = page.locator(`div.border-b button`, { hasText: name }).first(); if (await t.count()) { await t.click(); await page.waitForTimeout(900); } }

try {
  await go("/login");
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // 1) Danh sách khách hàng
  await go("/customers");
  await shot("01-danh-sach");
  // Mở bộ lọc
  const f = page.locator('button:has-text("Bộ lọc")').first();
  if (await f.count()) { await f.click(); await page.waitForTimeout(500); await shot("02-bo-loc"); }

  // 2) Hồ sơ KH-100004 — Tổng quan
  await go("/customers");
  const link = page.locator('a:has-text("Đỗ Thùy Linh")').first();
  if (await link.count()) { await link.click(); await page.waitForTimeout(1600); }
  await shot("03-tong-quan");

  // 3) Các tab
  for (const [name, file] of [
    ["Timeline", "04-timeline"],
    ["Booking & Lần thực hiện", "05-booking-lan-thuc-hien"],
    ["Phác đồ", "06-phac-do"],
    ["Đánh giá & Before/After", "07-danh-gia-ba"],
    ["Sản phẩm đề xuất", "08-san-pham"],
    ["Vật tư khách hàng", "09-vat-tu"],
    ["Chăm sóc khách hàng", "10-cham-soc"],
    ["Báo giá", "11-bao-gia"],
    ["Hóa đơn & Thanh toán", "12-hoa-don-thanh-toan"],
    ["Biểu mẫu & Tài liệu", "13-bieu-mau"],
  ]) { await clickTab(name); await shot(file); }

  // 4) Before/After -> mở tab con
  await clickTab("Đánh giá & Before/After");
  const baSub = page.locator('button:has-text("Before/After")').nth(1);
  if (await baSub.count()) { await baSub.click(); await page.waitForTimeout(900); await shot("07b-before-after-gallery"); }
} catch (e) { console.error("ERR", e.message); }
finally { await browser.close(); }
