@echo off
chcp 65001 >nul
title Cai dat PM2 - May chu Ho tro THNG tu chay nen
cd /d "%~dp0"

echo ================================================================
echo   CAI DAT PM2 - de May chu Ho tro THNG tu chay nen
echo   (Chay file nay bang quyen Administrator)
echo ================================================================
echo.
echo  * LUU Y: Neu dang co cua so den chay "node server.js",
echo    hay DONG cua so do truoc (de tranh trung cong 3000).
echo.
pause

where node >nul 2>nul
if errorlevel 1 ( echo [!] Chua cai Node.js. Vao https://nodejs.org cai ban LTS roi chay lai. & pause & exit /b )

echo.
echo [1/5] Cai PM2 va tien ich tu khoi dong...
call npm install -g pm2 pm2-windows-startup

echo.
echo [2/5] Khoi dong ung dung bang PM2...
call pm2 delete ho-tro-thng >nul 2>nul
call pm2 start server.js --name ho-tro-thng

echo.
echo [3/5] Luu cau hinh...
call pm2 save

echo.
echo [4/5] Dang ky tu chay khi khoi dong may...
call pm2-startup install

echo.
echo [5/5] Luu lai lan cuoi...
call pm2 save

echo.
echo ================================================================
echo   HOAN TAT! May chu da chay nen va se tu bat khi mo may.
echo   - Mo trinh duyet:  http://localhost:3000
echo   - Xem trang thai:  pm2 list
echo   - Xem nhat ky loi: pm2 logs ho-tro-thng
echo   - Khoi dong lai:   pm2 restart ho-tro-thng
echo   - Tam dung:        pm2 stop ho-tro-thng
echo ================================================================
echo.
pause
