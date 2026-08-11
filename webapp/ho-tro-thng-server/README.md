# Hệ thống Hỗ trợ THNG — Bản máy chủ nội bộ (LAN)

Cài trên **1 máy chủ**, tất cả phòng ban truy cập bằng **trình duyệt** qua mạng nội bộ.
Dữ liệu **dùng chung**: ai nhập gì mọi người đều thấy (tự đồng bộ mỗi 15 giây).
Có **đăng nhập & phân quyền theo vai trò**.

- ✅ Chỉ cần cài **Node.js** — không cần internet, không cần cài thêm gói nào.
- ✅ Chạy được trên **Windows / Linux / macOS**.
- ✅ Dùng **cơ sở dữ liệu SQLite** (file `data.db`) — bền, nhanh, chịu được nhiều dữ liệu.
- ✅ Nếu trước đây đã chạy bản cũ (`data.json`), **dữ liệu tự chuyển sang `data.db`** ở lần chạy đầu.

> ⚙️ **Yêu cầu:** Node.js **22.5 trở lên** (khuyến nghị **24 LTS**) — vì dùng SQLite tích hợp sẵn của Node.

> 📘 **Tài liệu kèm theo:**
> - **`HUONG-DAN-CAI-DAT.html`** / **`.pdf`** — hướng dẫn **cài đặt mới** & **cập nhật khi có thay đổi** (dành cho IT / quản trị máy chủ).
> - **`HUONG-DAN-SU-DUNG.html`** / **`.pdf`** — hướng dẫn **sử dụng** (dành cho người dùng cuối).

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
• Các phòng ban trong LAN mở:  http://172.168.11.60:3000
```

> ⚠️ **Để nguyên cửa sổ này chạy.** Đóng cửa sổ = tắt máy chủ.

---

## B. Các phòng ban TRUY CẬP

Trên máy bất kỳ **cùng mạng nội bộ**, mở trình duyệt (Chrome/Edge/Cốc Cốc) và gõ địa
chỉ máy chủ, ví dụ:

```
http://172.168.11.60:3000
```

> Thay `172.168.11.60` bằng địa chỉ IP thật của máy chủ (xem ở cửa sổ Bước 3).
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

- Toàn bộ dữ liệu nằm trong file **`data.db`** (cùng thư mục `server.js`).
  **File đính kèm** người dùng tải lên nằm trong thư mục **`uploads/`** (cùng thư mục `server.js`).
- **Sao lưu:** tốt nhất **tắt máy chủ** (`pm2 stop ho-tro-thng`) rồi copy **cả `data.db` và thư mục `uploads/`**
  sang nơi an toàn, sau đó bật lại (`pm2 start ho-tro-thng`). *(Nếu copy lúc đang chạy, nhớ copy kèm cả
  `data.db-wal` và `data.db-shm` nếu có.)*
- **Khôi phục:** tắt máy chủ → chép `data.db` + `uploads/` bản sao lưu đè vào (xóa `data.db-wal`, `data.db-shm` nếu có) → bật lại.
- 🆕 **Sao lưu tự động:** máy chủ tự sao lưu `data.db` + `uploads/` theo lịch (mặc định mỗi 24 giờ, giữ 7 bản)
  vào thư mục **`backups/`**. Quản trị viên chỉnh lịch/số bản, bấm **"Sao lưu ngay"** và **"Tải data.db về máy"**
  ngay trong màn **Danh mục & SLA**. *(Thư mục `backups/` cũng cần được đưa vào lịch backup ngoài nếu muốn an toàn hơn.)*
- Ngoài ra trong ứng dụng có các nút **Xuất Excel** (`.xlsx`) — xuất toàn bộ dữ liệu, danh sách ticket, và báo cáo theo kỳ — để lưu thêm bản đối chiếu.

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
Không. Dữ liệu đã lưu trong `data.db`, bật lại là còn nguyên.

---

## Thông tin kỹ thuật (cho IT)

- Node.js thuần, **không phụ thuộc gói ngoài**; máy chủ HTTP + REST API đơn giản.
- Frontend tĩnh trong `public/`, gọi API `/api/*`.
- Lưu trữ: **SQLite** qua `node:sqlite` (file `data.db`, chế độ WAL). Tự di trú từ `data.json` cũ.
  File đính kèm lưu trên đĩa trong `uploads/`, metadata trong bảng `files`.
- API chính: `GET /api/data`, `POST/PUT/DELETE /api/tickets[/:id]`, `POST/PUT/DELETE /api/ps[/:id]`,
  `GET/PUT /api/config`, `GET/PUT /api/projects` (Danh mục Dự án 5H),
  `POST /api/upload` · `GET /api/files?ticketId=` · `GET|DELETE /api/file/:id` (đính kèm).
- 🆕 Module vận hành: **Thông báo trong app** (`GET /api/notifs`, `POST /api/notifs/seen`; bảng `notifs`) ·
  **Lịch sử truy cập** (`GET /api/loginlog`; bảng `loginlog` — ghi mọi lần đăng nhập kèm IP) ·
  **Sao lưu tự động** (`GET /api/backups`, `POST /api/backup`, `GET /api/backup/download`; thư mục `backups/`).
- SLA & danh mục (loại việc, phòng ban, đội, dự án, trọng số điểm CL, dung lượng file…) chỉnh trực tiếp
  trong màn **Danh mục & Cấu hình** — lưu ở bảng `settings`, áp dụng ngay cho toàn hệ thống.
- 🆕 **Thông tin công ty & Logo**: nhập tên công ty, bộ phận, địa chỉ, ĐT, email, MST, website, ghi chú chân trang
  và tải **logo** (ảnh tự thu nhỏ, lưu dạng base64 trong cấu hình) ngay trong màn **Danh mục & Cấu hình**.
  Thông tin này làm **header (kèm logo)** và **footer** cho tất cả biểu mẫu in PDF.
- 🆕 **Nghiệm thu theo hạng mục (Giai đoạn A)**: mỗi nhóm loại công việc có bộ **hạng mục nghiệm thu + trọng số**
  (cấu hình trong **Danh mục & Cấu hình**). Khi người thực hiện bấm *"Đã hoàn tất — Gửi nghiệm thu"*, ticket sang
  *Đã xử lý (chờ nghiệm thu)*. Người yêu cầu nghiệm thu **từng hạng mục** Đạt/Không đạt; hạng mục Không đạt được
  trả lại để sửa (giữ **lịch sử từng lần** không ghi đè). Chỉ khi **tất cả hạng mục Đạt** ticket mới **Hoàn tất**.
- 🆕 **SLA nghiệm thu (Giai đoạn B)**: đo riêng thời gian **người yêu cầu** nghiệm thu (từ lúc nhận báo cáo → nghiệm thu),
  cấu hình theo nhóm; cảnh báo khi trễ — tách khỏi SLA của người thực hiện.
- 🆕 **Ticket khắc phục con (Giai đoạn C)**: khi một hạng mục Không đạt và phải làm lại công việc thực tế, tạo
  **ticket con mã `<gốc>-01, -02…`** truy về ticket gốc; ticket con Hoàn tất sẽ báo về gốc để nghiệm thu lại.
- 🆕 **Điểm chất lượng theo hạng mục (Giai đoạn D)**: `Điểm = Σ (trọng số × hệ số mức lỗi × hệ số số lần) − trừ trễ SLA`;
  hệ số số lần, mức trừ theo lỗi, điểm trừ SLA đều **cấu hình được** (không hard-code).
- 🆕 **Dashboard chất lượng (Giai đoạn E)**: thêm **First Pass Rate** (đạt ngay lần đầu), tỉ lệ đạt SLA nghiệm thu,
  số ticket khắc phục; báo cáo cá nhân thêm cột **FPR / đúng hạn / mở lại** theo từng người.
- **Báo cáo theo chu kỳ** (menu Báo cáo): lọc theo ngày/tuần/tháng/năm + khoảng ngày, xuất Excel (.xls),
  in 5 biểu mẫu PDF A4 (Phiếu yêu cầu / giao việc / biên bản phát sinh / nghiệm thu / báo cáo kỳ) — dùng
  cửa sổ in của trình duyệt, chọn "Save as PDF".
- SLA tính theo giờ làm việc 08–12 & 13–17, Thứ 2–Thứ 6 (chỉnh trong Cấu hình).
