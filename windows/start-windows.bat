@echo off
chcp 65001 >nul
cd /d "%~dp0.."
set PORT=9000
echo ============================================
echo   SOPHIA WELLNESS - Quan ly kho
echo ============================================
echo.
echo   May nay:  http://localhost:%PORT%
echo   May khac trong mang LAN: http://[IP-may-nay]:%PORT%
echo   (Xem IP bang lenh: ipconfig  - dong "IPv4 Address")
echo.
echo   Nhan Ctrl+C de dung. Dung dong cua so nay khi dang chay.
echo ============================================
echo.
npx next start -H 0.0.0.0 -p %PORT%
pause
