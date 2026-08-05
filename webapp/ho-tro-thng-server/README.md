# Hệ thống Hỗ trợ THNG — Bản máy chủ nội bộ (LAN)

Cài trên **1 máy chủ**, tất cả phòng ban truy cập bằng **trình duyệt** qua mạng nội bộ.
Dữ liệu **dùng chung**: ai nhập gì mọi người đều thấy (tự đồng bộ mỗi 15 giây).
Có **đăng nhập & phân quyền theo vai trò**.

- ✅ Chỉ cần cài **Node.js** — không cần internet, không cần cài thêm gói nào.
- ✅ Chạy được trên **Windows / Linux / macOS**.
- ✅ Dữ liệu + tài khoản lưu trong 1 file `data.json` trên máy chủ → dễ sao lưu.

## Tài khoản dùng thử (tạo sẵn lần đầu)

| Tên đăng nhập | Mật khẩu | Vai trò | Quyền |
|---|---|---|---|
| `admin` | `admin123` | Quản trị hệ thống | Toàn quyền + quản lý người dùng |
| `dieuphoi` | `123456` | Điều phối / Trưởng bộ phận | Xem tất cả, phân công, **duyệt phát sinh**, xóa |
| `xuly1` | `123456` | Nhân viên xử lý | Xem & cập nhật ticket, ghi phát sinh |
| `kinhdoanh` | `123456` | Người yêu cầu (P. Kinh doanh) | Tạo & **chỉ xem ticket phòng mình** |
| `giamdoc` | `123456` | Ban giám đốc | **Chỉ xem** toàn bộ (không sửa) |

> 🔐 **Đổi mật khẩu `admin` ngay sau lần đăng nhập đầu** (nút *Đổi mật khẩu* ở góc dưới trái).
> Quản trị viên vào menu **Người dùng** để thêm/sửa/xóa tài khoản cho từng nhân viên & phòng ban.
> Người "Người yêu cầu" chỉ thấy ticket có **Đơn vị** trùng phòng ban của họ (hoặc do họ tạo).

---

## A. Cài trên MÁY CHỦ (làm 1 lần)

### Bước 1 — Cài Node.js
- Tải bản **LTS** tại <https://nodejs.org> rồi cài như phần mềm thường (Next → Next → Finish).
- Kiểm tra: mở **Command Prompt** (Windows) hoặc **Terminal**, gõ `node -v` — hiện ra số phiên bản là được.

### Bước 2 — Chép thư mục này vào máy chủ
Chép cả thư mục `ho-tro-thng-server` vào máy chủ, ví dụ `C:\ho-tro-thng-server`.

### Bước 3 — Khởi động máy chủ
- **Windows:** nhấp đúp **`start-windows.bat`**
- **Linux/macOS:** mở Terminal tại thư mục, chạy `bash start.sh`
  *(hoặc `node server.js` ở bất kỳ hệ nào)*

Cửa sổ sẽ hiện các địa chỉ truy cập, ví dụ:

```
• Trên máy chủ này:            http://localhost:3000
• Các phòng ban trong LAN mở:  http://192.168.1.50:3000
```

> ⚠️ **Để nguyên cửa sổ này chạy.** Đóng cửa sổ = tắt máy chủ.

---

## B. Các phòng ban TRUY CẬP

Trên máy bất kỳ **cùng mạng nội bộ**, mở trình duyệt (Chrome/Edge/Cốc Cốc) và gõ địa
chỉ máy chủ, ví dụ:

```
http://192.168.1.50:3000
```

> Thay `192.168.1.50` bằng địa chỉ IP thật của máy chủ (xem ở cửa sổ Bước 3).
> Nên tạo **bookmark** để lần sau vào nhanh.

---

## C. Vài thiết lập nên làm

### 1. Cho phép qua tường lửa (Windows)
Lần đầu chạy, Windows có thể hỏi **"Allow access"** → chọn **Allow / Cho phép**
(cả Private network). Nếu không thấy hỏi mà máy khác vào không được, mở
*Windows Defender Firewall → Allow an app* và cho phép **Node.js**, hoặc mở cổng **3000**.

