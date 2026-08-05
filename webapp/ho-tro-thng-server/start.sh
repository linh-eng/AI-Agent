#!/usr/bin/env bash
# Khởi động máy chủ Hỗ trợ THNG (Linux / macOS)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  [!] Chưa cài Node.js. Cài đặt tại: https://nodejs.org (bản LTS)"
  echo "      Hoặc trên Ubuntu:  sudo apt install nodejs"
  echo
  exit 1
fi

echo
echo "  Đang khởi động máy chủ Hỗ trợ THNG... (Ctrl+C để dừng)"
echo
exec node server.js
