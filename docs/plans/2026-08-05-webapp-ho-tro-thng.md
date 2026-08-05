# Kế hoạch: Webapp Nghiệp vụ Hỗ trợ THNG

> Lập theo skill `writing-plans`. Nguồn: `Mau_bao_cao_nghiep_vu_ho_tro_THNG_v2.xlsx`.

## 1. Mục tiêu
Số hóa quy trình báo cáo nghiệp vụ của **Phòng Hỗ trợ (THNG)**: tiếp nhận yêu cầu từ
các phòng ban/khách hàng → phân công → thực hiện & nghiệm thu → ghi nhận phát sinh &
phê duyệt → đánh giá CSAT & đóng ticket, kèm dashboard điều hành.

## 2. Người dùng
- **Người yêu cầu** (các phòng ban / khách hàng): tạo phiếu yêu cầu (E-Form).
- **Điều phối / Trưởng bộ phận Hỗ trợ**: phân công, duyệt phát sinh, theo dõi SLA.
- **Người xử lý (Assignee)**: cập nhật tiến độ, nghiệm thu.
- **Ban giám đốc**: xem dashboard.

## 3. Dữ liệu (theo file mẫu)
- **Ticket** – 52 trường, chia 5 bước: Tiếp nhận & phân loại → Phân công & SLA →
  Thực hiện & nghiệm thu → Phát sinh & phê duyệt → CSAT & đóng.
- **Phát sinh** – gắn với Mã Ticket, có luồng phê duyệt (chờ/duyệt/từ chối...).
- **Danh mục chuẩn hóa** – Loại công việc, Luồng, Đơn vị, Đội hỗ trợ, Ưu tiên,
  Trạng thái, Kết quả nghiệm thu, Loại phát sinh, Trạng thái phê duyệt, ĐVT.
- **Cấu hình SLA** – P1..P4 (phản hồi phút / xử lý giờ), giờ làm việc 08–12 & 13–17.

## 4. Nghiệp vụ tự động
- **Mã ticket** tự sinh `TK-YYYYMMDD-XXXX`.
- **Luồng công việc** tự ánh xạ từ Loại công việc.
- **SLA** tự tra theo Mức độ ưu tiên (P1–P4).
- **Trạng thái SLA màu**: Xanh (an toàn) · Vàng (≥80% ngưỡng) · Đỏ (quá hạn),
  tính theo giờ làm việc thực.
- **Dashboard**: 14 KPI + thống kê theo ưu tiên / luồng / vòng đời 7 trạng thái.

## 5. Kiến trúc bản demo
- **1 file** `webapp/ho-tro-thng/index.html` (HTML + CSS + JS thuần), lưu bằ
  `localStorage` → chạy được ngay, không cần server, mở trên máy tính.
- Có sẵn 1 ticket ví dụ (từ file mẫu) để xem ngay.
- Xuất/nhập dữ liệu JSON; xuất CSV để đối chiếu Excel.

## 6. Màn hình
1. **Dashboard** – KPI + biểu đồ.
2. **Danh sách ticket** – bảng, lọc, tìm kiếm, cột SLA màu.
3. **Tạo/Sửa ticket** – E-Form 5 bước.
4. **Phát sinh & Phê duyệt** – danh sách + duyệt.
5. **Cấu hình / Danh mục** (chỉ đọc, tham chiếu).

## 7. Định hướng nâng cấp (bản thật)
- Chuyển sang `senior-fullstack`: Next.js + PostgreSQL, đăng nhập theo phòng ban,
  phân quyền, đính kèm file thật, email thông báo, SLA chạy nền. Cần bàn hạ tầng.

## 8. Phong cách
Gọn gàng, chuyên nghiệp, **tông xanh công ty**, tối ưu cho màn hình máy tính.
