# Hướng dẫn triển khai cho MẠNG NỘI BỘ (LAN)

Mục tiêu: cài webapp lên **một máy chủ trong công ty** (một PC/server luôn bật),
nhân viên các máy khác trong cùng mạng LAN mở trình duyệt vào
`http://<IP-máy-chủ>:3000` để dùng.

> Máy chủ nên đặt **IP tĩnh** trong LAN (ví dụ `192.168.1.50`) để địa chỉ không đổi.

---

## Cách 1 — Dùng Docker (khuyên dùng, đơn giản nhất)

Cần cài sẵn **Docker Desktop** (Windows/Mac) hoặc **Docker Engine** (Linux) trên máy chủ.

```bash
# 1) Lấy mã nguồn (giải nén file zip, hoặc: git clone <repo>)
cd thng-warehouse

# 2) (khuyên) đặt AUTH_SECRET ngẫu nhiên — Linux/Mac:
export AUTH_SECRET="$(openssl rand -base64 48)"
#    Windows PowerShell: $env:AUTH_SECRET = [Convert]::ToBase64String((1..48|%{Get-Random -Max 256}))

# 3) Build + chạy (lần đầu tự tạo DB PostgreSQL, đồng bộ bảng, seed dữ liệu mẫu)
docker compose up -d --build

# 4) Xem log khởi động (chờ dòng "Khởi động web trên cổng 3000")
docker compose logs -f app
```

- Nhân viên truy cập: `http://<IP-máy-chủ>:3000`
- Dừng: `docker compose down` — Dừng và xóa DB: `docker compose down -v`
- Cập nhật phiên bản mới: `git pull` (hoặc thay mã nguồn) rồi `docker compose up -d --build`

Dữ liệu PostgreSQL được lưu bền trong volume `dbdata` (không mất khi restart).

---

## Cách 2 — Cài thủ công (không dùng Docker)

Trên máy chủ cài sẵn **Node.js ≥ 18** và **PostgreSQL ≥ 14**.

```bash
# 1) Tạo database trong PostgreSQL (ví dụ tên thng_warehouse)

# 2) Cấu hình
cp .env.example .env
#    Sửa .env:
#      DATABASE_URL = chuỗi kết nối Postgres của bạn
#      AUTH_SECRET  = chuỗi ngẫu nhiên dài (openssl rand -base64 48)
#      COOKIE_SECURE=false   (BẮT BUỘC nếu chạy http:// nội bộ)
#      PORT=3000

# 3) Cài & dựng
npm ci
npm run build
npm run db:setup     # tạo bảng + seed dữ liệu mẫu (chỉ chạy 1 lần)

# 4) Chạy (đã tự lắng nghe 0.0.0.0 để máy khác trong LAN vào được)
npm run start
```

### Giữ cho chạy nền & tự bật lại

- **Linux (systemd)** — tạo `/etc/systemd/system/thng.service`:
  ```ini
  [Unit]
  After=network.target postgresql.service
  [Service]
  WorkingDirectory=/duong-dan/thng-warehouse
  Environment=NODE_ENV=production
  EnvironmentFile=/duong-dan/thng-warehouse/.env
  ExecStart=/usr/bin/npm run start
  Restart=always
  [Install]
  WantedBy=multi-user.target
  ```
  `sudo systemctl enable --now thng`

- **Windows / mọi HĐH (pm2):**
  ```bash
  npm i -g pm2
  pm2 start "npm run start" --name thng
  pm2 save && pm2 startup   # tự chạy khi khởi động máy
  ```

---

## Cho phép nhân viên truy cập (mạng + firewall)

1. **Tìm IP máy chủ trong LAN:**
   - Windows: `ipconfig` → dòng *IPv4 Address* (vd `192.168.1.50`)
   - Linux/Mac: `ip addr` hoặc `ifconfig`
2. **Mở firewall cho cổng 3000** trên máy chủ:
   - Windows: *Windows Defender Firewall → Inbound Rules → New Rule → Port → TCP 3000 → Allow*
   - Linux (ufw): `sudo ufw allow 3000/tcp`
3. Nhân viên mở trình duyệt: `http://192.168.1.50:3000`

> Muốn nhân viên gõ tên cho dễ (vd `http://kho.congty`): nhờ IT thêm bản ghi DNS nội bộ
> hoặc sửa file `hosts` trỏ tên đó về IP máy chủ.

---

## ✅ Việc phải làm trước khi cho nhân viên dùng thật

1. **Đổi mật khẩu các tài khoản demo** (seed tạo sẵn mật khẩu yếu `<vaitro>123`).
   Nên tạo user thật cho từng nhân viên và vô hiệu hóa/đổi mật khẩu user demo.
2. **Đặt `AUTH_SECRET` ngẫu nhiên, dài** (đừng dùng giá trị mẫu).
3. **Đổi mật khẩu PostgreSQL** (`thng_secret_doi_lai` trong `docker-compose.yml`).
4. **Sao lưu định kỳ** database (Docker: backup volume `dbdata`, hoặc `pg_dump`).
5. Nếu muốn bảo mật hơn: đặt sau **HTTPS** (reverse proxy Nginx/Caddy có chứng chỉ nội bộ)
   rồi đổi `COOKIE_SECURE=true`.

## Tài khoản đăng nhập sau khi seed

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

**Nhớ đổi hết mật khẩu này trước khi dùng thật.**
