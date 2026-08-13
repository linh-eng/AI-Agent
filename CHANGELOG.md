# Lịch sử phiên bản — Sophia Wellness (Quản lý kho)

Số phiên bản hiển thị ở góc dưới sidebar và trang đăng nhập. Quy ước: MAJOR.MINOR.PATCH.
Mỗi bản zip cập nhật đặt tên theo version, ví dụ `sophia-wellness-v1.0.0.zip`.

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
