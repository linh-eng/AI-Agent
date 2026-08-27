@echo off
chcp 65001 >nul
REM ==========================================================================
REM  KHOI DONG LAI webapp sau khi cap nhat (giai nen de ban moi).
REM  --> CHUOT PHAI file nay, chon "Run as administrator".
REM  Viec nay se: (1) tat server cu dang chay, (2) chay lai ban moi.
REM ==========================================================================
setlocal

REM --- Kiem tra quyen Administrator (can de tat duoc server tu khoi dong) ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo [!] Can quyen Administrator de tat server cu.
  echo     Hay CHUOT PHAI file nay va chon "Run as administrator".
  echo.
  pause
  exit /b 1
)

echo === 1/2: Tat server cu (Node.js) ===
taskkill /F /IM node.exe >nul 2>&1
echo [OK] Da tat server cu (neu co).
echo.

REM Ve thu muc goc du an (file nay nam trong scripts\windows\)
cd /d "%~dp0..\.."
echo Thu muc du an: %cd%
echo.

echo === 2/2: Khoi dong ban moi ===
echo (Doi toi dong "Ready on http://localhost:9000" roi mo trinh duyet, bam Ctrl+F5)
echo.
call npm run dev

pause
