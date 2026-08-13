import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3000";
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN" });
const p = await ctx.newPage();
await p.goto(BASE + "/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "quanly@sophia.com.vn");
await p.fill('input[type="password"]', "quanly123");
await p.click('button[type="submit"]');
await p.waitForTimeout(2500);

async function shot(url, file) {
  await p.goto(BASE + url, { waitUntil: "networkidle", timeout: 20000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
  console.log("OK", file);
}
await shot("/materials", "mat-01-kho-vat-tu");
await shot("/customer-materials", "mat-02-vat-tu-khach");
await shot("/material-usages", "mat-03-lich-su");
await shot("/materials/report", "mat-04-bao-cao");

// Customer profile -> tab Vật tư khách hàng (KH-100004)
await p.goto(BASE + "/customers", { waitUntil: "networkidle" });
const link = p.locator('a:has-text("Đỗ Thùy Linh")').first();
if (await link.count()) {
  await link.click(); await p.waitForTimeout(1200);
  const tab = p.locator('button:has-text("Vật tư khách hàng")').first();
  if (await tab.count()) { await tab.click(); await p.waitForTimeout(600); }
  await p.screenshot({ path: `${OUT}/mat-05-ho-so-tab.png`, fullPage: true });
  console.log("OK mat-05-ho-so-tab");
}
await b.close();
console.log("DONE");
