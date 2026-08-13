// Chụp màn hình bản demo bằng Chromium có sẵn (playwright-core).
import { chromium } from "playwright-core";
import fs from "node:fs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3000";
const OUT = process.argv[2] || "/tmp/shots";
fs.mkdirSync(OUT, { recursive: true });

const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };
const PORTAL = { email: "linh.do@example.com", password: "khach123" };

// (đường dẫn, tên file, mô tả)
const STAFF_PAGES = [
  ["/crm", "01-tong-quan", "Tổng quan (Dashboard CRM)"],
  ["/customers", "02-khach-hang", "Danh sách khách hàng"],
  ["/bookings", "05-booking", "Booking / Lịch hẹn"],
  ["/services", "06-dich-vu", "Dịch vụ"],
  ["/treatment-plans", "07-phac-do-ds", "Danh sách phác đồ"],
  ["/proposals", "09-bao-gia", "Báo giá / Proposal"],
  ["/protocols", "10-protocol", "Thư viện Protocol"],
  ["/technologies", "11-cong-nghe", "Công nghệ"],
  ["/brands", "12-brand", "Thương hiệu"],
  ["/catalog", "13-san-pham", "Sản phẩm (Catalog)"],
  ["/form-templates", "14-bieu-mau", "Biểu mẫu"],
  ["/care-instructions", "15-cham-soc", "Hướng dẫn chăm sóc"],
  ["/tasks", "16-cong-viec", "Công việc / Follow-up"],
  ["/inventory", "17-ton-kho", "Tồn kho"],
  ["/marketing", "18-marketing", "Marketing"],
  ["/pricing", "19-bang-gia", "Bảng giá"],
  ["/reports", "20-bao-cao", "Báo cáo (Kho)"],
];

async function shoot(page, url, file, label) {
  try {
    await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
    console.log("OK  ", file, "-", label);
  } catch (e) {
    console.log("FAIL", file, "-", label, ":", e.message.split("\n")[0]);
  }
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
try {
  // ---- STAFF ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/00-dang-nhap.png` });
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  console.log("Đăng nhập staff ->", page.url());

  for (const [url, file, label] of STAFF_PAGES) await shoot(page, url, file, label);

  // Hồ sơ khách KH-100004 (hành trình đầy đủ)
  await page.goto(BASE + "/customers", { waitUntil: "networkidle" });
  const link = page.locator('a:has-text("Đỗ Thùy Linh")').first();
  if (await link.count()) {
    await link.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/03-ho-so-khach.png`, fullPage: true });
    console.log("OK   03-ho-so-khach - Hồ sơ khách KH-100004");
  }
  // Phác đồ chi tiết
  await page.goto(BASE + "/treatment-plans", { waitUntil: "networkidle" });
  const plink = page.locator('a:has-text("nâng cơ")').first();
  if (await plink.count()) {
    await plink.click(); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/08-phac-do-chi-tiet.png`, fullPage: true });
    console.log("OK   08-phac-do-chi-tiet");
  }
  // Báo giá chi tiết (3 phương án)
  await page.goto(BASE + "/proposals", { waitUntil: "networkidle" });
  const bglink = page.locator('a:has-text("nâng cơ")').first();
  if (await bglink.count()) {
    await bglink.click(); await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/09b-bao-gia-3-phuong-an.png`, fullPage: true });
    console.log("OK   09b-bao-gia-3-phuong-an");
  }
  await ctx.close();

  // ---- PORTAL (Cổng khách) ----
  const pctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "vi-VN" });
  const pp = await pctx.newPage();
  await pp.goto(BASE + "/portal/login", { waitUntil: "networkidle" });
  await pp.screenshot({ path: `${OUT}/30-portal-dang-nhap.png` });
  await pp.fill('input[type="email"]', PORTAL.email);
  await pp.fill('input[type="password"]', PORTAL.password);
  await pp.click('button[type="submit"]');
  await pp.waitForTimeout(2500);
  await pp.screenshot({ path: `${OUT}/31-portal-trang-chu.png`, fullPage: true });
  console.log("OK   31-portal ->", pp.url());
  await pctx.close();
} finally {
  await browser.close();
}
console.log("DONE");
