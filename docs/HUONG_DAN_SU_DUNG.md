# HƯỚNG DẪN SỬ DỤNG — Sophia Wellness (Spa / Thẩm mỹ)

Tài liệu này dành cho **người dùng thực tế** (lễ tân, chuyên viên, CSKH, thu ngân, quản lý, marketing…),
không cần kiến thức lập trình. Hệ thống gồm hai mảng dùng chung một tài khoản đăng nhập:

- **Spa & CRM** — quản lý toàn bộ hành trình khách hàng: hồ sơ khách → đặt lịch (booking) → đánh giá →
  phác đồ điều trị → thực hiện từng buổi → báo giá → chi phí/thanh toán → chăm sóc sau dịch vụ → marketing.
- **Kho THNG** — quản lý kho thiết bị CNTT (nhập/xuất/lắp ráp/bảo hành/kiểm kê…). Tài liệu này tập trung
  vào **mảng Spa & CRM**; mảng Kho chỉ nhắc tới khi liên quan (ví dụ vật tư buổi trừ tồn kho thật).

Giao diện chia thành thanh menu bên trái (**sidebar**) với 3 nhóm: **Spa & CRM**, **Thư viện Spa**,
**Kho THNG**. Trang chủ sau khi đăng nhập là **Tổng quan Spa** (`/crm`).

> Toàn bộ giao diện là tiếng Việt. Định dạng tiền tệ dạng "2.500.000 ₫", ngày dạng dd/MM/yyyy.

---

## Tài khoản demo (sau khi chạy seed dữ liệu mẫu)

Mật khẩu theo quy tắc `<vai trò>123`. Đây là tài khoản mẫu để thử nghiệm.

**Nhân viên Spa (đăng nhập tại `/login`):**

| Vai trò | Email | Mật khẩu | Quyền chính |
|---|---|---|---|
| Quản lý Spa (MANAGER) | quanly@sophia.com.vn | quanly123 | Xem toàn bộ + duyệt, gần như mọi thao tác |
| Lễ tân (RECEPTION) | letan@sophia.com.vn | letan123 | Tạo khách, đặt lịch, thu tiền |
| CSKH (CUSTOMER_CARE) | cskh@sophia.com.vn | cskh123 | Nhật ký chăm sóc, follow-up, công việc |
| Chuyên viên (SPECIALIST) | chuyenvien@sophia.com.vn | chuyenvien123 | Đánh giá, thiết kế phác đồ, thực hiện buổi |
| Thu ngân/Kế toán (CASHIER) | thungan@sophia.com.vn | thungan123 | Thanh toán, công nợ, dữ liệu tài chính |
| Marketing (MARKETING) | marketing@sophia.com.vn | marketing123 | Chiến dịch, nguồn khách, ROI |
| Ban Giám đốc (BOD) | bod@sophia.com.vn | bod123 | Duyệt cấp cao, xem báo cáo |
| Admin (ADMIN) | admin@sophia.com.vn | admin123 | Toàn quyền (cả kho lẫn spa) |

**Các vai trò thiên về Kho THNG:** muahang@ (Mua hàng), ketoan@ (Kế toán kho), thukho@ (Thủ kho),
kythuat@ (Kỹ thuật), qc@ (QC), kinhdoanh@ (Kinh doanh), baohanh@ (Bảo hành) — mật khẩu cùng quy tắc.

**Khách hàng (Cổng khách — đăng nhập tại `/portal`):**

| Email | Mật khẩu |
|---|---|
| khachhang@example.com | khach123 |

Dữ liệu mẫu kèm theo: khách **KH-000001 Nguyễn Thị An**, phác đồ **TP-000001**, báo giá **PROP-000001**,
brand **DMK**, công nghệ **Laser Pico**, biểu mẫu **FORM-SKIN-ASSESS**, chiến dịch **CAMP-SUMMER-2026**.

---

## 1. Đăng nhập

**Chức năng:** Xác thực người dùng để vào hệ thống. Mỗi vai trò thấy menu/quyền khác nhau.

1. Mở trang **`/login`** (tiêu đề "THNG — Quản lý kho", "Đăng nhập để tiếp tục").
2. Nhập **Email** và **Mật khẩu** (xem bảng tài khoản demo ở trên).
3. Nhấn nút **Đăng nhập**.

Sau khi đăng nhập: hệ thống đưa bạn vào **Tổng quan Spa** (`/crm`). Góc trên bên phải hiển thị **tên +
vai trò** của bạn và nút **Đăng xuất**. Nếu đăng nhập sai nhiều lần liên tiếp, hệ thống tạm khóa vài phút
để chống dò mật khẩu (báo lỗi chung, không tiết lộ email có tồn tại hay không).

---

## 2. Tổng quan Dashboard

**Chức năng:** Bảng chỉ số nhanh về hoạt động spa: số booking, khách hàng, phác đồ, doanh thu — chi phí —
lợi nhuận.

- **Vào:** Sidebar nhóm **Spa & CRM** → **Tổng quan** (`/crm`). Đây cũng là trang mặc định.
- Trang tên **"Tổng quan Spa"**, hiển thị các thẻ KPI và số liệu doanh thu.
- **Lưu ý phân quyền:** các con số **chi phí / lợi nhuận / giá vốn** chỉ hiện với người có quyền tài chính
  (`finance.read`, ví dụ Thu ngân/Kế toán, Quản lý). Vai trò không có quyền sẽ thấy các trường này bị ẩn.
