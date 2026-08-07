# Hướng dẫn cập nhật & chạy bản mới (v1.5)

Áp dụng cho máy chủ **Windows** (Node.js, PostgreSQL, cổng **7000**, không dùng Docker).

> Bản v1.5 **thêm nhiều bảng/cột dữ liệu mới**. Vì vậy sau khi lấy code mới, bắt buộc chạy
> `npx prisma db push` để nạp schema mới vào database. Thao tác này **chỉ thêm**, không xoá
> dữ liệu cũ. Bỏ qua bước này sẽ gặp lỗi **"Lỗi máy chủ"** khi đăng nhập.

---

## Bước 0 — Dừng ứng dụng đang chạy

- Nếu đang chạy bằng cửa sổ lệnh (PowerShell): bấm **Ctrl + C** trong cửa sổ đó.
- Nếu chạy bằng dịch vụ NSSM: mở PowerShell **quyền Administrator** và gõ:
  ```powershell
  nssm stop THNGKho
  ```
  (thay `THNGKho` bằng đúng tên dịch vụ chị đã tạo)

---

## Bước 1 — Kiểm tra file `.env` (rất quan trọng)

Mở file `.env` trong thư mục dự án. Dòng `DATABASE_URL` phải **mã hoá ký tự `$`** trong mật khẩu.

Mật khẩu `THNG$09xx` → viết thành `THNG%24%2409xx` (mỗi dấu `$` = `%24`):

```
DATABASE_URL="postgresql://postgres:THNG%24%2409xx@localhost:5432/thng_warehouse"
AUTH_SECRET="chuỗi-bí-mật-đã-đặt-trước-đó"
PORT=7000
COOKIE_SECURE=false
```

> Nếu dòng này sai, lệnh `prisma db push` ở Bước 3 sẽ **không kết nối được** database.

---

## Bước 2 — Lấy code mới

Mở PowerShell tại thư mục dự án (ví dụ `C:\THNG\AI-Agent`):

```powershell
cd C:\THNG\AI-Agent
git fetch origin
git checkout claude/thng-warehouse-management-ovqy6h
git pull origin claude/thng-warehouse-management-ovqy6h
npm install
```

---

## Bước 3 — Nạp schema mới vào database (BẮT BUỘC)

```powershell
npx prisma db push
```

Chạy đúng khi thấy dòng:
```
Your database is now in sync with your Prisma schema
```

- Nếu báo **Can't reach database server** → xem lại Bước 1 (mật khẩu trong `.env`) và kiểm tra
  dịch vụ PostgreSQL đang chạy (Services → `postgresql-x64-…` → Running).

---

## Bước 4 — (Tuỳ chọn) Bổ sung Part Number / Model cho sản phẩm

Bản v1.5 siết quy tắc nhận dạng: **hàng serial phải có Part Number + Model** mới nhập kho được.

- **Nếu database đang có dữ liệu thật:** KHÔNG chạy seed. Vào menu **Sản phẩm**, bổ sung
  *Part Number* và *Model* cho các mã đang dùng.
- **Nếu chỉ đang chạy thử / dữ liệu mẫu:** có thể chạy để cập nhật sẵn P/N + giá vốn cho 6 sản phẩm mẫu:
  ```powershell
  npm run db:seed
  ```

---

## Bước 5 — Build lại và khởi động

```powershell
npm run build
```

Khởi động:

- Chạy trực tiếp (cửa sổ lệnh mở suốt):
  ```powershell
  npx next start -H 0.0.0.0 -p 7000
  ```
- Hoặc bật lại dịch vụ NSSM:
  ```powershell
  nssm start THNGKho
  ```

---

## Bước 6 — Kiểm tra

1. Mở trình duyệt: `http://<địa-chỉ-IT-cấp>:7000`
2. Đăng nhập `admin@thng.com.vn` / `admin123`.
3. Menu bên trái xuất hiện mục mới **"Yêu cầu"** (ngay dưới *Tổng quan*).
4. Vào **Yêu cầu → Tạo yêu cầu** để thử tạo một yêu cầu xuất/nhập.

---

## Nếu vẫn báo "Lỗi máy chủ"

Xem dòng lỗi thật trong cửa sổ terminal đang chạy server (hoặc file log NSSM):

- `The column ... does not exist` → chưa chạy `npx prisma db push` (làm lại Bước 3).
- `Can't reach database server` → sai mật khẩu trong `.env` (Bước 1) hoặc PostgreSQL chưa chạy.
- `password authentication failed` → mật khẩu DB sai / chưa mã hoá `$` thành `%24`.

Chụp đúng dòng lỗi đó gửi lại để được hỗ trợ chính xác.

---

## Tóm tắt nhanh (copy-paste một lượt)

```powershell
# 0. Dừng server cũ (Ctrl+C hoặc: nssm stop THNGKho)
cd C:\THNG\AI-Agent
git pull origin claude/thng-warehouse-management-ovqy6h
npm install
npx prisma db push        # BẮT BUỘC — nạp bảng/cột mới
npm run build
npx next start -H 0.0.0.0 -p 7000
```
