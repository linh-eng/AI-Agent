# Triển khai Webapp Demo trên MÁY CHỦ NỘI BỘ (LAN)

> Mục tiêu: chạy webapp này trên máy chủ `172.168.11.60` để mọi máy trong mạng nội bộ
> truy cập, **chạy cạnh** 2 webapp sẵn có mà không đụng nhau:
> - Webapp Hỗ Trợ — `172.168.11.60:3000`
> - Webapp Kho Sophia — `172.168.11.60:9000`
>
> → Webapp này dùng **cổng khác: `8000`** (có thể đổi). Đây là bản DEMO nội bộ, chạy
> HTTP trong LAN (không cần HTTPS / domain).

Sau khi chạy xong:
- Nhân viên: **http://172.168.11.60:8000**
- Cổng khách: **http://172.168.11.60:8000/portal**

---

## 0. Yêu cầu trên máy chủ
- **Node.js 18 hoặc 20** (`node -v`). Nếu chưa có: cài qua NodeSource hoặc `nvm`.
- **PostgreSQL 14+** (đã cài sẵn hoặc cài mới). Kiểm tra: `psql --version`.
- **git** (để lấy mã nguồn) và **pm2** (giữ app chạy nền): `sudo npm i -g pm2`.

> App này là 1 tiến trình Next.js phục vụ **cả** giao diện nhân viên và Cổng khách
> (`/portal`) trên cùng cổng 8000. Không cần Nginx cho bản demo (có thể thêm sau).

---

## 1. Lấy mã nguồn
```bash
cd /opt                     # hoặc thư mục bạn muốn
git clone <URL_REPO> spa-demo
cd spa-demo
git checkout claude/customer-treatment-management-system-ozcn03
```
(Nếu không dùng git: copy toàn bộ thư mục dự án lên máy chủ.)

## 2. Tạo database PostgreSQL
```bash
sudo -u postgres psql -c "CREATE DATABASE spa_demo;"
sudo -u postgres psql -c "CREATE USER spa_user WITH PASSWORD 'DOI_MAT_KHAU_NAY';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE spa_demo TO spa_user;"
sudo -u postgres psql -d spa_demo -c "GRANT ALL ON SCHEMA public TO spa_user;"
```

## 3. Tạo file cấu hình `.env`
```bash
cp .env.example .env
nano .env
```
Đặt tối thiểu các dòng sau (⚠️ **COOKIE_SECURE phải là false** vì chạy HTTP LAN):
```
NODE_ENV=production
COOKIE_SECURE=false
PORT=8000
APP_URL=http://172.168.11.60:8000
NEXT_PUBLIC_APP_URL=http://172.168.11.60:8000
DATABASE_URL=postgresql://spa_user:DOI_MAT_KHAU_NAY@localhost:5432/spa_demo?schema=public
AUTH_SECRET=<sinh chuỗi ngẫu nhiên>
PORTAL_AUTH_SECRET=<sinh chuỗi ngẫu nhiên khác>
STORAGE_DRIVER=local
STORAGE_DIR=/opt/spa-demo/var/uploads
```
Sinh secret ngẫu nhiên: `openssl rand -base64 48` (chạy 2 lần cho 2 secret).

> **Vì sao COOKIE_SECURE=false?** Mặc định production bật cookie `Secure` (chỉ gửi qua
> HTTPS). Mạng nội bộ chạy `http://` → nếu để `Secure` thì **đăng nhập sẽ không vào được**.
> Khi nào có HTTPS thì đổi lại `COOKIE_SECURE=true`.

## 4. Cài đặt, tạo bảng, nạp dữ liệu, build
```bash
npm install
npm run prisma:migrate:deploy     # tạo toàn bộ bảng (10 migration)
npm run db:seed                   # tài khoản + dữ liệu nền
npm run db:seed:demo              # (tùy chọn) dữ liệu DEMO: khách mẫu, JetPeel, vật tư khách...
npm run build                     # build production
```

## 5. Chạy nền bằng pm2 (khuyến nghị)
```bash
# Chạy đúng cổng 8000, lắng nghe mọi IP (0.0.0.0) để LAN truy cập được:
pm2 start npm --name spa-demo -- run start:lan
pm2 save
pm2 startup            # làm theo dòng lệnh nó in ra để tự chạy lại khi reboot
```
Xem log: `pm2 logs spa-demo` · Dừng: `pm2 stop spa-demo` · Khởi động lại: `pm2 restart spa-demo`.

> `start:lan` = `next start -H 0.0.0.0 -p 8000`. Muốn đổi cổng: sửa script `start:lan`
> trong `package.json` **hoặc** chạy `PORT=8000 pm2 start npm --name spa-demo -- start`.

### (Thay thế) chạy bằng systemd
Tạo `/etc/systemd/system/spa-demo.service`:
```ini
[Unit]
Description=Spa Demo Webapp
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/spa-demo
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start:lan
Restart=always
User=<user_chay_app>

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now spa-demo
```

## 6. Mở cổng tường lửa (nếu có bật firewall)
```bash
sudo ufw allow 8000/tcp        # Ubuntu/UFW
# hoặc firewalld:
sudo firewall-cmd --permanent --add-port=8000/tcp && sudo firewall-cmd --reload
```

## 7. Kiểm tra
- Trên chính máy chủ: `curl -I http://localhost:8000/login` → `HTTP/1.1 200`.
- Từ máy khác trong LAN: mở trình duyệt **http://172.168.11.60:8000**.
- Đăng nhập thử: `quanly@thng.com.vn` / `quanly123` (Quản lý). Cổng khách: `/portal` với
  `linh.do@example.com` / `khach123`.

---

## Cập nhật phiên bản mới (khi có thay đổi)
```bash
cd /opt/spa-demo
git pull
npm install
npm run prisma:migrate:deploy   # áp migration mới (nếu có) — KHÔNG mất dữ liệu
npm run build
pm2 restart spa-demo
```

## Sao lưu dữ liệu demo (khuyến nghị)
```bash
# Database:
pg_dump "postgresql://spa_user:...@localhost:5432/spa_demo" -Fc > spa_demo_$(date +%F).dump
# Ảnh/tệp đính kèm:
tar czf uploads_$(date +%F).tgz -C /opt/spa-demo var/uploads
```

---

## Không đụng 2 webapp đang chạy
- App này **chỉ** dùng cổng **8000** (khác 3000 và 9000) → không xung đột.
- Dùng **database riêng** `spa_demo` → không ảnh hưởng dữ liệu 2 webapp kia.
- Nếu 2 webapp kia dùng chung PostgreSQL trên máy này thì vẫn an toàn vì khác database.

## Ghi chú
- Bản demo dùng **STORAGE_DRIVER=local** (lưu ảnh trên đĩa máy chủ) — phù hợp 1 máy nội bộ.
- Đây là **bản demo nội bộ**: chạy HTTP trong LAN, chưa bật HTTPS/rate-limit-per-domain.
  Khi muốn đưa ra Internet/production, xem `docs/STAGING.md` (HTTPS, S3, backup vận hành).
- Không copy dữ liệu khách thật vào bản demo.