- Ngoài ra có **Tổng quan kho** riêng (Sidebar nhóm **Kho THNG** → **Tổng quan kho**, `/dashboard`) cho
  chỉ số tồn kho — dùng cho nghiệp vụ kho.

---

## 3. Quản lý khách hàng

**Chức năng:** Danh sách và hồ sơ khách hàng. Mọi dữ liệu (booking, phác đồ, CSKH, thanh toán…) đều liên
kết về hồ sơ khách.

- **Vào:** Sidebar **Spa & CRM** → **Khách hàng** (`/customers`).
- **Tìm kiếm:** ô tìm "Tìm theo tên, mã, SĐT, email...". Nhấn nút **Tải lại** để làm mới danh sách.
- **Mở hồ sơ:** bấm vào một khách để vào trang chi tiết `/customers/[id]`. Hồ sơ có các tab:
  **Tổng quan, Timeline, Booking, Phác đồ, Nhật ký CSKH, Đánh giá, Sản phẩm đề xuất, Biểu mẫu, Hướng dẫn,
  Thanh toán**. Phần đầu hồ sơ hiển thị **Công nợ** hiện tại.
- Trong hồ sơ có sẵn các nút mở nhanh thao tác: **Nhật ký CSKH, Thanh toán, Đánh giá** (và trong các tab
  tương ứng: Đề xuất sản phẩm, Áp biểu mẫu, Gửi hướng dẫn, Cấp tài khoản Cổng khách hàng).
- **Liên quan:** hầu như mọi module Spa (mục 4–27) đều đổ dữ liệu về đây.

---

## 4. Tạo khách hàng

**Chức năng:** Thêm một khách mới vào hệ thống (sinh mã tự động dạng KH-000001).

1. **Vào:** `/customers` → nhấn nút **Thêm mới** (mở hộp thoại "Thêm khách hàng").
2. Nhập thông tin: **Họ tên** (bắt buộc), Giới tính, Ngày sinh, Điện thoại, Email, **Nguồn khách**
   (Facebook, giới thiệu…), **Nhóm khách** (VIP, Thường…), Nhân viên phụ trách, Địa chỉ,
   **Mong muốn / mục tiêu**, Ghi chú.
3. Nhấn **Lưu** (hoặc **Hủy** để bỏ).

Sau khi lưu: khách xuất hiện ngay trong danh sách `/customers`, có mã KH riêng, và có thể mở hồ sơ để
làm tiếp booking/phác đồ. **Liên quan:** Marketing (nếu khách đến từ chiến dịch, nguồn khách được ghi để
tính attribution).

---

## 5. Nhật ký chăm sóc khách hàng (CSKH / CRM)

**Chức năng:** Ghi lại **từng lần** tương tác với khách (gọi điện, nhắn tin, tư vấn…). Nhật ký là
**append-only** — mỗi lần là một dòng độc lập, không ghi đè.

1. **Vào:** hồ sơ khách `/customers/[id]` → tab **Nhật ký CSKH**, hoặc nhấn nút **Nhật ký CSKH** ở đầu hồ sơ
   (mở hộp thoại "Thêm nhật ký CSKH").
2. Nhập: **Loại tương tác** (bắt buộc), **Nội dung** (bắt buộc), Kết quả, Việc tiếp theo, và tùy chọn
   **Ngày follow-up** + **Người follow-up**.
3. Nhấn **Lưu**.

Sau khi lưu: bản ghi hiện trong tab CSKH và trên **Timeline** khách. **Nếu có nhập ngày follow-up**, hệ
thống **tự tạo một Công việc** tương ứng (xem mục 26). **Liên quan:** Công việc/Follow-up (mục 26),
Timeline (mục 27).

---

## 6. Tạo Booking

**Chức năng:** Đặt lịch một dịch vụ cho khách. Booking lưu **giá chốt tại thời điểm đặt** (snapshot giá).

1. **Vào:** Sidebar **Spa & CRM** → **Booking** (`/bookings`) → nút **Tạo booking**
   (mở hộp thoại "Tạo booking").
2. Chọn **khách hàng**, **dịch vụ**, thời gian và các thông tin lịch hẹn.
3. Nhấn **Lưu** (hoặc **Hủy**).

Sau khi lưu: booking xuất hiện trong danh sách `/bookings`, đồng thời hiện ở tab **Booking** trong hồ sơ
khách và trên Timeline. **Liên quan:** Bảng giá (giá được resolve theo nhóm khách khi tạo — mục 24 phần
giá), Marketing (attribution booking theo chiến dịch).

---

## 7. Quản lý lịch hẹn

**Chức năng:** Theo dõi vòng đời các lịch hẹn từ **Chờ xác nhận → Đã xác nhận → Đang thực hiện → Hoàn thành**
(hoặc **Hủy / Không đến**).

> **Lưu ý:** Không có menu "Lịch hẹn" riêng — quản lý lịch hẹn nằm **chung trong trang Booking**
> (`/bookings`). Trạng thái mỗi booking được cập nhật tại đây.

