@echo off
chcp 65001 >nul
title He thong Ho tro THNG - May chu noi bo
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] Chua cai Node.js tren may nay.
  echo      Vui long tai va cai dat tai: https://nodejs.org  (ban LTS)
  echo      Sau do chay lai file nay.
  echo.
  pause
  exit /b
)

echo.
echo  Dang khoi dong may chu Ho tro THNG...
echo  (De cua so nay chay. Nhan Ctrl+C hoac dong cua so de dung.)
echo.
node server.js
pause
