@echo off
chcp 65001 >nul
title Spa Wellness - RUNNING (cong 9500)
cd /d "%~dp0.."

echo ============================================================
echo   Khoi dong Webapp Spa Wellness - cong 9500
echo   Nhan vien:  http://172.168.11.60:9500
echo   Cong khach: http://172.168.11.60:9500/portal
echo   (Dong cua so nay se TAT webapp)
echo ============================================================
echo.

call npm run start:lan

echo.
echo Webapp da dung. Nhan phim bat ky de dong.
pause >nul
