@echo off
chcp 65001 >nul
title Spa Wellness - UPDATE
cd /d "%~dp0.."

echo ============================================================
echo   CAP NHAT Webapp Spa Wellness
echo   (Chay sau khi da giai nen ban moi de len, giu nguyen .env)
echo ============================================================
echo.

REM --- DUNG app dang chay tren cong 9500 (de tranh khoa file Prisma) ---
REM     Chi tat dung tien trinh o cong 9500 - KHONG dung 3000/9000 cua app khac.
sc query SpaDemo >nul 2>nul && ( echo Dung service SpaDemo... & net stop SpaDemo >nul 2>nul )
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":9500" ^| findstr LISTENING') do (
  echo Dung tien trinh dang chay o cong 9500 ^(PID %%p^)...
  taskkill /PID %%p /F >nul 2>nul
)
timeout /t 2 /nobreak >nul

REM --- Neu dung git thi keo code moi ---
where git >nul 2>nul && ( echo Keo code moi tu git... & git pull )

echo [1/3] Cai dependencies (npm install)...
call npm install || goto :err

echo [2/3] Ap migration moi (khong mat du lieu)...
call npm run prisma:migrate:deploy || goto :err

echo [3/3] Build production...
call npm run build || goto :err

echo.
echo ============================================================
echo   XONG! Khoi dong lai bang  start-windows.bat
echo   (hoac restart service neu chay bang NSSM/pm2)
echo ============================================================
pause
exit /b 0

:err
echo.
echo *** CO LOI khi cap nhat - xem thong bao ben tren. ***
pause
exit /b 1
