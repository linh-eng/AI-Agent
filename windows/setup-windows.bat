@echo off
chcp 65001 >nul
title Spa Wellness - SETUP
cd /d "%~dp0.."

echo ============================================================
echo   CAI DAT Webapp Spa Wellness (chay 1 lan dau)
echo ============================================================
echo.

REM --- Tao file .env neu chua co ---
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Da tao file .env tu .env.example.
  echo.
  echo *** HAY SUA .env truoc khi tiep tuc: ***
  echo     DATABASE_URL  = postgresql://spa_user:MAT_KHAU@localhost:5432/spa_demo?schema=public
  echo     COOKIE_SECURE = false
  echo     PORT          = 9500
  echo     AUTH_SECRET / PORTAL_AUTH_SECRET = 2 chuoi ngau nhien
  echo.
  echo Notepad se mo ra. Sua xong nhan Ctrl+S, dong Notepad, roi quay lai cua so nay.
  notepad ".env"
  pause
)

echo [1/4] Cai dependencies (npm install)...
call npm install || goto :err

echo [2/4] Tao/cap nhat bang du lieu (migrate deploy)...
call npm run prisma:migrate:deploy || goto :err

echo [3/4] Nap du lieu (tai khoan + demo)...
call npm run db:seed || goto :err
call npm run db:seed:demo

echo [4/4] Build production...
call npm run build || goto :err

echo.
echo ============================================================
echo   XONG! Chay  start-windows.bat  de khoi dong webapp.
echo   Truy cap: http://172.168.11.60:9500   (Cong khach: /portal)
echo   Dang nhap: quanly@thng.com.vn / quanly123
echo ============================================================
pause
exit /b 0

:err
echo.
echo *** CO LOI khi cai dat - xem thong bao ben tren. ***
pause
exit /b 1