### 2. Đặt IP tĩnh cho máy chủ
Nên đặt **IP tĩnh** cho máy chủ để địa chỉ không đổi (nhờ IT, hoặc đặt trong router).
Nếu IP đổi, các phòng ban phải gõ địa chỉ mới.

### 3. Đổi cổng (nếu 3000 bị trùng)
- Windows: chạy `set PORT=8080 && node server.js`
- Linux/macOS: chạy `PORT=8080 node server.js`

### 4. Tự chạy nền + tự bật khi khởi động máy (khuyến nghị cho vận hành thật) — dùng PM2

Với PM2, máy chủ **chạy nền** (không cần giữ cửa sổ đen), **tự bật lại khi lỗi** và
**tự khởi động cùng Windows**.

**Cách dễ nhất — chạy file có sẵn:**
1. Đóng cửa sổ đen đang chạy `node server.js` (nếu có) để tránh trùng cổng 3000.
2. Chuột phải **`install-pm2-windows.bat`** → **Run as administrator**.
3. Làm theo hướng dẫn trên màn hình. Xong là máy chủ tự chạy nền.

**Hoặc gõ tay** (PowerShell **quyền Administrator**, tại thư mục app):
```
npm install -g pm2 pm2-windows-startup
pm2 start server.js --name ho-tro-thng
pm2 save
pm2-startup install
pm2 save
```
*(Cần internet để cài lần đầu.)*

**Các lệnh quản lý PM2 thường dùng:**
| Lệnh | Tác dụng |
|---|---|
| `pm2 list` | Xem máy chủ đang chạy không |
| `pm2 logs ho-tro-thng` | Xem nhật ký / lỗi |
| `pm2 restart ho-tro-thng` | Khởi động lại (VD sau khi cập nhật mã) |
| `pm2 stop ho-tro-thng` | Tạm dừng |
| `pm2 delete ho-tro-thng` | Gỡ khỏi PM2 |

> Gỡ tự-khởi-động: `pm2-startup uninstall`.

---

## D. Sao lưu & khôi phục dữ liệu

- Toàn bộ dữ liệu nằm trong file **`data.json`** (cùng thư mục `server.js`).
- **Sao lưu:** chỉ cần copy file `data.json` sang nơi an toàn (định kỳ hằng ngày/tuần).
- **Khôi phục:** tắt máy chủ → chép `data.json` bản sao lưu đè vào → bật lại.
- Trong ứng dụng có nút **"Xuất dữ liệu"** (JSON) và **"Xuất CSV"** để lưu thêm bản đối chiếu.

---

## E. Câu hỏi thường gặp

**Máy khác không vào được?**
1. Đúng địa chỉ IP máy chủ chưa? (xem cửa sổ Bước 3)
2. Máy chủ còn đang chạy không? (cửa sổ chưa đóng)
3. Cùng một mạng nội bộ / Wi-Fi công ty chưa?
4. Tường lửa đã cho phép chưa? (mục C.1)

**Nhiều người sửa cùng lúc có sao không?**
Máy chủ xử lý tuần tự và ghi file an toàn nên dữ liệu không hỏng. Với quy mô một phòng
ban thì hoàn toàn ổn. Nếu sau này cần phân quyền theo người dùng, đăng nhập, nhật ký
chỉnh sửa, đính kèm file thật, email nhắc SLA… thì nâng lên bản dùng cơ sở dữ liệu
(PostgreSQL) — cho em biết khi cần.

**Có mất dữ liệu khi tắt máy chủ không?**
Không. Dữ liệu đã lưu trong `data.json`, bật lại là còn nguyên.

---

## Thông tin kỹ thuật (cho IT)

- Node.js thuần, **không phụ thuộc gói ngoài**; máy chủ HTTP + REST API đơn giản.
- Frontend tĩnh trong `public/`, gọi API `/api/*`.
- Lưu trữ: `data.json` (ghi kiểu atomic: ghi file `.tmp` rồi đổi tên).
- API: `GET /api/data`, `POST/PUT/DELETE /api/tickets[/:id]`, `POST/PUT/DELETE /api/ps[/:id]`.
- SLA tính theo giờ làm việc 08–12 & 13–17, Thứ 2–Thứ 6 (sửa trong `public/index.html`).