- **Vào:** Sidebar **Spa & CRM** → **Booking** (`/bookings`).
- Mỗi dòng booking hiển thị **trạng thái** (nhãn tiếng Việt: Chờ xác nhận, Đã xác nhận, Đang thực hiện,
  Hoàn thành, Hủy, Không đến) và cho phép chuyển trạng thái.
- **Quy tắc cứng:** khi booking chuyển **Hoàn thành**, dữ liệu lịch sử **bị khóa** (chỉ sửa được ghi chú),
  giá đã chốt tại thời điểm booking.

---

## 8. Đánh giá tình trạng

**Chức năng:** Chuyên viên ghi nhận tình trạng da/cơ thể của khách (skin/body assessment) làm căn cứ thiết
kế phác đồ.

1. **Vào:** hồ sơ khách `/customers/[id]` → tab **Đánh giá**, hoặc nút **Đánh giá** ở đầu hồ sơ
   (mở hộp thoại "Đánh giá tình trạng").
2. Nhập: **Tình trạng** (bắt buộc), **Vùng**, **Mức độ** (Nhẹ / Vừa / Nặng), **Mô tả**,
   **Nhận xét chuyên viên**.
3. Nhấn **Lưu**.

Sau khi lưu: bản đánh giá hiện trong tab Đánh giá và trên Timeline. **Liên quan:** dùng làm đầu vào cho
Phác đồ (mục 13) và Báo giá (mục 15).

---

## 9. Ghi nhận mong muốn của khách

**Chức năng:** Lưu **mong muốn / mục tiêu** của khách (ví dụ "trị nám", "trắng da", "giảm mỡ") để định hướng
tư vấn và phác đồ.

> **Lưu ý:** Đây **không phải một trang riêng**. "Mong muốn / mục tiêu" là **một trường trong hồ sơ khách**.

1. **Khi tạo khách** (mục 4): điền ô **Mong muốn / mục tiêu** trong hộp thoại "Thêm khách hàng".
2. Xem lại tại **hồ sơ khách** → tab **Tổng quan** (dòng "Mong muốn / mục tiêu").

Ngoài ra, mong muốn cụ thể hơn có thể được diễn giải qua **Đánh giá tình trạng** (mục 8) và **Nhật ký CSKH**
(mục 5). **Liên quan:** Phác đồ, Báo giá.

---

## 10. Thư viện Brand / Protocol

**Chức năng:** Quản lý các **thương hiệu** (Brand: DMK, Dermalogica, Klapp…) mà spa sử dụng. Admin tự thêm,
không cố định cứng.

1. **Vào:** Sidebar **Thư viện Spa** → **Brand** (`/brands`, tiêu đề "Brand").
2. Nhấn **Thêm brand** → nhập tên/thông tin brand → **Lưu**.

Sau khi lưu: brand dùng được khi tạo **Công nghệ** (mục 11), **Protocol** (mục 12) và **Sản phẩm** (mục 16).
Xem thêm **Protocol Library** ở mục 12. **Liên quan:** toàn bộ Thư viện Spa.

---

## 11. Quản lý công nghệ

**Chức năng:** Khai báo các **thiết bị / công nghệ** dùng tại spa (ví dụ Laser Pico), dùng chung được cho
nhiều dịch vụ và phác đồ.

1. **Vào:** Sidebar **Thư viện Spa** → **Công nghệ** (`/technologies`, tiêu đề "Công nghệ").
2. Nhấn **Thêm công nghệ** → nhập tên, brand liên quan, mô tả → **Lưu**.

Sau khi lưu: công nghệ có thể được chọn khi tạo **Protocol** (mục 12) và khi tạo **buổi thực hiện** trong
phác đồ (mục 14). **Liên quan:** Protocol, Phác đồ.

---

## 12. Thiết kế Protocol

**Chức năng:** Xây dựng **Protocol** — quy trình chuẩn (của hãng hoặc nội bộ) gồm các **bước**, gắn công
nghệ và sản phẩm. Khác với "phác đồ riêng của khách" (mục 13). Protocol có **version** và quy trình
**phê duyệt**: Bản nháp (DRAFT) → Rà soát (REVIEW) → Đã duyệt (APPROVED) → Đang dùng (ACTIVE) → Lưu trữ
(ARCHIVED).

1. **Vào:** Sidebar **Thư viện Spa** → **Protocol** (`/protocols`, tiêu đề "Protocol Library").
2. Nhấn **Thêm protocol** → nhập tên, loại (Brand/Nội bộ), tần suất khuyến nghị… → **Lưu**.
3. Bấm vào protocol để vào trang thiết kế `/protocols/[id]`: thêm **bước**, gắn **công nghệ**, gắn **sản
   phẩm**, chỉnh workflow.
4. Đổi trạng thái bằng ô chọn trạng thái trên đầu (ví dụ chuyển sang **Đã duyệt / Đang dùng**).
   **Lưu ý phân quyền:** chỉ người có quyền **duyệt protocol** (BOD/Manager với `protocol.approve`) mới
   chuyển sang APPROVED/ACTIVE được.

Sau khi lưu: protocol trạng thái **Đang dùng (ACTIVE)** sẽ chọn được khi tạo buổi thực hiện trong phác đồ.
Sửa protocol về sau **không** làm thay đổi các buổi đã áp (bản đã dùng được đóng băng). **Liên quan:** Công
nghệ, Sản phẩm, Phác đồ.

---

