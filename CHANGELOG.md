# Lịch sử phiên bản — Sophia Wellness (Quản lý kho)

Số phiên bản hiển thị ở góc dưới sidebar và trang đăng nhập. Quy ước: MAJOR.MINOR.PATCH.
Mỗi bản zip cập nhật đặt tên theo version, ví dụ `sophia-wellness-v1.0.0.zip`.

## 1.8.2 — 2026-08-18
- **Thanh toán & Công nợ (rà soát bổ sung):**
  - Thêm **thanh tiến độ thanh toán** (% đã trả trên tổng hợp đồng).
  - **File đính kèm theo từng đợt**: mỗi đợt thanh toán có thể **thêm nhiều file** (ủy nhiệm chi…)
    và **xóa từng file** riêng, không chỉ 1 file lúc tạo.
  - Hiển thị **ghi chú** của mỗi đợt thanh toán.
- Chỉ sửa giao diện — không cần `prisma:push`.

## 1.8.1 — 2026-08-18
- **Bảo hành – Bảo trì (rà soát bổ sung):**
  - Hiển thị **Thời gian bảo hành** + **tự tính Ngày hết hạn bảo hành** = ngày mua + thời gian BH
    (khi chưa nhập ngày hết hạn trực tiếp); cảnh báo bảo hành cũng dùng mốc tính này.
  - Lịch sử bảo trì thêm cột **"Người thực hiện"** (tách khỏi Đơn vị/hãng và Người ghi).
  - **Badge đếm cảnh báo** ở menu "Cảnh báo" (thông báo tự động, tự làm mới mỗi 5 phút).
- ⚠️ Có thêm cột mới (người thực hiện) → cần chạy `npm run prisma:push` khi cập nhật.

## 1.8.0 — 2026-08-18
- **Khấu hao — bổ sung phương pháp "Theo sản lượng"** (units of production): nhập tổng sản lượng ước
  tính; **ghi nhận sản lượng theo thời gian** (số shot/lượt/giờ chạy) ở trang chi tiết tài sản → hệ thống
  tính khấu hao/đơn vị, lũy kế, giá trị còn lại và **bảng theo dõi theo thời gian** từ các lần ghi nhận.
- Thời gian khấu hao nay hiển thị kèm quy đổi **năm + tháng**.
- ⚠️ Có thêm cột/bảng mới → cần chạy `npm run prisma:push` khi cập nhật.

## 1.7.0 — 2026-08-18
- **(c) Thanh toán & Công nợ tài sản:** thêm Tổng giá trị hợp đồng + Hình thức quản lý (công nợ/hóa
  đơn/hợp đồng) cho tài sản; theo dõi **đã thanh toán / còn công nợ**; quản lý **các đợt thanh toán**
  (số tiền, ngày, phương thức tiền mặt/chuyển khoản, ngân hàng, hình thức chi trả: qua công ty / cá nhân
  tạm ứng / khác, ghi chú). **Đính kèm file** (Hợp đồng, Hóa đơn VAT, Ủy nhiệm chi) lưu trong hệ thống,
  ≤5MB/file, xem/tải trực tiếp. Quản lý ở trang chi tiết tài sản; thêm/xóa đợt thanh toán & file chỉ
  ADMIN/MANAGER (asset.manage).
- ⚠️ Có thêm bảng/cột mới → cần chạy `npm run prisma:push` khi cập nhật.

## 1.6.0 — 2026-08-18
- **(a) Khấu hao tài sản:** thêm nguyên giá, giá trị thu hồi, ngày bắt đầu, thời gian (tháng),
  phương pháp (đường thẳng / số dư giảm dần). Trang chi tiết tài sản hiển thị giá trị đã khấu hao
  lũy kế, giá trị còn lại, % tiến độ và **bảng theo dõi khấu hao theo năm**; danh sách tài sản thêm cột
  "GT còn lại".
- **(b) Bảo hành – Bảo trì:** thêm hãng/đơn vị bảo hành, thời gian BH, **chu kỳ bảo trì định kỳ**;
  chi tiết tài sản hiển thị bảo trì gần nhất + **kế tiếp**; **Trung tâm cảnh báo** thêm mục
  "Bảo trì định kỳ đến hạn" (tự cảnh báo khi sắp/quá hạn).
- ⚠️ Có thêm cột mới cho tài sản → cần chạy `npm run prisma:push` khi cập nhật.
- (Phân hệ (c) Thanh toán & Công nợ tài sản sẽ ở bản kế tiếp.)

## 1.5.0 — 2026-08-18
- **Phân hệ Kho Dịch Vụ** (menu Dịch vụ & Thiết bị): sổ theo dõi hàng đã mở nắp/dùng dở cho
  dịch vụ. Khi Ghi nhận dịch vụ tiêu hao hàng có HSD (requiresExpiry), hệ thống tự tạo/cập nhật
  "hộp đã mở": trừ dần định mức, hết thì tự mở hộp mới. Hiển thị: mã/tên hàng, ngày mở nắp,
  người mở/cập nhật, còn lại, HSD sau mở (= ngày mở + PAO nhóm), định mức theo từng dịch vụ,
  trạng thái (Đang sử dụng / Đã hết / Sắp/Hết HSD). Cho điều chỉnh còn lại, đánh dấu hết, xóa (SERVICE_WRITE).
- ⚠️ Có thêm bảng mới → cần chạy `npm run prisma:push` khi cập nhật.

