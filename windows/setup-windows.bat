@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo ============================================
echo   SOPHIA WELLNESS - Cai dat lan dau
echo ============================================
echo.
echo [1/4] Cai dat phu thuoc (npm install)...
call npm install || goto :err
echo.
echo [2/4] Tao bang trong PostgreSQL (prisma db push)...
call npm run prisma:push || goto :err
echo.
echo [3/4] Nap du lieu mau (db seed)...
echo   (Neu DB da co du lieu, buoc nay se bo qua - khong sao)
call npm run db:seed
echo.
echo [4/4] Build ban production...
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
