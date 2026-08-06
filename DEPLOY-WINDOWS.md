# Triển khai trên máy chủ WINDOWS (Node.js, không dùng Docker)

Cấu hình cụ thể theo máy chủ của chị:
- **Webapp chạy cổng 7000** → nhân viên truy cập `http://<IP-máy-chủ>:7000`
- **PostgreSQL chạy cổng 5432** (mặc định, chỉ dùng nội bộ trong máy chủ — KHÁC cổng 7000)

Làm lần lượt Bước 1 → 7.

---

## BƯỚC 1 — Cài PostgreSQL (cơ sở dữ liệu)

### 1.1 Tải bộ cài
- Vào: **https://www.postgresql.org/download/windows/** → bấm *"Download the installer"* →
  chọn phiên bản mới (ví dụ **16.x**), bản **Windows x86-64**.

### 1.2 Chạy bộ cài (bấm Next theo thứ tự)
1. **Installation Directory**: để mặc định (`C:\Program Files\PostgreSQL\16`) → Next.
2. **Select Components**: giữ tích cả **PostgreSQL Server**, **pgAdmin 4**, **Command Line Tools** → Next.
3. **Data Directory**: để mặc định → Next.
4. **Password**: 👉 **đặt mật khẩu cho user `postgres`** — ví dụ `Thng@2026`.
   **GHI NHỚ mật khẩu này** (sẽ dùng ở Bước 3). → Next.
5. **Port**: để **`5432`** (mặc định) → Next.
6. **Locale**: để **Default locale** → Next → Next → cài đặt → Finish.
   (Nếu hỏng "Stack Builder" ở cuối thì **bỏ tích**, không cần.)

### 1.3 Tạo database cho webapp
Mở **Start menu → gõ "SQL Shell (psql)"** → mở lên. Nhấn **Enter** liên tục để chấp nhận
mặc định (Server: localhost, Database: postgres, Port: 5432, Username: postgres), đến khi
nó hỏi **Password** thì gõ mật khẩu vừa đặt (khi gõ sẽ không hiện ký tự — cứ gõ rồi Enter).

Khi thấy dấu nhắc `postgres=#`, gõ đúng dòng sau rồi Enter:
```sql
CREATE DATABASE thng_warehouse;
```
Thấy chữ `CREATE DATABASE` là xong. Gõ `\q` rồi Enter để thoát.

> ✅ Xong PostgreSQL. Ghi lại 2 thứ: **mật khẩu postgres** và tên DB **thng_warehouse**.

---

## BƯỚC 2 — Chuẩn bị mã nguồn

1. Giải nén `thng-warehouse.zip` vào thư mục, ví dụ **`C:\apps\thng-warehouse`**.
2. Vào thư mục đó, **Shift + chuột phải** vào khoảng trống → *"Mở cửa sổ PowerShell tại đây"*
   (hoặc *"Open in Terminal"*).

## BƯỚC 3 — Tạo file cấu hình `.env`

Trong thư mục app, tạo file tên **`.env`** (copy từ `.env.example` rồi sửa). Nội dung:

```ini
DATABASE_URL="postgresql://postgres:Thng@2026@localhost:5432/thng_warehouse?schema=public"
AUTH_SECRET="dan-mot-chuoi-ngau-nhien-that-dai-vao-day"
COOKIE_SECURE="false"
SESSION_MAX_AGE="28800"
PORT="7000"
```

- Thay **`Thng@2026`** bằng đúng mật khẩu postgres của chị.
  ⚠️ Nếu mật khẩu có ký tự `@ : / #` thì phải mã hóa (vd `@` → `%40`), hoặc
  **đặt mật khẩu chỉ gồm chữ và số** cho đơn giản (khuyên dùng cách này).
- `AUTH_SECRET`: tạo chuỗi ngẫu nhiên — chạy trong PowerShell rồi dán kết quả vào:
  ```powershell
  [Convert]::ToBase64String((1..48 | ForEach-Object {Get-Random -Maximum 256}))
  ```
- `PORT="7000"` — cổng webapp (nhân viên truy cập).
- `COOKIE_SECURE="false"` — **bắt buộc** vì chạy http:// nội bộ.

## BƯỚC 4 — Cài đặt & dựng bản chạy

Trong PowerShell (tại thư mục app), chạy lần lượt (mỗi lệnh chờ xong mới chạy tiếp):

```powershell
npm install          # cài thư viện (vài phút)
npm run build        # dựng bản production
npm run db:setup     # tạo bảng + nạp dữ liệu mẫu (CHỈ chạy 1 lần đầu)
```

Chạy thử:
```powershell
npm run start
```
Mở trình duyệt trên máy chủ: **`http://localhost:7000`** → thấy trang đăng nhập là OK.
Đăng nhập thử `admin@thng.com.vn` / `admin123`. Xong nhấn **Ctrl + C** để dừng, sang Bước 5.

## BƯỚC 5 — Chạy nền & tự bật khi khởi động Windows (NSSM)

Để webapp **luôn chạy** kể cả khi đóng cửa sổ / khởi động lại máy:

1. Tải **NSSM**: https://nssm.cc/download → giải nén → lấy file `nssm.exe` trong thư mục **win64**
   (ví dụ để ở `C:\apps\nssm.exe`).
2. Mở **PowerShell (Run as Administrator)** — chuột phải PowerShell → *Run as administrator*. Chạy:
   ```powershell
   C:\apps\nssm.exe install THNGKho
   ```
3. Cửa sổ NSSM hiện ra, tab **Application** điền:
   - **Path:** `C:\Program Files\nodejs\node.exe`
   - **Startup directory:** `C:\apps\thng-warehouse`
   - **Arguments:** `node_modules\next\dist\bin\next start -H 0.0.0.0`
   - Bấm **Install service**.
   *(Không cần điền biến môi trường — app tự đọc file `.env`, gồm cả PORT=7000.)*
4. Khởi động dịch vụ:
   ```powershell
   C:\apps\nssm.exe start THNGKho
   ```
   Từ nay webapp tự chạy mỗi khi bật máy. Lệnh quản lý:
   `nssm restart THNGKho`, `nssm stop THNGKho`, gỡ: `nssm remove THNGKho confirm`.

## BƯỚC 6 — Mở firewall cổng 7000

Mở **PowerShell (Administrator)** chạy:
```powershell
New-NetFirewallRule -DisplayName "THNG Kho 7000" -Direction Inbound -Protocol TCP -LocalPort 7000 -Action Allow
```

## BƯỚC 7 — Nhân viên truy cập

1. Lấy IP máy chủ: PowerShell gõ `ipconfig` → xem dòng **IPv4 Address** (vd `192.168.1.50`).
2. Nhân viên mở trình duyệt: **`http://192.168.1.50:7000`**
3. Đăng nhập bằng tài khoản (danh sách cuối trang — **nhớ đổi mật khẩu trước khi dùng thật**).

> Muốn dùng tên dễ nhớ (vd `http://kho`): nhờ IT thêm bản ghi DNS nội bộ trỏ về IP máy chủ.

---

## Cập nhật phiên bản mới về sau

```powershell
C:\apps\nssm.exe stop THNGKho
# thay mã nguồn mới vào thư mục (GIỮ NGUYÊN file .env)
npm install
npm run build
# nếu có thay đổi cấu trúc DB: npx prisma db push
C:\apps\nssm.exe start THNGKho
```

## Sao lưu dữ liệu (khuyên làm định kỳ)

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres thng_warehouse > C:\backup\thng_$(Get-Date -Format yyyyMMdd).sql
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
