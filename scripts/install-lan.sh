#!/usr/bin/env bash
# =============================================================================
# Cài đặt Webapp Demo trên máy chủ nội bộ (LAN) — chạy 1 lần sau khi đã tạo .env.
# Yêu cầu: đã cài Node 18/20, PostgreSQL, và đã tạo file .env (xem docs/TRIEN_KHAI_NOI_BO.md).
# Cách dùng:  bash scripts/install-lan.sh
# =============================================================================
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "❌ Chưa có file .env. Hãy: cp .env.example .env  rồi sửa DATABASE_URL, AUTH_SECRET,"
  echo "   PORTAL_AUTH_SECRET, COOKIE_SECURE=false, PORT=9500 (xem docs/TRIEN_KHAI_NOI_BO.md)."
  exit 1
fi

echo "==> [1/5] Cài dependencies..."
npm install

echo "==> [2/5] Tạo/cập nhật bảng (prisma migrate deploy)..."
npm run prisma:migrate:deploy

echo "==> [3/5] Nạp dữ liệu nền (tài khoản + danh mục)..."
npm run db:seed

echo "==> [4/5] Nạp DỮ LIỆU DEMO (khách mẫu, JetPeel, vật tư khách...)? [Y/n]"
read -r ans
if [ "$ans" != "n" ] && [ "$ans" != "N" ]; then
  npm run db:seed:demo
fi

echo "==> [5/5] Build production..."
npm run build

echo ""
echo "✅ Xong. Khởi động app (chạy nền bằng pm2):"
echo "     pm2 start npm --name spa-demo -- run start:lan && pm2 save && pm2 startup"
echo "   Rồi mở:  http://172.168.11.60:9500  (nhân viên)  ·  /portal  (khách)"
echo "   Đăng nhập thử: quanly@thng.com.vn / quanly123"
