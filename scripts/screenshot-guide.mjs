// Chụp màn hình cho HƯỚNG DẪN SỬ DỤNG (có hình ảnh). Chromium có sẵn.
import { chromium } from "playwright-core";
import fs from "node:fs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3000";
const OUT = process.argv[2] || "/tmp/guide-shots";
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN", deviceScaleFactor: 1.5 });
const page = await ctx.newPage();

async function shot(file, { full = true } = {}) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full });
  console.log("OK", file);
}
async function go(url) { await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }

try {
  // Login
  await go("/login");
  await shot("00-dang-nhap", { full: false });
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  console.log("-> ", page.url());

  const simple = [
    ["/crm", "01-tong-quan"],
    ["/customers", "02-khach-hang"],
    ["/proposals", "05-bao-gia-ds"],
    ["/invoices", "06-hoa-don-ds"],
    ["/payments", "07-thanh-toan"],
    ["/price-floor", "08-gia-san"],
    ["/employees", "09-nhan-su"],
    ["/followups", "10-cskh-followup"],
    ["/before-after", "11-before-after"],
    ["/services", "13-dich-vu"],
    ["/treatment-plans", "14-phac-do-ds"],
    ["/settings", "15-cai-dat"],
  ];
  for (const [url, file] of simple) { await go(url); await shot(file); }

  // Booking — chuyển sang chế độ Tháng
  await go("/bookings");
  const thang = page.locator('button:has-text("Tháng")').first();
  if (await thang.count()) { await thang.click(); await page.waitForTimeout(600); }
  await shot("04-booking-lich-thang");
  // Booking — chế độ Tuần
  const tuan = page.locator('button:has-text("Tuần")').first();
  if (await tuan.count()) { await tuan.click(); await page.waitForTimeout(600); await shot("04b-booking-lich-tuan"); }

  // Hồ sơ khách KH-100004 (hành trình đầy đủ)
  await go("/customers");
  const link = page.locator('a:has-text("Đỗ Thùy Linh")').first();
  if (await link.count()) { await link.click(); await page.waitForTimeout(1500); await shot("03-ho-so-khach"); }

  // Báo giá chi tiết (3 phương án)
  await go("/proposals");
  const bg = page.locator('a:has-text("nâng cơ")').first();
  if (await bg.count()) { await bg.click(); await page.waitForTimeout(1200); await shot("05b-bao-gia-chi-tiet"); }

  // Hóa đơn chi tiết
  await go("/invoices");
  const hd = page.locator('a:has-text("HD-000001")').first();
  if (await hd.count()) { await hd.click(); await page.waitForTimeout(1200); await shot("06b-hoa-don-chi-tiet"); }

  // Phác đồ chi tiết (ghi buổi: nhân sự + đánh giá + vật tư)
  await go("/treatment-plans");
  const pd = page.locator('a:has-text("nâng cơ")').first();
  if (await pd.count()) { await pd.click(); await page.waitForTimeout(1200); await shot("14b-phac-do-chi-tiet"); }

  // Import khách hàng — nạp mẫu + kiểm tra
  await go("/import-customers");
  const mau = page.locator('button:has-text("Dùng mẫu")').first();
  if (await mau.count()) {
    await mau.click(); await page.waitForTimeout(600);
    const kt = page.locator('button:has-text("Kiểm tra & xem trước")').first();
    if (await kt.count()) { await kt.click(); await page.waitForTimeout(1200); }
    await shot("12-import-khach");
  }

  console.log("DONE");
} catch (e) {
  console.error("ERR", e.message);
} finally {
  await browser.close();
}
