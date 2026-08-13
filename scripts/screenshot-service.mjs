import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3300";
const OUT = process.argv[2] || "/tmp/svc-shots";
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 }, locale: "vi-VN", deviceScaleFactor: 1.35 });
const page = await ctx.newPage();
async function shot(f) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${f}.png`, fullPage: true }); console.log("OK", f); }
async function go(u) { await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }
try {
  await go("/login");
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await go("/services");
  await page.waitForTimeout(900);
  await shot("01-danh-sach");

  // Chi tiết dịch vụ HIFU (đầy đủ cấu hình)
  const row = page.locator('tr:has-text("Nâng cơ HIFU")').first();
  if (await row.count()) { await row.click(); await page.waitForTimeout(1000); await shot("02-chi-tiet-hifu"); await page.keyboard.press("Escape"); await page.waitForTimeout(400); }

  // Form thêm dịch vụ (5 khối)
  await page.locator('button:has-text("Thêm dịch vụ")').first().click();
  await page.waitForTimeout(800);
  await shot("03-form-them-5-khoi");
  // Mở tạo nhanh nhóm
  const quick = page.locator('button:has-text("+ Tạo nhóm mới")').first();
  if (await quick.count()) { await quick.click(); await page.waitForTimeout(400); await page.locator('input[placeholder="Tên nhóm mới"]').fill("Trị liệu chuyên sâu"); await shot("04-tao-nhanh-nhom"); }
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);

  // Sửa HIFU để thấy dữ liệu cấu hình đã điền
  await go("/services");
  await page.waitForTimeout(700);
  const row2 = page.locator('tr:has-text("RF nâng cơ mặt")').first();
  if (await row2.count()) { await row2.click(); await page.waitForTimeout(800);
    const editBtn = page.locator('button:has-text("Sửa")').first();
    if (await editBtn.count()) { await editBtn.click(); await page.waitForTimeout(1000); await shot("05-sua-rf-cau-hinh"); }
  }
} catch (e) { console.error("ERR", e.message); }
finally { await browser.close(); }
