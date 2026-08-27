# Truy cập từ xa an toàn bằng Tailscale (VPN riêng)

Cho phép điện thoại/máy tính **ở bất kỳ đâu** (4G, WiFi nhà, chi nhánh khác) truy cập
webapp Sophia — trong khi **máy chủ vẫn đặt ở tiệm** (mạng local). Chỉ những thiết bị
đã cài Tailscale và đăng nhập tài khoản của chị mới vào được, nên rất an toàn và
**không cần cấu hình router**.

> Ý tưởng: Tailscale tạo một "mạng riêng ảo" chỉ gồm các thiết bị của chị. Các thiết bị
> này nhìn thấy máy chủ như đang trong cùng mạng LAN, dù thực tế đang ở xa. Kết nối
> được mã hoá đầu-cuối.

---

## Bước 1 — Tạo tài khoản Tailscale (miễn phí)

1. Vào **https://tailscale.com** → **Get started**.
2. Đăng nhập bằng Google / Microsoft / email. (Gói *Personal* miễn phí: tối đa 100 thiết bị — thừa dùng.)

---

## Bước 2 — Cài Tailscale trên MÁY CHỦ (máy Windows chạy Sophia)

1. Tải bản Windows: **https://tailscale.com/download/windows** → cài (Next → Install).
2. Mở **Tailscale** (biểu tượng ở khay hệ thống, góc phải dưới) → **Log in** → đăng nhập tài khoản ở Bước 1.
3. Lấy địa chỉ Tailscale của máy chủ: mở **cmd**, gõ:
   ```
   tailscale ip -4
   ```
   Sẽ hiện dãy dạng **100.x.x.x** (ví dụ `100.101.102.103`). **Ghi lại địa chỉ này.**

---

## Bước 3 — Cài Tailscale trên THIẾT BỊ NGOÀI (điện thoại/laptop nhân viên)

- **Điện thoại:** cài app **Tailscale** từ App Store (iPhone) hoặc CH Play (Android).
- **Laptop:** tải ở **https://tailscale.com/download**.
- Mở app → đăng nhập **cùng một tài khoản** với máy chủ (ở Bước 1).

---

## Bước 4 — Truy cập

Trên thiết bị ngoài (đã bật Tailscale), mở trình duyệt vào:

```
http://100.101.102.103:9000
```

(thay `100.101.102.103` bằng IP máy chủ lấy ở Bước 2) → đăng nhập như bình thường.

> Kết nối qua Tailscale đã được mã hoá, nên **không cần HTTPS** — giữ `COOKIE_SECURE="false"`
> trong `.env` (mặc định) là đăng nhập được.

---

## (Tuỳ chọn) Dùng tên dễ nhớ thay cho dãy số — MagicDNS

1. Vào **https://login.tailscale.com/admin/dns** → bật **MagicDNS**.
2. Vào **Machines**, đổi tên máy chủ (nút ⋯ → Rename) thành ví dụ `sophia`.
3. Khi đó truy cập ngắn gọn: **http://sophia:9000**

---

## Bảo mật & vận hành

- ✅ **Chỉ thiết bị đăng nhập tài khoản Tailscale của chị mới vào được** — hệ thống không lộ ra internet.
- Vẫn nên: đổi `AUTH_SECRET`, đổi mật khẩu các tài khoản, và dùng **Quản trị người dùng** để khoá tài khoản khi nhân viên nghỉ.
- **Nhân viên nghỉ việc:** vào **https://login.tailscale.com/admin/machines** → xoá thiết bị của họ khỏi mạng (cắt quyền truy cập ngay).
- Không muốn dùng chung 1 tài khoản Tailscale? Có thể mời nhân viên (Users → Invite) hoặc dùng tính năng **Share** để chia sẻ riêng máy chủ cho tài khoản Tailscale của họ.

## Lưu ý

- Máy chủ phải **đang bật và đang chạy** `start-windows.bat` (hoặc dịch vụ NSSM) thì thiết bị ngoài mới vào được.
- Cổng **9000** đã mở ở tường lửa (bước cài LAN) là đủ — Tailscale dùng chung cổng đó.
- Nếu đổi sang HTTPS/tên miền công khai sau này thì mới cần đặt `COOKIE_SECURE="true"`.

---

*Sophia Wellness — Truy cập từ xa an toàn qua Tailscale. Máy chủ vẫn nằm trong mạng nội bộ.*
