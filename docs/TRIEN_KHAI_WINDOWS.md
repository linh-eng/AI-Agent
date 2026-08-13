# Triển khai Webapp Demo trên MÁY CHỦ WINDOWS 10 Pro (LAN)

> Chạy webapp này trên máy chủ Windows `172.168.11.60` để mọi máy trong mạng nội bộ truy cập,
> **chạy cạnh** 2 webapp sẵn có, dùng **cổng 9500** và **database riêng** nên không xung đột:
> - Webapp Hỗ Trợ — `172.168.11.60:3000`
> - Webapp Kho Sophia — `172.168.11.60:9000`
>
> Sau khi chạy xong:
> - Nhân viên: **http://172.168.11.60:9500**
> - Cổng khách: **http://172.168.11.60:9500/portal**

Tất cả lệnh chạy trong **PowerShell** (bấm Start → gõ *PowerShell* → chuột phải **Run as administrator**).

---

## 1. Cài phần mềm cần có (nếu máy chủ chưa có)

### 1.1. Node.js
- Tải **Node.js LTS 20** (bản Windows .msi) tại https://nodejs.org → cài (Next → Next).
- Kiểm tra: mở PowerShell mới, gõ:
  ```powershell
  node -v
  npm -v
  ```

### 1.2. PostgreSQL
- **Nếu máy chủ ĐÃ có PostgreSQL** (2 webapp kia có thể đang dùng): **KHÔNG cần cài lại**, chỉ
  cần biết mật khẩu user `postgres` và cổng (thường 5432). Bỏ qua bước cài, sang mục 2.
- **Nếu CHƯA có**: tải **PostgreSQL 16 Windows** tại
  https://www.enterprisedb.com/downloads/postgres-postgresql-downloads → cài. Khi cài nó hỏi:
  - Mật khẩu cho user **postgres** → **ghi nhớ** (sẽ dùng ở mục 2/3).
  - Cổng → để mặc định **5432**.
  - Kèm theo **pgAdmin 4** (công cụ đồ họa quản lý DB).

## 2. Tạo database riêng cho webapp

Mở **SQL Shell (psql)** (Start → gõ *psql*), nhấn Enter qua các dòng Server/Database/Port/Username
để lấy mặc định, nhập **mật khẩu postgres**. Rồi dán:
```sql
CREATE DATABASE spa_demo;
CREATE USER spa_user WITH PASSWORD 'DoiMatKhauNay';
GRANT ALL PRIVILEGES ON DATABASE spa_demo TO spa_user;
\c spa_demo
GRANT ALL ON SCHEMA public TO spa_user;
\q
```
> Có thể làm bằng **pgAdmin** (chuột phải Databases → Create → Database `spa_demo`) nếu quen giao diện.

## 3. Giải nén mã nguồn + tạo file cấu hình

1. Giải nén `spa-demo-webapp.zip` vào thư mục, ví dụ **`C:\spa-demo`** (chuột phải → Extract All).
2. Mở PowerShell tại đó:
   ```powershell
   cd C:\spa-demo
   copy .env.example .env
   notepad .env
   ```
3. Trong Notepad, sửa/đảm bảo các dòng sau rồi **Save** (⚠️ `COOKIE_SECURE=false` bắt buộc vì chạy HTTP):
   ```
   NODE_ENV=production
   COOKIE_SECURE=false
   PORT=9500
   APP_URL=http://172.168.11.60:9500
   NEXT_PUBLIC_APP_URL=http://172.168.11.60:9500
   DATABASE_URL=postgresql://spa_user:DoiMatKhauNay@localhost:5432/spa_demo?schema=public
   AUTH_SECRET=chuoi_ngau_nhien_dai_1
   PORTAL_AUTH_SECRET=chuoi_ngau_nhien_dai_2
   STORAGE_DRIVER=local
   STORAGE_DIR=./var/uploads
   ```
   Sinh 2 chuỗi ngẫu nhiên (chạy 2 lần trong PowerShell):
   ```powershell
   [Convert]::ToBase64String((1..48 | ForEach-Object {Get-Random -Max 256}))
   ```

