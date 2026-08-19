# DATA-IO — Nhập / Xuất dữ liệu danh mục qua CSV

Màn **Vận hành & Hệ thống → Nhập/Xuất dữ liệu (CSV)** (`/data-io`) cho phép đổ
dữ liệu danh mục nhanh. Nguyên tắc an toàn:

- **Chỉ danh mục / master data** — KHÔNG nhập dữ liệu giao dịch (hóa đơn, thanh
  toán, buổi, sổ điểm/ví/lương…) để bảo toàn tính đúng đắn.
- **Nhập = UPSERT theo MÃ** (khóa tự nhiên `code`/`sku`): mã đã có → **cập nhật**,
  mã mới → **thêm**. **KHÔNG xóa** bản ghi không có trong file.
- **Xem trước (dry-run)** phân loại Thêm mới / Cập nhật / Lỗi trước khi nhập.
- **FK điền bằng MÃ** (vd `categoryCode`, `brandCode`, `parentCode`) — dễ đọc,
  xuất-rồi-nhập-lại (round-trip) giữ nguyên.

## Các loại dữ liệu hỗ trợ (12)
| Nhóm | Loại | Khóa |
|---|---|---|
| Khách hàng thân thiết | Hạng thành viên · Voucher | code |
| Khách hàng & Hành trình | Khách hàng · Tài nguyên (phòng/giường/máy) | code |
| Thư viện chuyên môn | Nhóm dịch vụ · Dịch vụ · Sản phẩm spa · Công nghệ · Thương hiệu | code/sku |
| Vận hành & Hệ thống | Nhân sự · Định nghĩa KPI · Phụ cấp/Khấu trừ lương | code |

## Cách dùng
1. Chọn **Loại dữ liệu**.
2. **Tải file mẫu** (chỉ tiêu đề) hoặc **Xuất CSV** (toàn bộ dữ liệu hiện có) để
   sửa trên Excel.
3. Dán CSV hoặc **tải file** → **Xem trước** → kiểm tra số Thêm mới/Cập nhật/Lỗi
   → **Nhập**.

## Định dạng ô
- **Ngày:** `yyyy-MM-dd` (vd `2026-12-31`).
- **Đúng/Sai (isActive):** `true`/`false` (hoặc 1/0, có/x).
- **Danh sách (roles):** ngăn cách bằng `|` (vd `Kỹ thuật viên|Tư vấn`).
- **Enum:** đúng giá trị trong gợi ý cột (vd Voucher `type` = FIXED/PERCENT).
- **Số tiền:** chỉ chữ số (bỏ dấu chấm phân cách).

## Quyền
- **Xuất/Tải mẫu:** quyền ĐỌC của danh mục tương ứng.
- **Nhập:** quyền GHI (vd `service.write`, `loyalty.write`, `staff.write`,
  `payroll.write`…). Không đủ quyền ghi → chỉ xuất được.
- Mỗi lần nhập ghi **audit** `DATA_IMPORTED`.

> Giới hạn 5.000 dòng/lần. Với khách hàng, màn **Nhập khách hàng** (`/import-customers`)
> có thêm chuẩn hóa SĐT/email + chống trùng nâng cao.
