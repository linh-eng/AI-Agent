import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3300";
const OUT = process.argv[2] || "/tmp/plan-shots2";
const PLAN_ID = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, locale: "vi-VN", deviceScaleFactor: 1.3 });
const page = await ctx.newPage();
async function go(u) { await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }
async function shot(f, full = true) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${f}.png`, fullPage: full }); console.log("OK", f); }

try {
  await go("/login");
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await go(`/treatment-plans/${PLAN_ID}`);
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Kế hoạch theo giai đoạn/ }).first().click();
  await page.waitForTimeout(600);
  // (1)(2)(4): header không còn (1/4); Chuẩn bị = Hoàn thành; buổi hoàn thành có "Sửa ghi nhận"
  await shot("07-giai-doan-sau-chinh");

  // (3): mở Thêm buổi, chọn giai đoạn Chuẩn bị (20-27/08), nhập ngày ngoài khoảng → cảnh báo
  await page.getByRole("button", { name: /Thêm buổi/ }).first().click();
  await page.waitForTimeout(800);
  // chọn giai đoạn "Chuẩn bị" theo nhãn (scope trong modal overlay .fixed)
  const stageSel = page.locator('.fixed select').first();
  await stageSel.selectOption({ label: "Chuẩn bị" });
  await page.waitForTimeout(300);
  // nhập ngày ngoài khoảng (giai đoạn Chuẩn bị 20–27/08, chọn 15/10)
  const dateInput = page.locator('.fixed input[type="date"]').first();
  await dateInput.fill("2026-10-15");
  await dateInput.dispatchEvent("change");
  await page.waitForTimeout(600);
  await shot("08-canh-bao-ngay-ngoai-giai-doan", false);
} catch (e) { console.error("ERR", e.message, e.stack); }
finally { await browser.close(); }