## 4. Cài đặt + tạo bảng + nạp dữ liệu + build (1 lệnh)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-lan.ps1
```
Script sẽ tự: `npm install` → tạo bảng (10 migration) → nạp tài khoản/dữ liệu nền →
(hỏi) nạp **dữ liệu DEMO** → `npm run build`. Chờ hoàn tất (vài phút lần đầu).

> Nếu muốn làm thủ công từng bước:
> ```powershell
> npm install
> npm run prisma:migrate:deploy
> npm run db:seed
> npm run db:seed:demo      # tùy chọn (dữ liệu demo khách/JetPeel/vật tư khách)
> npm run build
> ```

## 5. Chạy webapp

### Cách A — chạy nhanh để thử (cửa sổ PowerShell mở):
```powershell
npm run start:lan
```
Mở trình duyệt **http://172.168.11.60:9500**. (Đóng cửa sổ là app tắt — dùng cách B để chạy nền.)

### Cách B — chạy NỀN, tự bật khi khởi động máy (khuyến nghị)

**Dùng NSSM (chạy như Windows Service — ổn định nhất):**
1. Tải **nssm** tại https://nssm.cc/download → giải nén, lấy `win64\nssm.exe` (ví dụ để `C:\nssm\nssm.exe`).
2. Cài service (PowerShell **Run as administrator**):
   ```powershell
   C:\nssm\nssm.exe install SpaDemo "C:\Program Files\nodejs\npm.cmd" "run start:lan"
   C:\nssm\nssm.exe set SpaDemo AppDirectory C:\spa-demo
   C:\nssm\nssm.exe set SpaDemo Start SERVICE_AUTO_START
   C:\nssm\nssm.exe start SpaDemo
   ```
   Quản lý sau này: `nssm restart SpaDemo` · `nssm stop SpaDemo` · gỡ: `nssm remove SpaDemo confirm`.

**Hoặc dùng pm2 (nếu quen Node):**
```powershell
npm install -g pm2 pm2-windows-startup
pm2 start npm --name spa-demo -- run start:lan
pm2 save
pm2-startup install
```

## 6. Mở cổng 9500 trên Windows Firewall

PowerShell **Run as administrator**:
```powershell
netsh advfirewall firewall add rule name="Spa Demo 9500" dir=in action=allow protocol=TCP localport=9500
```

## 7. Kiểm tra
- Trên máy chủ: mở http://localhost:9500 → thấy trang đăng nhập.
- Từ máy khác trong LAN: http://172.168.11.60:9500
- Đăng nhập: **quanly@sophia.com.vn / quanly123** (nhân viên). Cổng khách `/portal`:
  **linh.do@example.com / khach123**.

---

## Cập nhật phiên bản mới
Giải nén bản mới đè lên `C:\spa-demo` (giữ nguyên file `.env` và thư mục `var\uploads`), rồi:
```powershell
cd C:\spa-demo
npm install
npm run prisma:migrate:deploy
npm run build
nssm restart SpaDemo        # hoặc: pm2 restart spa-demo
```

## Sao lưu
```powershell
# Database (cần pg_dump trong thư mục PostgreSQL\16\bin):
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -Fc "postgresql://spa_user:DoiMatKhauNay@localhost:5432/spa_demo" -f C:\backup\spa_demo.dump
# Anh/tep dinh kem:
Compress-Archive C:\spa-demo\var\uploads C:\backup\uploads.zip
```

## Không đụng 2 webapp đang chạy
- Cổng **9500** khác 3000/9000 · **database riêng `spa_demo`** · nếu dùng chung PostgreSQL vẫn an
  toàn vì khác database.

## Ghi chú
- Bản demo dùng **STORAGE_DRIVER=local** (ảnh lưu trong `C:\spa-demo\var\uploads`).
- Chạy HTTP trong LAN (không HTTPS) nên **COOKIE_SECURE=false**. Khi nào có HTTPS thì đổi `true`.
- Không đưa dữ liệu khách thật vào bản demo. Đưa ra Internet/production: xem `docs\STAGING.md`.
