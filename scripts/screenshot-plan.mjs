import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3300";
const OUT = process.argv[2] || "/tmp/plan-shots";
const PLAN_ID = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, locale: "vi-VN", deviceScaleFactor: 1.3 });
const page = await ctx.newPage();
async function go(u) { await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }
async function shot(f, full = true) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${f}.png`, fullPage: full }); console.log("OK", f); }
async function clickTab(label) { await page.getByRole("button", { name: label }).first().click().catch(()=>{}); await page.waitForTimeout(500); }

try {
  await go("/login");
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // Danh sách phác đồ
  await go("/treatment-plans");
  await shot("01-danh-sach");

  // Chi tiết — tab Tổng quan
  await go(`/treatment-plans/${PLAN_ID}`);
  await page.waitForTimeout(900);
  await shot("02-tong-quan");

  // Tab Kế hoạch theo giai đoạn
  await clickTab(/Kế hoạch theo giai đoạn/);
  await shot("03-ke-hoach-giai-doan");

  // Tab Timeline
  await clickTab(/Timeline/);
  await shot("04-timeline");

  // Tab Phiên bản
  await clickTab(/Phiên bản/);
  await shot("05-phien-ban");

  // Mở chi tiết buổi 3 (Kế hoạch vs Thực tế) — quay lại tab giai đoạn
  await clickTab(/Kế hoạch theo giai đoạn/);
  await page.waitForTimeout(400);
  // bấm "Xem kết quả" của buổi #3 (đã hoàn thành)
  const btns = page.getByRole("button", { name: /Xem kết quả|Chi tiết/ });
  const n = await btns.count();
  // buổi 3 là buổi hoàn thành thứ 3 → tìm nút trong hàng chứa "#3"
  await page.locator('tr:has-text("#3") button:has-text("Xem kết quả")').first().click().catch(async () => {
    if (n > 2) await btns.nth(2).click();
  });
  await page.waitForTimeout(700);
  await shot("06-ke-hoach-vs-thuc-te", false);
} catch (e) { console.error("ERR", e.message, e.stack); }
finally { await browser.close(); }