## 1.4.0 — 2026-08-18
- **Chỉnh sửa sản phẩm:** thêm nút ✏️ ở mỗi sản phẩm để cập nhật/bổ sung thông tin sau khi tạo.
- **Tài sản/thiết bị:** khi sửa nay cho phép cập nhật thêm Kho + Nhà cung cấp (trước chỉ lúc tạo).
- **Phân quyền riêng cho sửa** (giới hạn ADMIN/MANAGER): thêm quyền `product.manage`,
  `asset.manage`. Tài khoản không có quyền sẽ không thấy nút sửa và không sửa được (chặn ở server).
- ⚠️ Sau khi cập nhật cần chạy `npm run db:sync-rbac` rồi ĐĂNG NHẬP LẠI để nạp quyền mới.

## 1.3.1 — 2026-08-14
- Thêm bộ script **tự khởi động khi bật máy (Windows)** trong `scripts/windows/`:
  `install-autostart.bat` (mở cổng 9000 + tạo tác vụ tự chạy khi đăng nhập),
  `run-hidden.vbs` (chạy ẩn), `start-server.bat`, `stop-server.bat`, `uninstall-autostart.bat`
  và file hướng dẫn. Không đổi tính năng bên trong app.

## 1.3.0 — 2026-08-14
- **Xóa dữ liệu nghiệp vụ (dọn demo):** nút trong trang Sao lưu & Phục hồi (chỉ Quản trị, gõ
  "XOA" để xác nhận) — xóa sạch sản phẩm, nhóm hàng, NCC, kho, tồn/lô, phiếu, kiểm kê, dịch vụ,
  tài sản, tay cầm… nhưng **giữ nguyên người dùng, phân quyền và cài đặt công ty**.
- Kèm lệnh `npm run db:clear-demo` cho ai thích dùng dòng lệnh.

## 1.2.0 — 2026-08-14
- **Hủy ghi nhận dịch vụ:** trang Ghi nhận dịch vụ có nút **Hủy** (chỉ Quản trị/Quản lý) —
  tự **hoàn lại tồn kho** (hủy phiếu xuất tiêu hao liên quan, giữ phiếu ở trạng thái ĐÃ HỦY để
  tra cứu) và gỡ ghi nhận khỏi doanh thu; bắt buộc lý do, ghi `audit_logs`.
- Thông báo khi cố hủy trực tiếp phiếu xuất sinh từ dịch vụ nay chỉ rõ đường xử lý đúng.

## 1.1.1 — 2026-08-14
- **Sửa lỗi:** phiếu nhập/xuất nhiều dòng hàng đôi khi **không lưu được mà không báo lỗi**
  (do ô chọn gõ-tìm đặt `required` ẩn khiến trình duyệt chặn submit im lặng). Nay:
  - Bỏ ô ẩn `required` ở Combobox; kiểm tra bắt buộc bằng JS + **báo lỗi rõ ràng**.
  - Phiếu nhập/xuất tự **bỏ qua dòng trống**, báo cụ thể nếu có dòng thiếu sản phẩm/số lượng.

## 1.1.0 — 2026-08-14
- **Module Sao lưu & Phục hồi** (menu Hệ thống, chỉ Quản trị):
  - Tải toàn bộ dữ liệu (kèm logo công ty) về 1 tệp `.json`.
  - Khôi phục từ tệp `.json` — ghi đè toàn bộ dữ liệu hiện tại (có cảnh báo, ghi `audit_logs`).
- Không đổi cấu trúc database (không cần `prisma:push`).

## 1.0.0 — 2026-08-13
Mốc phát hành đầu tiên có **đánh số phiên bản** (gộp toàn bộ cập nhật theo góp ý demo).

**Tính năng chính**
- Nhập/Xuất kho theo lô + HSD (FEFO); **sửa/hủy phiếu** nhập–xuất (chỉ Quản trị/Quản lý, bắt buộc lý do, tự hoàn tồn).
- Chuyển kho, kiểm kê, dịch vụ/liệu trình, tài sản/thiết bị, tay cầm đếm shot, báo cáo N-X-T + doanh thu.

**Cải tiến theo góp ý demo**
- Ô chọn **gõ để tìm** (bỏ dấu tiếng Việt) cho sản phẩm, NCC, liệu trình, thương hiệu, nhóm hàng, tài sản, vật tư dịch vụ.
- Nhấn **Enter** nhảy sang ô kế tiếp trong mọi form (kể cả ô gõ-tìm).
- Danh sách nhà cung cấp hiển thị thêm **Địa chỉ** + **Mã số thuế**.
- **Chặn ghi shot vượt định mức** tay cầm.
- Ghi nhận dịch vụ + trang liệu trình **cảnh báo thiếu tồn ngay** khi định mức vượt tồn.
- **Mốc HSD cấp sản phẩm** (ngày mua / mở nắp / HSD) + tự tính số ngày còn lại.
- **Hạn dùng sau mở nắp (PAO) theo nhóm hàng**: sau khi mở nắp, HSD thực tế = ngày mở nắp + hạn sau mở.
- **Cảnh báo tồn lâu chưa mở nắp** (thêm mục ở Trung tâm cảnh báo).

**Sửa lỗi / trải nghiệm**
- Báo lỗi trùng (SKU/mã vạch/mã nhóm…) bằng tiếng Việt rõ ràng, hết log `prisma:error` đỏ khi nhập trùng.
- Script `npm run db:sync-rbac` để nạp quyền mới an toàn (không đụng dữ liệu).

---

> Cách cập nhật: giải nén đè bản zip. Nếu ghi chú bản phát hành có "đổi database" thì chạy thêm
> `npm run prisma:push` trước khi khởi động lại; nếu chỉ sửa giao diện/logic thì không cần.
