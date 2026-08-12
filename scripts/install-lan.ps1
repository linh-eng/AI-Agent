# =============================================================================
# Cai dat Webapp Demo tren may chu WINDOWS (LAN) — chay 1 lan sau khi da tao .env.
# Yeu cau: da cai Node 18/20 + PostgreSQL, va da tao file .env.
# Cach chay (PowerShell, tai thu muc du an):
#     powershell -ExecutionPolicy Bypass -File scripts\install-lan.ps1
# =============================================================================
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".env")) {
  Write-Host "[X] Chua co file .env. Hay: copy .env.example .env  roi sua DATABASE_URL," -ForegroundColor Red
  Write-Host "    AUTH_SECRET, PORTAL_AUTH_SECRET, COOKIE_SECURE=false, PORT=8000." -ForegroundColor Red
  exit 1
}

Write-Host "==> [1/5] Cai dependencies..." -ForegroundColor Cyan
npm install

Write-Host "==> [2/5] Tao/cap nhat bang (prisma migrate deploy)..." -ForegroundColor Cyan
npm run prisma:migrate:deploy

Write-Host "==> [3/5] Nap du lieu nen (tai khoan + danh muc)..." -ForegroundColor Cyan
npm run db:seed

$ans = Read-Host "==> [4/5] Nap DU LIEU DEMO (khach mau, JetPeel, vat tu khach...)? [Y/n]"
if ($ans -ne "n" -and $ans -ne "N") { npm run db:seed:demo }

Write-Host "==> [5/5] Build production..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "[OK] Xong. Khoi dong app:" -ForegroundColor Green
Write-Host "     npm run start:lan"
Write-Host "   Hoac chay nen bang pm2:  pm2 start npm --name spa-demo -- run start:lan ; pm2 save"
Write-Host "   Roi mo:  http://172.168.11.60:8000  (nhan vien)  |  /portal  (khach)"
Write-Host "   Dang nhap thu: quanly@thng.com.vn / quanly123"
