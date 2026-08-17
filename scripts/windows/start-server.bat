@echo off
REM ==========================================================================
REM  Khoi dong webapp Sophia Wellness (che do dev - tu bien dich khi co ban moi)
REM  Cong truy cap: http://localhost:9000  (may khac trong mang: http://IP:9000)
REM  DUNG DONG cua so nay khi dang chay (dong = tat webapp).
REM ==========================================================================
cd /d "%~dp0..\.."
title Sophia Wellness - Webapp (dang chay - khong dong cua so nay)
echo ============================================================
echo   Sophia Wellness - Webapp dang khoi dong...
echo   Truy cap:  http://localhost:9000
echo ============================================================
call npm run dev
echo.
echo (Webapp da dung. Nhan phim bat ky de dong cua so.)
pause >nul
