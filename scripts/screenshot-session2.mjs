import { chromium } from "playwright-core";
import fs from "node:fs";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3300";
const OUT = process.argv[2] || "/tmp/session-shots2";
const SS1 = process.argv[3], SS3 = process.argv[4], SS2 = process.argv[5];
fs.mkdirSync(OUT, { recursive: true });
const STAFF = { email: "quanly@sophia.com.vn", password: "quanly123" };
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1250, height: 900 }, locale: "vi-VN", deviceScaleFactor: 1.4 });
const page = await ctx.newPage();
async function go(u) { await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {}); }
// chụp Card (Block) chứa tiêu đề `title`
async function shotBlock(title, name) {
  const h = page.getByRole("heading", { name: title }).first();
  const card = h.locator("xpath=ancestor::*[contains(@class,'rounded')][1]");
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await card.screenshot({ path: `${OUT}/${name}.png` }).catch(async () => { await page.screenshot({ path: `${OUT}/${name}.png` }); });
  console.log("OK", name);
}

try {
  await go("/login");
  await page.fill('input[type="email"]', STAFF.email);
  await page.fill('input[type="password"]', STAFF.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // Điểm 1+2: vật tư thực tế nguồn+container+tồn trước/sau (SS-100001: JetPeel 100→95 + Vật tư khách hàng)
  await go(`/sessions/${SS1}`); await page.waitForTimeout(1000);
  await shotBlock("Vật tư sử dụng", "10-vat-tu-ss1");
  // Điểm 2 (multi-session): cùng lọ JETPEEL ở buổi 2 (88→82)
  if (SS2) { await go(`/sessions/${SS2}`); await page.waitForTimeout(1000); await shotBlock("Vật tư sử dụng", "11-vat-tu-ss2"); }

  // Điểm 3: Before/After gắn Session + Khách thấy/Riêng tư (SS-100003 khối F)
  await go(`/sessions/${SS3}`); await page.waitForTimeout(1000);
  await shotBlock("Sau khi thực hiện", "12-before-after-share");

  // Điểm 4: THỰC HIỆN Sửa ghi nhận thật rồi chụp Lịch sử chỉnh sửa
  await page.getByRole("button", { name: /Sửa ghi nhận/ }).first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="Lý do sửa..."]').fill("Bổ sung đề xuất buổi kế theo yêu cầu bác sĩ");
  // đổi 1 field (Đề xuất buổi tiếp theo) trong khối F
  const fld = page.locator('input').filter({ hasNot: page.locator('[placeholder="Lý do sửa..."]') });
  // tìm ô "Đề xuất buổi tiếp theo": lấy input kế nhãn
  await page.getByText("Đề xuất buổi tiếp theo").first().scrollIntoViewIfNeeded();
  const nextInput = page.getByText("Đề xuất buổi tiếp theo").first().locator("xpath=following::input[1]");
  await nextInput.fill("Buổi 4 RF củng cố sau 7 ngày + theo dõi vùng cằm");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Lưu chỉnh sửa/ }).first().click();
  await page.waitForTimeout(1500);
  await shotBlock("Lịch sử chỉnh sửa", "13-lich-su-chinh-sua");
} catch (e) { console.error("ERR", e.message, e.stack); }
finally { await browser.close(); }
