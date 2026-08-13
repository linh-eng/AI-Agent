# Hướng dẫn CẬP NHẬT phần mềm — KHÔNG MẤT DỮ LIỆU

> Áp dụng cho máy chủ Windows đang chạy Webapp (cổng **9500**). Bản cập nhật chỉ
> **thêm bảng/cột** (additive) — **không xoá dữ liệu**. Vẫn nên **sao lưu trước** cho chắc.

Xem phiên bản đang chạy ở góc dưới **thanh menu bên trái**, hoặc trang **Cài đặt → Phiên bản phần mềm**.

---

## Cách nhanh (khuyến nghị)

1. **Sao lưu database** (an toàn, ~30 giây):
   ```bat
   "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -d thng_warehouse -f D:\backup-truoc-cap-nhat.sql
   ```
   (nhập mật khẩu postgres khi được hỏi. Đổi tên DB nếu bạn đặt khác.)

2. **Giải nén bản mới đè lên thư mục hiện tại.** Khi được hỏi ghi đè → **Đồng ý (Replace)**.
   - ⚠️ **GIỮ NGUYÊN file `.env`** (không ghi đè). File `.env` chứa `DATABASE_URL`,
     `AUTH_SECRET`… của bạn — bản zip **không** kèm `.env` nên sẽ không đè mất.

3. **Bấm đúp `windows\update-windows.bat`.** Script tự động:
   - Dừng tiến trình đang chạy ở cổng 9500 (không đụng app khác),
   - `npm install` (cập nhật thư viện),
   - `npm run prisma:migrate:deploy` → **áp migration mới, giữ nguyên dữ liệu**,
   - `npm run build` (build bản mới).

4. **Khởi động lại**: chạy `windows\start-windows.bat` (hoặc restart service NSSM/pm2).

5. Mở trình duyệt, vào **Cài đặt → Phiên bản** kiểm tra đã lên phiên bản mới.

---

## Vì sao KHÔNG mất dữ liệu

- Cập nhật schema dùng **`prisma migrate deploy`** — chỉ chạy các migration **mới** theo thứ tự,
  toàn bộ là lệnh **thêm** (`CREATE TABLE/ADD COLUMN`), **0 lệnh xoá** (`DROP`).
- **KHÔNG** dùng `prisma migrate reset` hay `prisma db push --force` (những lệnh này mới xoá dữ liệu).
- Dữ liệu khách hàng, phác đồ, hoá đơn, thanh toán… nằm trong PostgreSQL — **không nằm trong thư mục app**,
  nên giải nén đè code KHÔNG ảnh hưởng dữ liệu.

## Nếu chạy bằng service (NSSM/pm2) thay vì .bat

```bat
net stop SpaDemo            &REM hoặc: pm2 stop spa-demo
npm install
npm run prisma:migrate:deploy
npm run build
net start SpaDemo          &REM hoặc: pm2 start spa-demo
```

## Khôi phục khi có sự cố (rất hiếm)

Nếu bước migrate báo lỗi và muốn quay lại nguyên trạng:
```bat
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d thng_warehouse -f D:\backup-truoc-cap-nhat.sql
```
rồi giải nén lại bản cũ. (Vì migration là additive nên trường hợp này gần như không xảy ra.)

## Lưu ý

- **KHÔNG chạy `npm run db:seed` khi cập nhật** — seed chỉ dùng cho **cài mới**. Chạy lại trên DB đang có
  dữ liệu sẽ báo trùng (nhưng seed có kiểm tra tồn tại nên không nhân đôi; vẫn không cần chạy).
- Lần cài **mới hoàn toàn** mới cần: `setup-windows.bat` → `db:seed` → (tuỳ chọn) `db:seed:demo`.
