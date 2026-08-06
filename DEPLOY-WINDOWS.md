# Triển khai trên máy chủ WINDOWS (Node.js, không dùng Docker)

Dành cho máy chủ Windows đã có sẵn Node.js, chạy song song với các webapp khác.
Chọn một **cổng riêng chưa dùng** (ví dụ `3001`) để không đụng ứng dụng khác.

Kết quả: nhân viên trong mạng nội bộ mở `http://<IP-máy-chủ>:3001`.

---

## Bước 1 — Cài PostgreSQL (nếu máy chủ chưa có)

Webapp cần cơ sở dữ liệu PostgreSQL.

1. Tải bộ cài Windows tại: https://www.postgresql.org/download/windows/ (EDB installer).
2. Cài đặt, đặt **mật khẩu cho user `postgres`** (ghi nhớ lại).
3. Mở **SQL Shell (psql)** (cài kèm), Enter qua các dòng, nhập mật khẩu, rồi tạo DB:
   ```sql
   CREATE DATABASE thng_warehouse;
   ```
   (Có thể dùng **pgAdmin** giao diện đồ họa thay cho psql.)

> Nếu công ty đã có sẵn máy chủ PostgreSQL, chỉ cần tạo 1 database mới và lấy
> thông tin kết nối.

## Bước 2 — Chuẩn bị mã nguồn

1. Giải nén `thng-warehouse.zip` vào thư mục, ví dụ `C:\apps\thng-warehouse`.
2. Mở **PowerShell** tại thư mục đó (Shift + chuột phải trong thư mục → *Mở cửa sổ PowerShell tại đây*).

## Bước 3 — Cấu hình (.env)

Trong thư mục, tạo file tên `.env` (copy từ `.env.example`) với nội dung:

```ini
DATABASE_URL="postgresql://postgres:MAT_KHAU_POSTGRES@localhost:5432/thng_warehouse?schema=public"
AUTH_SECRET="dan-mot-chuoi-ngau-nhien-that-dai-vao-day"
COOKIE_SECURE="false"
SESSION_MAX_AGE="28800"
PORT="3001"
```

- Thay `MAT_KHAU_POSTGRES` bằng mật khẩu đã đặt ở Bước 1.
  (Nếu mật khẩu có ký tự đặc biệt như `@ : /` thì phải mã hóa URL, hoặc đổi mật khẩu đơn giản hơn.)
- `AUTH_SECRET`: tạo chuỗi ngẫu nhiên — chạy trong PowerShell:
  `[Convert]::ToBase64String((1..48 | ForEach-Object {Get-Random -Maximum 256}))`
- `COOKIE_SECURE="false"` **bắt buộc** vì chạy `http://` nội bộ.
- `PORT`: chọn cổng chưa dùng (ví dụ 3001).

## Bước 4 — Cài đặt & dựng bản chạy

Trong PowerShell (tại thư mục app), chạy lần lượt:

```powershell
npm install          # cài thư viện
npm run build        # dựng bản production
npm run db:setup     # tạo bảng + nạp dữ liệu mẫu (CHỈ chạy 1 lần)
```

Chạy thử:
```powershell
npm run start
```
Mở trình duyệt trên chính máy chủ: `http://localhost:3001` → thấy trang đăng nhập là OK.
Nhấn `Ctrl + C` để dừng, rồi sang Bước 5 để chạy nền lâu dài.

## Bước 5 — Chạy nền & tự bật khi khởi động Windows

### Cách A — NSSM (chạy như Windows Service, ổn định nhất) ⭐

1. Tải NSSM: https://nssm.cc/download → giải nén, lấy `nssm.exe` (bản win64).
2. Mở **PowerShell (Run as Administrator)**, chạy:
   ```powershell
   C:\path\to\nssm.exe install THNGKho
   ```
3. Trong cửa sổ NSSM hiện ra, điền:
   - **Application → Path:** `C:\Program Files\nodejs\node.exe`
   - **Application → Startup directory:** `C:\apps\thng-warehouse`
   - **Application → Arguments:** `node_modules\next\dist\bin\next start -H 0.0.0.0`
   - (Không cần đặt biến môi trường — app tự đọc file `.env`.)
   - Bấm **Install service**.
4. Khởi động dịch vụ:
   ```powershell
   nssm start THNGKho
   ```
   Dịch vụ sẽ **tự chạy lại mỗi khi bật máy**. Quản lý: `nssm start/stop/restart THNGKho`,
   gỡ: `nssm remove THNGKho confirm`.

### Cách B — pm2 (nếu chị quen dùng pm2 cho Node)

```powershell
npm install -g pm2 pm2-windows-startup
pm2-startup install
pm2 start node_modules/next/dist/bin/next --name THNGKho -- start -H 0.0.0.0
pm2 save
```

## Bước 6 — Mở firewall cho nhân viên truy cập

Mở **PowerShell (Administrator)**:
```powershell
New-NetFirewallRule -DisplayName "THNG Kho 3001" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```
(đổi 3001 cho khớp PORT đã chọn)

## Bước 7 — Nhân viên truy cập

1. Lấy IP máy chủ: PowerShell chạy `ipconfig` → xem dòng **IPv4 Address** (vd `192.168.1.50`).
2. Nhân viên mở trình duyệt: **`http://192.168.1.50:3001`**
3. Đăng nhập bằng tài khoản (danh sách demo ở cuối, **nhớ đổi mật khẩu**).

> Muốn dùng tên dễ nhớ (vd `http://kho`): nhờ IT thêm DNS nội bộ trỏ tên đó về IP máy chủ.

---

## Cập nhật phiên bản mới

```powershell
nssm stop THNGKho        # (hoặc: pm2 stop THNGKho)
# thay mã nguồn mới vào thư mục (giữ nguyên file .env)
npm install
npm run build
# nếu có thay đổi cấu trúc DB: npx prisma db push
nssm start THNGKho       # (hoặc: pm2 start THNGKho)
```

## Sao lưu dữ liệu (khuyên làm định kỳ)

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres thng_warehouse > backup_thng.sql
```

## ✅ Checklist bảo mật trước khi dùng thật

1. Đổi hết **mật khẩu tài khoản demo**; tạo user riêng cho từng nhân viên.
2. `AUTH_SECRET` phải là chuỗi ngẫu nhiên dài (đừng để giá trị mẫu).
3. Sao lưu database định kỳ.
4. (Tùy chọn) Đặt sau HTTPS bằng reverse proxy rồi đổi `COOKIE_SECURE="true"`.

## Tài khoản đăng nhập sau khi seed (ĐỔI MẬT KHẨU trước khi dùng thật)

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | admin@thng.com.vn | admin123 |
| Ban Giám đốc | bod@thng.com.vn | bod123 |
| Kế toán kho | ketoan@thng.com.vn | ketoan123 |
| Thủ kho | thukho@thng.com.vn | thukho123 |
| Kỹ thuật | kythuat@thng.com.vn | kythuat123 |
| Bảo hành | baohanh@thng.com.vn | baohanh123 |
| Mua hàng | muahang@thng.com.vn | muahang123 |
| QC | qc@thng.com.vn | qc123 |
| Kinh doanh | kinhdoanh@thng.com.vn | kinhdoanh123 |
