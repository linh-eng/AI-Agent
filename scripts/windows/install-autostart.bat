@echo off
REM ==========================================================================
REM  CAI DAT TU KHOI DONG webapp khi bat may (Windows).
REM  --> Chuot phai file nay, chon "Run as administrator".
REM  Viec nay se:
REM    1) Mo cong 9000 tren tuong lua (cho may khac trong mang truy cap).
REM    2) Tao tac vu tu chay webapp (an) moi khi dang nhap Windows.
REM ==========================================================================
setlocal

REM --- Kiem tra quyen Administrator ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo [!] Can quyen Administrator.
  echo     Hay CHUOT PHAI file nay va chon "Run as administrator".
  echo.
  pause
  exit /b 1
)

set "VBS=%~dp0run-hidden.vbs"

echo.
echo === 1/2: Mo cong 9000 tren tuong lua (mang noi bo) ===
netsh advfirewall firewall delete rule name="Sophia Wellness 9000" >nul 2>&1
netsh advfirewall firewall add rule name="Sophia Wellness 9000" dir=in action=allow protocol=TCP localport=9000 >nul
echo [OK] Da mo cong 9000.

echo.
echo === 2/2: Tao tu khoi dong khi dang nhap Windows ===
schtasks /create /tn "SophiaWellnessWebapp" /tr "wscript.exe \"%VBS%\"" /sc onlogon /rl highest /f
if %errorlevel% neq 0 (
  echo [!] Tao tac vu that bai. Vui llong thu lai voi quyen Administrator.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   HOAN TAT! Lan sau BAT MAY (va dang nhap Windows),
echo   webapp se TU CHAY o che do an.
echo.
echo   - May nay:    http://localhost:9000
echo   - May khac:   http://[DIA-CHI-IP-MAY-NAY]:9000
echo     (Xem IP bang lenh:  ipconfig  -> muc IPv4 Address)
echo.
echo   Muon chay thu NGAY BAY GIO ma khong can khoi dong lai:
echo   nhay doi file "run-hidden.vbs".
echo ============================================================
pause
