import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3300";
const OUT = process.argv[2] || "/tmp/session-shots";
const SID = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 }, locale: "vi-VN", deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
async function go(u) { await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }

try {
  await go("/login");
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await go(`/sessions/${SID}`);
  await page.waitForTimeout(1200);
  // full page (dài) — chụp toàn bộ 7 khối
  await page.screenshot({ path: `${OUT}/01-session-full.png`, fullPage: true });
  console.log("OK 01-session-full");

  // Crop phần trên: header + A + B (cảnh báo) + đầu C
  await page.screenshot({ path: `${OUT}/02-header-A-B.png`, clip: { x: 300, y: 60, width: 1000, height: 960 } });
  console.log("OK 02-header-A-B");
} catch (e) { console.error("ERR", e.message, e.stack); }
finally { await browser.close(); }
