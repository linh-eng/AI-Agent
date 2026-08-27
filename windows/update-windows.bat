@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo ============================================
echo   SOPHIA WELLNESS - Cap nhat phien ban moi
echo   (GIU NGUYEN du lieu - KHONG nap lai mau)
echo ============================================
echo.
echo [1/3] Cai dat phu thuoc (npm install)...
call npm install || goto :err
echo.
echo [2/3] Dong bo cau truc bang - them bang/cot moi (prisma db push)...
call npm run prisma:push || goto :err
echo.
echo [3/3] Build ban production...
call npm run build || goto :err
echo.
echo ============================================
echo   HOAN TAT! Chay "start-windows.bat" de mo ung dung.
echo ============================================
pause
exit /b 0

:err
echo.
echo *** CO LOI XAY RA ***
echo - Kiem tra file .env (DATABASE_URL dung mat khau/ten DB chua?)
echo - Kiem tra dich vu PostgreSQL da chay chua.
pause
exit /b 1
