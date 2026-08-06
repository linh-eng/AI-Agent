#!/bin/sh
# Khởi động: chờ PostgreSQL -> đồng bộ schema -> seed lần đầu -> chạy web.
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "⏳ Chờ PostgreSQL tại ${DB_HOST}:${DB_PORT}..."
until node -e "require('net').connect(${DB_PORT}, '${DB_HOST}').on('connect', () => process.exit(0)).on('error', () => process.exit(1))" 2>/dev/null; do
  sleep 2
done
echo "✅ PostgreSQL sẵn sàng."

echo "🔄 Đồng bộ schema (prisma db push)..."
npx prisma db push --skip-generate

# Seed dữ liệu mẫu chỉ ở lần chạy đầu (khi chưa có user nào)
USERS=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(c=>{console.log(c);return p.\$disconnect()}).catch(()=>{console.log(0)})" 2>/dev/null || echo 0)
if [ "$USERS" = "0" ]; then
  echo "🌱 Seed dữ liệu mẫu lần đầu..."
  npx tsx prisma/seed.ts
else
  echo "ℹ️  Đã có dữ liệu ($USERS user) — bỏ qua seed."
fi

echo "🚀 Khởi động web trên cổng ${PORT:-3000}..."
exec npm run start
