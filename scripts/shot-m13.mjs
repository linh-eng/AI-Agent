import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", BASE="http://localhost:3100";
const OUT="/tmp/claude-0/-home-user-AI-Agent/b21d6139-80c5-55eb-aa46-2d5f7a118bf4/scratchpad";
async function login(p,e,pw){ await p.goto(`${BASE}/login`,{waitUntil:"networkidle"}); await p.waitForTimeout(1000); await p.fill('input[type="email"]',e); await p.fill('input[type="password"]',pw); await p.click('button[type="submit"]'); await p.waitForTimeout(2500); }
const b=await chromium.launch({executablePath:CHROME});
const p=await (await b.newContext({viewport:{width:1360,height:1050}})).newPage();
await login(p,"quanly@sophia.com.vn","quanly123");
await p.goto(`${BASE}/settings`,{waitUntil:"networkidle"}); await p.waitForTimeout(1500);
await p.screenshot({path:`${OUT}/m13-settings.png`,fullPage:true});
await b.close(); console.log("DONE m13 shot");
