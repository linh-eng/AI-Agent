import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3300";
const OUT = process.argv[2] || "/tmp/qc-flow";
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
// viewport cao để cả modal hiện, không cần scroll
const ctx = await browser.newContext({ viewport: { width: 1120, height: 1500 }, locale: "vi-VN", deviceScaleFactor: 1.6 });
const page = await ctx.newPage();
async function go(u) { await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }

// clip đúng khối A (card chứa "Thông tin cшин cơ bản") + chút đệm
async function shot(name) {
  await page.waitForTimeout(300);
  const rect = await page.evaluate(() => {
    const h3s = Array.from(document.querySelectorAll("h3"));
    const h = h3s.find((e) => e.textContent && e.textContent.trim() === "Thông tin cơ bản");
    if (!h) return null;
    let card = h.closest("div.rounded-lg.border") || h.parentElement.parentElement;
    const r = card.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  if (!rect) { console.error("no block A", name); return; }
  const pad = 10;
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.w + pad * 2, height: rect.h + pad * 2 },
  });
  console.log("OK", name, JSON.stringify(rect));
}
async function clickText(txt) {
  const h = page.getByText(txt, { exact: true }).first();
  await h.dispatchEvent("click");
  await page.waitForTimeout(350);
}

try {
  await go("/login");
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await go("/services");
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Thêm dịch vụ/ }).first().click();
  await page.waitForTimeout(700);
  await page.locator('input').first().fill("Trị liệu ánh sáng sinh học");
  await page.waitForTimeout(200);

  await shot("b1-truoc-khi-tao-nhom");

  await clickText("+ Tạo nhóm mới");
  await page.locator('input[placeholder="Tên nhóm mới"]').fill("Trị liệu công nghệ cao");
  await page.waitForTimeout(300);
  await shot("b2-nhap-ten-nhom");

  const luu = page.locator('input[placeholder="Tên nhóm mới"]').locator("xpath=following-sibling::button[1]");
  await luu.dispatchEvent("click");
  await page.waitForTimeout(1400);
  await shot("b3-nhom-tu-duoc-chon");
} catch (e) { console.error("ERR", e.message, e.stack); }
finally { await browser.close(); }
