@echo off
REM ==========================================================================
REM  GO BO tu khoi dong webapp (chuot phai -> Run as administrator).
REM ==========================================================================
setlocal
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [!] Hay CHUOT PHAI file nay va chon "Run as administrator".
  pause
  exit /b 1
)

schtasks /delete /tn "SophiaWellnessWebapp" /f >nul 2>&1
echo [OK] Da go tu khoi dong.

netsh advfirewall firewall delete rule name="Sophia Wellness 9000" >nul 2>&1
echo [OK] Da dong lai cong 9000 tren tuong lua.
echo.
echo Da go xong. Webapp se KHONG tu chay khi bat may nua.
pause
