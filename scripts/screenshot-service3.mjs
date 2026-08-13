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
async function shot(f) { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${f}.png`, fullPage: true }); console.log("OK", f); }
async function go(u) { await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }
await go("/login");
await page.fill('input[type="email"]', STAFF.email);
await page.fill('input[type="password"]', STAFF.password);
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

await go("/services");
await page.waitForTimeout(800);
try {
  await page.getByRole("button", { name: /Thêm dịch vụ/ }).first().click();
  await page.waitForTimeout(700);
  await page.getByText("+ Tạo nhóm mới", { exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('input[placeholder="Tên nhóm mới"]').fill("Nhóm trị liệu công nghệ cao");
  await shot("04-tao-nhanh-nhom");
} catch (e) { console.error("04 ERR", e.message); }
await browser.close();
