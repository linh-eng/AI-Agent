# Hướng dẫn cài đặt Sophia Wellness — Quản lý kho trên máy chủ

Tài liệu hướng dẫn triển khai webapp lên máy chủ (khuyến nghị Ubuntu 22.04 trở lên).
Ứng dụng chạy trên **Next.js 14** (Node) + **PostgreSQL**.

---

## 1. Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Node.js | 18 LTS (khuyến nghị 20) | chạy ứng dụng & build |
| PostgreSQL | 14+ | cơ sở dữ liệu |
| RAM | 1 GB (khuyến nghị 2 GB) | đủ để build & chạy |
| Ổ đĩa | ~1 GB | mã nguồn + node_modules |

---

## 2. Cài đặt phần mềm nền (Ubuntu)

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài Node.js 20 (qua NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Cài PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Kiểm tra
node -v      # v20.x
psql --version
```

---

## 3. Tạo cơ sở dữ liệu

```bash
sudo -u postgres psql
```

Trong `psql`, chạy (đổi mật khẩu mạnh thay cho `MAT_KHAU_MANH`):

```sql
CREATE DATABASE sophia_wellness;
CREATE USER sophia WITH ENCRYPTED PASSWORD 'MAT_KHAU_MANH';
GRANT ALL PRIVILEGES ON DATABASE sophia_wellness TO sophia;
\c sophia_wellness
GRANT ALL ON SCHEMA public TO sophia;
\q
```

---

## 4. Giải nén & cấu hình ứng dụng

```bash
# Giải nén source vào thư mục (ví dụ /opt/sophia)
sudo mkdir -p /opt/sophia && sudo chown $USER:$USER /opt/sophia
unzip sophia-wellness.zip -d /opt/sophia
cd /opt/sophia

# Tạo file cấu hình .env từ mẫu
cp .env.example .env
nano .env
```

Nội dung `.env` cần chỉnh:

```env
# Kết nối DB — dùng đúng user/mật khẩu/tên DB đã tạo ở bước 3
DATABASE_URL="postgresql://sophia:MAT_KHAU_MANH@localhost:5432/sophia_wellness?schema=public"

# Chuỗi bí mật ký JWT — BẮT BUỘC đổi thành chuỗi ngẫu nhiên dài
AUTH_SECRET="dan-mot-chuoi-ngau-nhien-that-dai-vao-day"

# Thời gian sống của phiên đăng nhập (giây) — mặc định 8 giờ
SESSION_MAX_AGE="28800"
```

> Sinh nhanh một `AUTH_SECRET` ngẫu nhiên: `openssl rand -base64 48`
>
> ⚠️ Nếu mật khẩu DB có ký tự đặc biệt, phải mã hóa trong `DATABASE_URL`:
> `@`→`%40`, `:`→`%3A`, `/`→`%2F`, `#`→`%23`, `?`→`%3F` (nếu không sẽ gặp lỗi
> `P1000: Authentication failed`). Đơn giản nhất: đặt mật khẩu chỉ gồm chữ và số.

---

## 5. Cài đặt phụ thuộc, tạo bảng, nạp dữ liệu

```bash
cd /opt/sophia

npm install            # cài phụ thuộc (tự chạy prisma generate)
npm run prisma:push    # tạo bảng theo schema vào PostgreSQL
npm run db:seed        # nạp dữ liệu mẫu + tài khoản demo
npm run build          # build bản production
```

> **Chỉ nạp `db:seed` lần đầu.** Nếu là dữ liệu thật, có thể bỏ qua bước seed và tự tạo
> tài khoản/danh mục trong ứng dụng.

---

## 6. Chạy ứng dụng

### Cách A — Chạy nhanh (thử nghiệm)

```bash
npm run start        # chạy ở cổng 9000 → http://<IP-máy-chủ>:9000
```

### Cách B — Chạy nền ổn định với PM2 (khuyến nghị)

```bash
sudo npm install -g pm2

cd /opt/sophia
pm2 start npm --name sophia -- run start
pm2 save                       # lưu danh sách tiến trình
pm2 startup                    # tạo dịch vụ tự khởi động cùng máy (chạy dòng lệnh nó in ra)

# Lệnh quản lý
pm2 status
pm2 logs sophia
pm2 restart sophia
```

Ứng dụng lắng nghe cổng **9000**. Đổi cổng bằng biến môi trường `PORT`:
`pm2 start npm --name sophia -- run start` với `PORT=8080` đặt trong `.env` hoặc trước lệnh.

---

## 7. (Tùy chọn) Nginx reverse proxy + tên miền + HTTPS

Để truy cập qua tên miền (vd `kho.sophia.vn`) và bật HTTPS:

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/sophia
```

Nội dung file cấu hình Nginx:

```nginx
server {
    listen 80;
    server_name kho.sophia.vn;   # đổi thành tên miền của bạn

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Kích hoạt & cài SSL miễn phí (Let's Encrypt):

```bash
sudo ln -s /etc/nginx/sites-available/sophia /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d kho.sophia.vn      # tự cấu hình HTTPS + gia hạn
```

---

## 8. Tài khoản đăng nhập

Sau khi `db:seed`, có sẵn 4 tài khoản (mật khẩu theo mẫu `<vaitro>123`):

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị | admin@sophia.vn | admin123 |
| Quản lý | quanly@sophia.vn | manager123 |
| Thủ kho | thukho@sophia.vn | warehouse123 |
| Nhân viên | nhanvien@sophia.vn | staff123 |

> ⚠️ **Bảo mật:** Đăng nhập bằng `admin@sophia.vn` và **đổi mật khẩu tất cả tài khoản demo**
> ngay sau khi cài đặt (hoặc xóa/tạo lại người dùng thật). Luôn đổi `AUTH_SECRET` ở môi trường thật.

---

## 9. Cập nhật phiên bản mới

```bash
cd /opt/sophia
# giải nén bản mới đè lên (giữ nguyên file .env)
unzip -o sophia-wellness-moi.zip -d /opt/sophia

npm install
npm run prisma:push    # đồng bộ thay đổi schema (nếu có)
npm run build
pm2 restart sophia
```

---

## 10. Sao lưu & phục hồi dữ liệu

```bash
# Sao lưu
pg_dump -U sophia -h localhost sophia_wellness > backup_$(date +%F).sql

# Phục hồi
psql -U sophia -h localhost sophia_wellness < backup_2026-08-11.sql
```

Nên đặt lịch `cron` sao lưu hằng ngày và lưu bản sao ở nơi khác.

---

## 11. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `Can't reach database server` | Sai `DATABASE_URL`, PostgreSQL chưa chạy (`sudo systemctl status postgresql`) |
| Trang trắng / lỗi 500 | Xem log: `pm2 logs sophia`; kiểm tra đã `npm run build` chưa |
| Đăng nhập xong bị đá ra | `AUTH_SECRET` trống hoặc đổi giữa chừng → đặt cố định trong `.env`, `pm2 restart` |
| Cổng 9000 bị chiếm | Đổi `PORT` trong `.env` rồi `pm2 restart sophia` |
| `permission denied for schema public` | Chạy lại `GRANT ALL ON SCHEMA public TO sophia;` (bước 3) |

---

*Sophia Wellness — Hệ thống quản lý kho · Next.js 14 + Prisma + PostgreSQL.*
