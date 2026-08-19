# Hướng dẫn cài đặt & cập nhật trên Windows (Sophia Care)

Phần mềm chạy trên máy chủ Windows (hoặc máy tính để bàn) trong **mạng nội bộ**,
truy cập qua trình duyệt tại cổng **9500**.

> Chỉ cần **bấm đúp** các file `.bat` ở thư mục gốc. Không cần gõ lệnh.

## Chuẩn bị 1 lần (phần mềm nền)
1. **Node.js 18 trở lên** — tải tại nodejs.org (bản LTS), cài mặc định.
2. **PostgreSQL 16** — tải tại postgresql.org, cài và nhớ mật khẩu `postgres`.
   - Tạo 1 cơ sở dữ liệu trống, ví dụ tên `spa_demo`.

## A. CÀI ĐẶT LẦN ĐẦU (máy mới)
1. Giải nén thư mục phần mềm vào ổ đĩa (ví dụ `D:\sophia-care`).
2. Bấm đúp **`CAI-DAT-LAN-DAU.bat`**.
   - Lần đầu nó sẽ mở Notepad để bạn sửa file `.env` — điền:
     - `DATABASE_URL = postgresql://postgres:MAT_KHAU@localhost:5432/spa_demo?schema=public`
     - `AUTH_SECRET` và `PORTAL_AUTH_SECRET` = 2 chuỗi ngẫu nhiên bất kỳ (mỗi cái ≥ 32 ký tự).
     - `COOKIE_SECURE = false` (khi chạy nội bộ HTTP).
   - Lưu Notepad (Ctrl+S), đóng lại, quay về cửa sổ đen nhấn phím bất kỳ.
   - Script tự: cài thư viện → tạo bảng dữ liệu → nạp tài khoản + dữ liệu mẫu → build.
3. Bấm đúp **`CHAY-WEBAPP.bat`** để khởi động.
   - Nhân viên truy cập: `http://<IP-máy-chủ>:9500`
   - Cổng khách: `http://<IP-máy-chủ>:9500/portal`
   - Đăng nhập quản lý: **quanly@sophia.com.vn / quanly123**

## B. CẬP NHẬT BẢN MỚI (giữ nguyên dữ liệu)
> **An toàn — KHÔNG mất dữ liệu.** Các bản cập nhật chỉ *thêm* bảng/cột (migration
> additive), không xóa dữ liệu cũ.

1. **Sao lưu trước cho chắc** (khuyến nghị): mở pgAdmin → Backup cơ sở dữ liệu,
   hoặc chạy `pg_dump`.
2. **Tắt webapp đang chạy** (đóng cửa sổ `CHAY-WEBAPP` nếu đang mở).
3. **Giải nén bản mới đè lên thư mục cũ** — khi được hỏi "Replace/Ghi đè?" chọn
   **Yes/Có cho tất cả**. (File `.env` của bạn được giữ nguyên vì bản nén không
   kèm `.env`.)
4. Bấm đúp **`CAP-NHAT.bat`**.
   - Script tự: dừng cổng 9500 → (git pull nếu có) → cài thư viện → **áp migration
     mới không mất dữ liệu** → build. Nếu có lỗi sẽ dừng và báo rõ.
5. Bấm đúp **`CHAY-WEBAPP.bat`** để chạy lại.

## Ghi chú
- **IP máy chủ**: đổi dòng hiển thị trong `windows\start-windows.bat` cho đúng IP
  thật của máy (ví dụ `192.168.1.50`). Xem IP bằng lệnh `ipconfig`.
- **Chạy nền như dịch vụ** (tự bật khi khởi động máy): dùng NSSM hoặc pm2 trỏ tới
  `npm run start:lan`. Khi đó `update` sẽ tự `net stop SpaDemo` nếu bạn đặt tên
  service là `SpaDemo`.
- **KHÔNG bao giờ** chạy lệnh `prisma migrate reset` (lệnh này xóa sạch dữ liệu).
- Bộ script chi tiết nằm trong thư mục `windows\`:
  - `setup-windows.bat` — cài lần đầu (kèm nạp dữ liệu mẫu).
  - `update-windows.bat` — cập nhật (KHÔNG nạp lại dữ liệu, KHÔNG reset).
  - `start-windows.bat` — khởi động.

## Sự cố thường gặp
- **"Port 9500 đang bận"**: đã có bản đang chạy — đóng nó rồi thử lại
  (`CAP-NHAT.bat` cũng tự dừng cổng 9500 trước khi cập nhật).
- **Không kết nối được DB**: kiểm tra `DATABASE_URL` trong `.env` (mật khẩu, tên
  DB) và PostgreSQL đã chạy chưa.
- **Máy khác không vào được**: mở firewall cho cổng 9500, và dùng đúng IP nội bộ
  của máy chủ (không phải `localhost`).