## 13. Thiết kế phác đồ riêng cho khách

**Chức năng:** Tạo **Treatment Plan** riêng cho từng khách — nhiều **giai đoạn**, nhiều **buổi**, có
**version**. Đây là kế hoạch điều trị cá nhân hóa (khác với Protocol chuẩn ở mục 12).

1. **Vào:** Sidebar **Spa & CRM** → **Phác đồ** (`/treatment-plans`, tiêu đề "Phác đồ điều trị").
2. Nhấn **Tạo phác đồ** → chọn khách, nhập tên phác đồ, thêm các **Giai đoạn** (nút **+ Giai đoạn**,
   xóa bằng nút **×**) → **Lưu**.
3. Bấm vào phác đồ để mở trang chi tiết `/treatment-plans/[id]` — nơi thêm buổi, ghi nhận buổi, tạo version.

Sau khi lưu: phác đồ hiện trong danh sách `/treatment-plans` và ở tab **Phác đồ** của hồ sơ khách. Khi cần
thay đổi lớn, dùng **tạo version mới** (giữ lịch sử qua `changeLog`). **Liên quan:** Đánh giá (mục 8),
Buổi thực hiện (mục 14), Báo giá (mục 15).

---

## 14. Tạo các buổi thực hiện

**Chức năng:** Trong một phác đồ, tạo các **buổi (session)** cụ thể — mỗi buổi gắn dịch vụ, công nghệ,
brand protocol, mục tiêu, chi phí dự kiến, dặn dò trước/sau.

1. **Vào:** `/treatment-plans/[id]` (trang chi tiết một phác đồ).
2. Nhấn **Thêm buổi** (hộp thoại "Thêm buổi thực hiện") và nhập:
   - **Giai đoạn**, **Dịch vụ**, **Công nghệ**, **Brand Protocol** (chọn từ thư viện).
   - Tên buổi, **Mục tiêu**, **Thời gian dự kiến**, **Chi phí dự kiến**, **Giá**.
   - **Dặn dò trước** (pre-care) và **Dặn dò sau** (post-care).
   - Danh sách **sản phẩm chuyên nghiệp** dự kiến dùng.
3. Nhấn **Lưu**.
4. **Sắp xếp thứ tự buổi:** kéo–thả các dòng buổi để đổi thứ tự (hệ thống tự lưu `orderIndex`).

Sau khi lưu: buổi hiện trong danh sách buổi của phác đồ, sẵn sàng để **Ghi nhận** (thực hiện, mục 18) và
gắn **Vật tư** (mục 21). **Liên quan:** Công nghệ, Protocol, Bảng giá (giá buổi được resolve khi tạo).

---

## 15. Tạo Proposal / Báo giá

**Chức năng:** Lập **báo giá nhiều phương án** (Thiết yếu / Khuyến nghị / Cao cấp / Tùy chỉnh) để khách so
sánh và chọn. Khi khách chốt → tạo **snapshot bất biến** với **giá thống nhất**.

1. **Vào:** Sidebar **Spa & CRM** → **Báo giá** (`/proposals`, tiêu đề "Báo giá / Phương án").
2. Nhấn **Tạo báo giá** → chọn khách, nhập **Tiêu đề** (VD: "Phương án trị nám 2026") →
   nhấn **Tạo & thiết kế**.
3. Ở trang chi tiết `/proposals/[id]`: thêm các **phương án**, mỗi phương án thêm **hạng mục** (dịch vụ/sản
   phẩm) với số lượng và đơn giá; hệ thống tự tính tổng để **so sánh cạnh nhau**. Nhớ **Lưu** thay đổi.
4. Khi khách đồng ý: nhấn chốt (hộp thoại **"Khách chốt phương án"**). Lưu ý cảnh báo: **chốt xong sẽ đông
   cứng snapshot, không sửa được phương án nữa** — hãy lưu mọi thay đổi trước khi chốt.

Sau khi chốt: báo giá lưu **`acceptedSnapshot`** + **giá thống nhất (agreedPrice)**, khóa chỉnh sửa. Báo giá
cũng hiển thị cho khách trên **Cổng khách** để họ tự chọn (mục 31). **Lưu ý phân quyền:** giá vốn/ghi chú
nội bộ bị ẩn với người không có `finance.read`. **Liên quan:** Cổng khách (mục 31), Chi phí (mục 23).

---

## 16. Đề xuất sản phẩm

**Chức năng:** Gợi ý **sản phẩm** (chuyên nghiệp / chăm sóc tại nhà) cho khách, kèm mức ưu tiên
(Thiết yếu / Khuyến nghị / Tùy chọn). Sản phẩm lấy từ **Catalog** (Sản phẩm).

**Quản lý danh mục sản phẩm (Catalog):**
- **Vào:** Sidebar **Thư viện Spa** → **Sản phẩm** (`/catalog`, tiêu đề "Sản phẩm (Catalog)").
- Nhấn **Thêm sản phẩm** → nhập tên, brand, loại (chuyên nghiệp / chăm sóc tại nhà / cả hai), giá,
  giá vốn → **Lưu**. (Giá vốn bị ẩn với người không có quyền tài chính.)

