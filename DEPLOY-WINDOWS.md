# Hướng dẫn cài đặt trên Windows 10 Pro

Dành cho việc chạy Sophia Wellness — Quản lý kho ngay trên máy Windows 10 Pro
(dùng một mình hoặc làm "máy chủ" cho các máy khác trong cùng mạng LAN/WiFi truy cập).

> Gợi ý: làm lần lượt từ Bước 1 → 6. Chỉ cần cài **1 lần**, sau đó mỗi ngày chỉ việc
> mở `start-windows.bat`.

---

## Bước 1 — Cài Node.js

1. Vào **https://nodejs.org** → tải bản **LTS** (nút bên trái, ví dụ 20.x).
2. Chạy file `.msi` vừa tải, bấm **Next** đến hết (giữ mặc định), **Install**.
3. Kiểm tra: mở **Command Prompt** (gõ `cmd` ở ô Tìm kiếm) rồi gõ:
   ```
   node -v
   ```
   Thấy hiện `v20.x.x` là được.

---

## Bước 2 — Cài PostgreSQL

1. Vào **https://www.postgresql.org/download/windows/** → bấm *"Download the installer"*
   → tải bản mới (ví dụ PostgreSQL 16).
2. Chạy file cài đặt:
   - Bấm **Next** qua các bước.
   - Ở màn hình **Password**: đặt mật khẩu cho tài khoản `postgres` (ví dụ `Sophia@123`)
     — **ghi nhớ mật khẩu này**.
   - **Port**: để mặc định `5432`.
   - Các bước còn lại giữ mặc định → **Next** → cài xong.

---

## Bước 3 — Tạo cơ sở dữ liệu

1. Ở ô Tìm kiếm Windows, gõ **SQL Shell (psql)** rồi mở.
2. Nhấn **Enter** liên tục để giữ mặc định (Server: localhost, Database: postgres,
   Port: 5432, Username: postgres), đến khi hỏi **Password** thì nhập mật khẩu ở Bước 2.
3. Khi thấy dấu nhắc `postgres=#`, gõ lệnh sau rồi Enter:
   ```sql
   CREATE DATABASE sophia_wellness;
   ```
   Thấy `CREATE DATABASE` là xong. Gõ `\q` để thoát.

---

## Bước 4 — Giải nén & cấu hình

1. Chuột phải file **`sophia-wellness.zip`** → **Extract All…** → chọn nơi lưu,
   ví dụ `C:\sophia`. (Sẽ có thư mục `C:\sophia\sophia-wellness`.)
2. Vào thư mục `C:\sophia\sophia-wellness`, tìm file **`.env.example`**,
   **copy** và đổi tên bản copy thành **`.env`**.
   > Nếu không thấy đuôi file: trong File Explorer bật **View → File name extensions**.
3. Mở file **`.env`** bằng **Notepad**, sửa cho đúng rồi **Lưu (Ctrl+S)**:
   ```env
   DATABASE_URL="postgresql://postgres:Sophia@123@localhost:5432/sophia_wellness?schema=public"
   AUTH_SECRET="dan-mot-chuoi-ngau-nhien-that-dai-vao-day"
   SESSION_MAX_AGE="28800"
   ```
   - Thay `Sophia@123` bằng đúng mật khẩu PostgreSQL ở Bước 2.
   - `AUTH_SECRET`: gõ một chuỗi ngẫu nhiên thật dài (chữ + số).

---

## Bước 5 — Cài đặt lần đầu (chạy 1 lần)

Mở thư mục **`windows`** bên trong (`C:\sophia\sophia-wellness\windows`) →
**bấm đúp** vào **`setup-windows.bat`**.

Cửa sổ đen sẽ tự chạy 4 bước (cài đặt → tạo bảng → nạp dữ liệu → build).
Chờ đến khi hiện **"HOAN TAT!"** rồi bấm phím bất kỳ để đóng.

> Nếu báo lỗi: kiểm tra lại mật khẩu trong `.env` và dịch vụ PostgreSQL đã chạy.

---

## Bước 6 — Khởi động ứng dụng

Bấm đúp **`start-windows.bat`** (trong thư mục `windows`).
Giữ nguyên cửa sổ đen đang chạy, rồi mở trình duyệt:

- Trên chính máy này: **http://localhost:3000**
- Đăng nhập: **admin@sophia.vn** / **admin123**

Muốn dừng: bấm vào cửa sổ đen rồi nhấn **Ctrl + C**, hoặc đóng cửa sổ.

---

## Cho máy khác trong mạng LAN truy cập

Nếu muốn nhân viên dùng máy/điện thoại khác (cùng WiFi/mạng nội bộ) truy cập:

1. **Xem IP máy chủ:** mở `cmd`, gõ `ipconfig`, tìm dòng **IPv4 Address**
   (ví dụ `192.168.1.50`).
2. **Mở cổng 3000 trên tường lửa** (mở **cmd với quyền Administrator** — chuột phải
   *Command Prompt* → *Run as administrator*), dán lệnh:
   ```
   netsh advfirewall firewall add rule name="Sophia 3000" dir=in action=allow protocol=TCP localport=3000
   ```
3. Máy khác mở trình duyệt vào: **http://192.168.1.50:3000** (đổi theo IP thật).

> `start-windows.bat` đã cấu hình lắng nghe mọi thiết bị trong LAN (`-H 0.0.0.0`).

---

## (Tùy chọn) Tự khởi động cùng Windows — chạy như dịch vụ nền

Để ứng dụng tự chạy nền và bật lại khi khởi động máy, dùng **NSSM**:

1. Tải **https://nssm.cc/download** → giải nén, lấy `nssm.exe` (thư mục `win64`).
2. Mở **cmd (Administrator)**, `cd` tới nơi chứa `nssm.exe`, chạy:
   ```
   nssm install SophiaWellness
   ```
3. Trong cửa sổ hiện ra:
   - **Path**: trỏ tới `start-windows.bat` (ví dụ `C:\sophia\sophia-wellness\windows\start-windows.bat`)
   - Bấm **Install service**.
4. Khởi động dịch vụ: `nssm start SophiaWellness`
   (Quản lý sau này: `nssm stop/restart SophiaWellness`, hoặc trong **Services.msc**.)

> Cách đơn giản hơn (không cần NSSM): tạo lối tắt của `start-windows.bat` bỏ vào thư mục
> khởi động — nhấn `Win + R`, gõ `shell:startup`, dán lối tắt vào đó.

---

## Cập nhật phiên bản mới

1. Giải nén bản zip mới, **giữ lại file `.env`** cũ (copy `.env` sang thư mục mới).
2. Bấm đúp lại **`setup-windows.bat`** (nó chạy lại install → prisma push → build).
3. Mở lại **`start-windows.bat`** (hoặc `nssm restart SophiaWellness`).

---

## Sao lưu dữ liệu (nên làm định kỳ)

Mở **cmd**, chạy (nhập mật khẩu khi được hỏi):
```
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -h localhost sophia_wellness > backup.sql
```
(Đổi `16` theo phiên bản PostgreSQL đã cài.)

---

## Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `node` không phải lệnh hợp lệ | Chưa cài Node hoặc chưa khởi động lại cmd — cài lại Bước 1, mở cmd mới |
| `Can't reach database server` | Sai mật khẩu trong `.env`, hoặc PostgreSQL chưa chạy (mở **Services.msc** → bật `postgresql-x64-16`) |
| Cửa sổ `.bat` hiện rồi tắt ngay | Bấm đúp để xem lỗi; thường do `.env` sai — sửa rồi chạy lại `setup-windows.bat` |
| Máy khác không vào được | Chưa mở cổng 3000 (làm phần LAN ở trên), hoặc khác mạng WiFi |
| Đăng nhập xong bị đá ra | `AUTH_SECRET` trống — điền vào `.env`, chạy lại `start-windows.bat` |

---

## Bảo mật (quan trọng)

- Đổi `AUTH_SECRET` thành chuỗi ngẫu nhiên dài.
- Đăng nhập `admin@sophia.vn` và **đổi mật khẩu tất cả tài khoản demo** ngay sau khi cài.

---

*Sophia Wellness — Hệ thống quản lý kho · Next.js 14 + Prisma + PostgreSQL.*
