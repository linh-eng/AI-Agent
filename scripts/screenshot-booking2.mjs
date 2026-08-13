// Chụp màn Lịch hẹn (v2): selects tài nguyên, conflict thực, gợi ý giờ, view Ngày.
import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3300";
const OUT = process.argv[2] || "/tmp/bk2-shots";
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN", deviceScaleFactor: 1.35 });
const page = await ctx.newPage();
async function shot(f) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${f}.png`, fullPage: true }); console.log("OK", f); }
async function go(u) { await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }
async function pick(placeholder, option) {
  await page.getByText(placeholder, { exact: true }).click(); await page.waitForTimeout(250);
  await page.locator(`button:has-text("${option}")`).first().click(); await page.waitForTimeout(250);
}

try {
  await go("/login");
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // View Ngày (13/08/2026 có 8 lịch đủ trạng thái)
  await go("/bookings");
  await page.waitForTimeout(1000);
  await shot("01-view-ngay-du-trang-thai");

  // Danh sách (đủ badge trạng thái)
  await page.locator('button:has-text("Danh sách")').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await shot("02-danh-sach-trang-thai");

  // Form tạo lịch — selects tài nguyên
  await page.locator('button:has-text("Tạo lịch hẹn")').first().click();
  await page.waitForTimeout(700);
  await page.locator('select').nth(0).selectOption({ label: "KH-100004 · Đỗ Thùy Linh" }).catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('input[type="datetime-local"]').first().fill("2026-08-13T11:30");
  await page.locator('input[type="number"]').first().fill("60");
  await shot("03-form-selects");

  // Chọn tài nguyên trùng với BK-100013 (11:00–12:00, KTV Phạm Chuyên Viên, Máy HIFU #1, Phòng 3)
  await pick("Chọn KTV", "Phạm Chuyên Viên");
  await pick("Chọn máy", "Máy HIFU #1");
  await pick("Chọn phòng", "Phòng 3");
  // Submit để lấy cảnh báo trùng
  await page.locator('button[type="submit"]:has-text("Lưu lịch hẹn")').click().catch(() => {});
  await page.waitForTimeout(1200);
  await shot("04-conflict-nhieu-tai-nguyen-goi-y-gio");

  // Đóng modal
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);

  // Danh mục tài nguyên
  await page.locator('button:has-text("Tài nguyên")').first().click().catch(() => {});
  await page.waitForTimeout(700);
  await shot("05-danh-muc-tai-nguyen");
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);

  // Chi tiết BK-100017 (đã đổi lịch) — mở từ danh sách
  const row = page.locator('tr:has-text("BK-100017")').first();
  if (await row.count()) { await row.click(); await page.waitForTimeout(1000); await shot("06-chi-tiet-lich-su-doi-lich"); }
} catch (e) { console.error("ERR", e.message); }
finally { await browser.close(); }