**Đề xuất sản phẩm cho một khách:**
1. **Vào:** hồ sơ khách `/customers/[id]` → tab **Sản phẩm đề xuất** → nút **Đề xuất sản phẩm**.
2. Chọn **sản phẩm**, **Mức ưu tiên**, Số lượng, **Lý do đề xuất**, **Mục tiêu sử dụng**, giá (bỏ trống =
   giá bán), **Hướng dẫn sử dụng** → **Lưu**.

Sau khi lưu: đề xuất hiện trong tab "Sản phẩm đề xuất" của khách, trên Timeline, và trên **Cổng khách**.
**Liên quan:** Catalog, Cổng khách, Bảng giá.

---

## 17. Dặn dò trước dịch vụ

**Chức năng:** Cung cấp **hướng dẫn trước dịch vụ** (pre-care) cho khách — ví dụ ngưng dùng retinol trước
khi laser. Dùng lại **mẫu** trong thư viện, khi gửi khách sẽ tạo bản **snapshot** cá nhân hóa được.

**Quản lý thư viện hướng dẫn:**
- **Vào:** Sidebar **Thư viện Spa** → **Hướng dẫn chăm sóc** (`/care-instructions`, tiêu đề "Thư viện hướng
  dẫn (Pre/Post-care)").
- Nhấn **Thêm hướng dẫn** → nhập tiêu đề, loại (Pre-care / Post-care / General / Follow-up), nội dung →
  **Lưu**. Sửa bằng nút biểu tượng bút chì.

**Gửi hướng dẫn cho một khách:**
1. **Vào:** hồ sơ khách `/customers/[id]` → tab **Hướng dẫn** → nút **Gửi hướng dẫn cho khách**.
2. Chọn **Mẫu** (hoặc "— Soạn tự do —"), chỉnh **Tiêu đề** + **Nội dung** (cá nhân hóa được, không đổi mẫu
   gốc), chọn **Kênh gửi** (Portal/Email/Zalo/WhatsApp/SMS) → **Gửi**.

Sau khi gửi: bản hướng dẫn (snapshot) hiện trong tab "Hướng dẫn" của khách và trên **Cổng khách** (khách
bấm "Tôi đã đọc" để xác nhận). **Liên quan:** Buổi thực hiện (mỗi buổi cũng có ô Dặn dò trước — mục 14),
Cổng khách.

> **Lưu ý:** cùng một thư viện dùng cho cả **dặn dò trước (mục 17)** và **dặn dò sau (mục 25)** — phân biệt
> bằng **loại** của mẫu.

---

## 18. Thực hiện một Session (buổi)

**Chức năng:** Chuyên viên **ghi nhận** một buổi đã làm: kết quả, tình trạng trước/sau, ảnh, vật tư.

1. **Vào:** `/treatment-plans/[id]` → tìm buổi cần làm → nhấn nút **Ghi nhận** (hộp thoại
   "Ghi nhận buổi #<số>").
2. Nhập kết quả buổi, **Tình trạng trước / Tình trạng sau**, **Vật tư thực tế**, ảnh Before/After
   (xem mục 19–21) → **Lưu**.
3. Ngoài ra mỗi buổi có nút **Vật tư** (ghi biến động vật tư — mục 21) và có thể gắn **Biểu mẫu buổi**
   (hộp thoại "Biểu mẫu buổi #<số>").

Sau khi lưu: buổi được đánh dấu đã thực hiện; chi phí thực tế/vật tư cập nhật; dữ liệu hiện trên Timeline
khách. Buổi đã hoàn thành/khóa là **bất biến** (append-only). **Liên quan:** Vật tư & Kho (mục 21–22),
Chi phí (mục 23), Biểu mẫu (mục 19).

---

## 19. Nhập thông số

**Chức năng:** Nhập **thông số kỹ thuật / chỉ số** của buổi qua **biểu mẫu động** (form) — ví dụ mức năng
lượng laser, chỉ số da, bảng đo. Biểu mẫu được thiết kế trước bằng **Form Builder**.

**Thiết kế biểu mẫu (Form Builder):**
- **Vào:** Sidebar **Thư viện Spa** → **Biểu mẫu** (`/form-templates`, tiêu đề "Biểu mẫu / Protocol Builder").
- Nhấn **Tạo biểu mẫu** → nhập tên, **Nhóm** (Phác đồ / Đánh giá / Tư vấn) → **Tạo & thiết kế**.
- Ở trang `/form-templates/[id]`: 3 tab — **Thiết kế** (kéo–thả trường/section), **Logic điều kiện**
  (quy tắc IF… THEN hiện/ẩn/bắt buộc), **Xem trước**. Hỗ trợ nhiều loại trường gồm bảng (TABLE), tính toán
  (CALCULATED), chữ ký (SIGNATURE)… Biểu mẫu có version & phê duyệt.

**Điền thông số cho một buổi/khách:**
1. Áp mẫu vào khách: hồ sơ khách → tab **Biểu mẫu** → **Áp biểu mẫu cho khách** (chọn mẫu trạng thái
   ACTIVE/APPROVED). Hoặc gắn biểu mẫu vào buổi qua nút trên từng buổi.
2. Mở **`/form-instances/[id]`** để điền, rồi **Hoàn thành** để khóa bất biến.

Sau khi lưu: dữ liệu là **snapshot schema + version** — sửa mẫu về sau không đổi phiếu đã điền. **Liên quan:**
Buổi thực hiện (mục 18), Timeline.

---

## 20. Upload Before / After

**Chức năng:** Đính kèm **ảnh trước / sau (Before/After)** cho buổi để theo dõi kết quả.

1. **Vào:** `/treatment-plans/[id]` → buổi → nút **Ghi nhận**.
2. Trong hộp thoại, dùng vùng **Upload ảnh Before** và **Upload ảnh After** để tải ảnh thật lên (ảnh lưu
   ở kho lưu trữ **riêng tư**, không có URL công khai).
3. **Lưu**.

Sau khi lưu: ảnh gắn với buổi và khách. **Mặc định RIÊNG TƯ** — khách không thấy trên Cổng cho tới khi
nhân viên (quyền `media.write`) **bật chia sẻ** từng ảnh (nút chia sẻ ngay trong màn Ghi nhận buổi). Khi
bật, ảnh mới hiện ở mục "Hình ảnh trước/sau" của Cổng khách (mục 31). **Liên quan:** Cổng khách, Quản lý
kho lưu trữ media.

---

## 21. Ghi nhận vật tư

**Chức năng:** Ghi **vật tư/sản phẩm chuyên nghiệp** tiêu hao trong buổi, theo các trạng thái: kế hoạch,
giữ (reserve), xuất (issue), tiêu hao (consume), trả (return), hao hụt (waste). Nếu vật tư gắn **Lô kho**
thì sẽ **trừ tồn kho thật**.

1. **Vào:** `/treatment-plans/[id]` → buổi → nút **Vật tư** (hộp thoại "Vật tư buổi #<số>").
2. Bảng vật tư có các cột: Vật tư · **Kho/Lô** · ĐVT · **KH** (kế hoạch) · **Giữ** · **Xuất** · **Tiêu hao**
   · **Hao** · (Giá vốn — chỉ người có quyền tài chính) · **Ghi biến động**.
3. Thêm dòng ở khu "Thêm vật tư / sản phẩm chuyên nghiệp" → nhấn **Thêm**. Ghi biến động theo vòng đời
   **REQUEST → RESERVE → ISSUE → CONSUME/WASTE/RETURN**.

Sau khi ghi: **ISSUE** trừ tồn thật (ghi StockMovement OUTBOUND ở kho THNG); **CONSUME** cộng vào chi phí
thật của buổi (`materialCost`, gán `actualCost` nếu trống). Hệ thống **chặn bán vượt tồn khả dụng**. Sản
phẩm chuyên nghiệp **không gắn lô** chỉ tính chi phí, không đụng tồn. **Liên quan:** Quản lý kho (mục 22),
Chi phí (mục 23).

---

## 22. Quản lý kho

**Chức năng:** Quản lý tồn kho thật của thiết bị/vật tư (mảng **Kho THNG**). Vật tư buổi spa lấy từ đây khi
gắn **Lô kho**.

- **Vào:** Sidebar **Kho THNG** → **Tồn kho** (`/inventory`, tiêu đề "Tồn kho realtime") để xem tồn thực
  tế / khả dụng / đang WIP theo từng kho. Quy tắc: **tồn khả dụng = còn trong kho (IN_STOCK), không nằm
  trong máy, thuộc kho tính tồn**.
- Các trang kho liên quan: **Nhập kho** (`/inbound`), **Xuất kho** (`/outbound`), **Kiểm kê**
  (`/stock-counts`), **Serial** (`/serials`), **Danh mục kho** (`/warehouses`), **Vị trí kệ** (`/bins`),
  **Sản phẩm** (`/products`), **NCC / Đối tác** (`/partners`).
- **Lưu ý:** một số kho **không tính tồn khả dụng**: K-HH, K-BH-KH, K-BH-NCC, K-SC, K-TL.

Đây là mảng nghiệp vụ kho chuyên sâu (nhập/xuất/lắp ráp/bảo hành). Với người dùng spa, phần liên quan nhất
là **Lô kho** dùng cho vật tư buổi (mục 21). **Liên quan:** Ghi nhận vật tư (mục 21).

---

## 23. Chi phí

**Chức năng:** Theo dõi **chi phí** của buổi/phác đồ: chi phí dự kiến (planned) so với chi phí thực tế
(actual), phần lớn đến từ **vật tư tiêu hao**.

- Chi phí dự kiến nhập khi **tạo buổi** (ô Chi phí dự kiến — mục 14).
- Chi phí thực tế tự tính từ **vật tư CONSUME** khi ghi nhận vật tư (mục 21) → cập nhật `materialCost` /
  `actualCost` của buổi.
- **Xem tổng hợp:** trên **Tổng quan Spa** (`/crm`) có doanh thu — chi phí — lợi nhuận; trong báo giá và
  buổi cũng hiển thị giá vốn.
- **Lưu ý phân quyền:** mọi số liệu **giá vốn / chi phí / lợi nhuận** chỉ hiện với người có `finance.read`
  (Thu ngân/Kế toán, Quản lý, BOD…). Vai trò khác thấy các trường này bị **ẩn (mask) ở phía máy chủ**.

> **Lưu ý:** không có một trang "Chi phí" độc lập; chi phí được nhập/hiển thị **trong buổi, báo giá và
> dashboard**. **Liên quan:** Vật tư (mục 21), Thanh toán (mục 24), Báo cáo (mục 29).

---

## 24. Thanh toán

**Chức năng:** Ghi nhận **các lần thanh toán / thu tiền** của khách (cọc, thanh toán từng đợt). Mỗi lần là
một bản ghi độc lập (append-only); hệ thống tự tính **công nợ**.

1. **Vào:** hồ sơ khách `/customers/[id]` → tab **Thanh toán**, hoặc nút **Thanh toán** ở đầu hồ sơ
   (hộp thoại "Ghi nhận thanh toán", hiển thị **Công nợ hiện tại**).
2. Nhập **Số tiền** (bắt buộc), **Hình thức** (tiền mặt, chuyển khoản, thẻ…), Ghi chú → **Lưu**.

Sau khi lưu: khoản thu hiện trong tab Thanh toán, trên Timeline; **Công nợ** ở đầu hồ sơ được cập nhật.
**Giá** áp dụng dựa trên **Bảng giá** (Sidebar **Spa & CRM** → **Bảng giá**, `/pricing`): giá theo dịch
vụ/sản phẩm/công nghệ × nhóm khách (Chuẩn/Chi nhánh/Thành viên/VIP/Khuyến mãi), có version — đổi giá tạo bản
mới, không ghi đè lịch sử. **Liên quan:** Bảng giá, Chi phí, Báo cáo.

---

## 25. Dặn dò sau dịch vụ

**Chức năng:** Gửi **hướng dẫn sau dịch vụ** (post-care) cho khách — ví dụ tránh nắng, dưỡng ẩm sau laser.

- Dùng **cùng thư viện và cùng cách gửi** như mục 17, chỉ khác **loại mẫu = Post-care**:
  1. Tạo/mở mẫu tại `/care-instructions` (loại Post-care).
  2. Gửi cho khách: hồ sơ khách → tab **Hướng dẫn** → **Gửi hướng dẫn cho khách** → chọn mẫu Post-care →
     chỉnh nội dung → chọn kênh → **Gửi**.
- Mỗi **buổi** cũng có ô **Dặn dò sau** (post-care) khi tạo buổi (mục 14).

Sau khi gửi: hiện trên tab Hướng dẫn của khách và **Cổng khách** (khách bấm "Tôi đã đọc"). **Liên quan:**
Follow-up (mục 26), Cổng khách (mục 31).

---

## 26. Follow-up

**Chức năng:** Quản lý **công việc cần làm / nhắc lịch chăm sóc** — follow-up sau dịch vụ, gọi lại khách,
việc nội bộ.

1. **Vào:** Sidebar **Spa & CRM** → **Công việc / Follow-up** (`/tasks`, tiêu đề "Công việc / Follow-up").
2. Nhấn **Thêm việc** → nhập nội dung, mức ưu tiên, hạn, người phụ trách → **Lưu**.
3. Đánh dấu xong bằng nút tick "Đánh dấu hoàn thành" trên từng việc.

**Tự động:** khi ghi **Nhật ký CSKH có ngày follow-up** (mục 5), hệ thống **tự tạo một công việc** ở đây.
**Liên quan:** CSKH (mục 5), Dặn dò sau (mục 25).

---

## 27. Timeline khách hàng

**Chức năng:** Xem **toàn bộ hành trình** của một khách theo dòng thời gian — gộp mọi sự kiện: CSKH,
booking, đánh giá, phác đồ, buổi, thanh toán, báo giá, hướng dẫn chăm sóc, đề xuất sản phẩm.

- **Vào:** hồ sơ khách `/customers/[id]` → tab **Timeline**.
- Mỗi sự kiện hiển thị nhãn trạng thái tiếng Việt thống nhất. Đây là nơi tra cứu nhanh "khách này đã trải
  qua những gì".

**Liên quan:** gần như tất cả module Spa đều đổ sự kiện về Timeline — đây là bức tranh tổng hợp của khách.

---

## 28. Marketing

**Chức năng:** Quản lý **chiến dịch marketing** và **lead** (khách tiềm năng), đo **conversion** và **ROI**.
Luồng: Chiến dịch → Lead → Khách → Booking → Doanh thu.

1. **Vào:** Sidebar **Spa & CRM** → **Marketing** (`/marketing`, tiêu đề "Marketing / Chiến dịch").
2. Nhấn **Tạo chiến dịch** → nhập tên, **Kênh** (Facebook, Google, Zalo…), thời gian, ngân sách, chi phí →
   **Lưu**.
3. Vào chi tiết chiến dịch `/marketing/[id]` để xem **metrics** (số lead, khách, booking, doanh thu,
   conversion, ROI, chi phí/lead, chi phí/khách) và quản lý **lead**.
4. Lead theo vòng đời **NEW → CONTACTED → BOOKED → WON → LOST**; lead có thể **convert thành khách hàng**.

Sau khi convert: khách mới gắn **attribution** về chiến dịch (first-touch qua `campaignId`), booking cũng
gắn chiến dịch để tính doanh thu quy về campaign. **Lưu ý phân quyền:** dành cho vai trò **Marketing** (và
Quản lý). **Liên quan:** Khách hàng, Booking, Báo cáo.

---

## 29. Báo cáo

**Chức năng:** Báo cáo tổng hợp. Lưu ý hiện tại trang **Báo cáo** thuộc **mảng Kho THNG** (Nhập–Xuất–Tồn,
theo NCC, tồn đọng quá hạn, hiệu quả lắp ráp, bảo hành, rã máy).

- **Vào:** Sidebar **Kho THNG** → **Báo cáo** (`/reports`, tiêu đề "Báo cáo tổng hợp").
- Mỗi bảng có nút **CSV** để **xuất Excel** và nút **In báo cáo** (in trực tiếp).
- **Báo cáo mảng Spa:** các chỉ số spa (doanh thu, chi phí, lợi nhuận, booking, khách) xem ở **Tổng quan
  Spa** (`/crm`); hiệu quả marketing/ROI xem ở **Marketing** (`/marketing`, mục 28).

**Liên quan:** Tổng quan Spa, Marketing, Chi phí.

---

## 30. Phân quyền

**Chức năng:** Mỗi người dùng thuộc một hoặc nhiều **vai trò (role)**; mỗi vai trò có tập **quyền
(permission)** quyết định thấy menu nào, làm được thao tác nào, và có xem được số liệu tài chính không.

**Các vai trò mảng Spa (tên hiển thị):**
- **Quản lý Spa (MANAGER):** xem toàn bộ + duyệt, gần như mọi quyền spa (gồm `finance.read`).
- **Lễ tân (RECEPTION):** tạo khách, đặt lịch (booking), thu tiền.
- **CSKH (CUSTOMER_CARE):** nhật ký chăm sóc, follow-up, công việc.
- **Chuyên viên (SPECIALIST):** đánh giá, thiết kế phác đồ, thực hiện buổi, thiết kế protocol/biểu mẫu,
  đề xuất sản phẩm.
- **Thu ngân / Kế toán (CASHIER):** thanh toán, công nợ, **xem dữ liệu tài chính** (`finance.read`).
- **Marketing (MARKETING):** chiến dịch, lead, ROI, catalog sản phẩm.
- **Ban Giám đốc (BOD):** duyệt cấp cao (gồm duyệt protocol), xem báo cáo.
- **Admin (ADMIN):** toàn quyền (cả kho lẫn spa).

**Nguyên tắc quan trọng:**
- **Nút bị ẩn/khóa** khi bạn không có quyền — ví dụ nút **Thêm/Lưu** chỉ hiện với người có quyền ghi
  tương ứng; ô bật chia sẻ ảnh bị **disabled** nếu thiếu `media.write`.
- **Dữ liệu tài chính** (giá vốn, chi phí, lợi nhuận, margin) chỉ hiện với `finance.read`, và được **ẩn ở
  phía máy chủ** (không chỉ ẩn trên giao diện).

> Việc gán vai trò cho người dùng do **Admin** cấu hình (nguồn định nghĩa quyền ở `src/lib/rbac.ts`).
> Giao diện hiện tại **chưa có màn quản lý người dùng/gán quyền** cho người dùng cuối — vai trò được nạp
> qua dữ liệu seed/DB.

---

## 31. Customer Portal (Cổng khách hàng)

**Chức năng:** Cổng riêng cho **khách hàng** tự đăng nhập xem thông tin của mình: lịch hẹn, báo giá (và tự
chọn phương án), phác đồ, hướng dẫn chăm sóc, sản phẩm đề xuất, ảnh trước/sau đã được chia sẻ.

1. **Cấp tài khoản Portal cho khách:** nhân viên vào hồ sơ khách `/customers/[id]` → nút **Cấp tài khoản
   Cổng khách hàng** → nhập **Email đăng nhập** + **Mật khẩu** (≥ 6 ký tự) → **Lưu tài khoản**.
2. **Khách đăng nhập:** mở **`/portal`** → trang **"Cổng khách hàng"** (`/portal/login`) → nhập Email +
   Mật khẩu → **Đăng nhập**. (Tài khoản demo: khachhang@example.com / khach123.)
3. **Trang chính Cổng khách** (`/portal`) hiển thị: lời chào "Xin chào, <tên>", **Lịch hẹn sắp tới**,
   **Báo giá** (nút **Xem**), **Phác đồ điều trị**, **Hướng dẫn chăm sóc** (nút **Tôi đã đọc**),
   **Sản phẩm đề xuất**, **Hình ảnh trước / sau** (chỉ ảnh đã được nhân viên chia sẻ).
4. **Khách chốt báo giá:** bấm **Xem** một báo giá → trang `/portal/proposals/[id]` → nhấn **Chọn phương
   án này** → xác nhận. Sau đó báo giá được chốt (snapshot + giá thống nhất), ghi audit `PROPOSAL_ACCEPTED_PORTAL`.

**An toàn:** phiên khách **tách biệt hoàn toàn** với phiên nhân viên (cookie & bí mật riêng). Khách **chỉ**
thấy dữ liệu của chính mình; hệ thống **chống IDOR** (truy cập dữ liệu người khác → trả 404), **không** lộ
giá vốn/chi phí/ghi chú nội bộ, và ảnh chỉ hiện khi được **chia sẻ** (mục 20). **Liên quan:** Báo giá
(mục 15), Hướng dẫn chăm sóc (mục 17/25), Upload Before/After (mục 20).

---

*Hết tài liệu. Mọi thao tác ghi dữ liệu đều tuân nguyên tắc: không xóa cứng (soft delete), lịch sử
append-only, các bản đã chốt được đóng băng bằng snapshot/version.*
