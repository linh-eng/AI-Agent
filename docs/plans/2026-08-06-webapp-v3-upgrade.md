# Kế hoạch nâng cấp WebApp Hỗ trợ THNG lên v3

> Nguồn: DACTAYEUCAUWebAppHotroTHNGv3.pdf. Triển khai theo 3 giai đoạn.
> Chốt với chị: T2–T6 (SLA cấu hình được) · trọng số điểm chất lượng cho chỉnh trong Cấu hình ·
> chưa cần email · danh mục Loại việc/Phòng ban giữ hiện có + cho chỉnh · ngưỡng quá tải ≥3 P1/P2.

## Giai đoạn 1 — Lõi quy trình & sửa lỗi
### Đợt 1a (XONG)
- [x] Bỏ mật khẩu mẫu trên màn hình đăng nhập
- [x] Mật khẩu ≥8 ký tự (chữ+số); bắt buộc đổi lần đầu (modal chặn)
- [x] Tự đăng xuất sau 20' không hoạt động
- [x] Mã ticket theo NGÀY TIẾP NHẬN
- [x] Dashboard tách "đang quá hạn (chưa đóng)" và "đã vi phạm (đã đóng)"

### Đợt 1b (XONG)
- [x] Quy trình 4 bước / 10 trạng thái, luồng hai chiều (trả lại/từ chối/tạm dừng/mở lại)
- [x] Panel "Hành động tiếp theo" theo trạng thái, bắt buộc ghi lý do cho thao tác lùi/từ chối/tạm dừng/mở lại
- [x] Bước 2 chốt ưu tiên chính thức (ghi lý do nếu hạ cấp) — hộp Tiếp nhận
- [x] Cổng kế hoạch tối thiểu: phải có Người thực hiện trước khi Đang xử lý (5E đầy đủ: GĐ2)
- [x] Đồng hồ SLA dừng/chạy theo lịch sử + hiển thị tổng trôi / đã dừng / tính SLA thực tế
- [x] Lịch sử trạng thái (nền tảng cho SLA & audit log)

## Cập nhật theo đặc tả v3_1 (mở rộng) — xếp vào GĐ2/GĐ3
- [ ] 5B: 10 phòng ban chuẩn, cấu hình được (thêm/sửa/ẩn)
- [ ] 5C: Hồ sơ người dùng tự điền vào phiếu; "Tạo thay người khác"; "Khách hàng bên ngoài"
- [ ] 5E: Kế hoạch thực hiện đầy đủ (đầu việc con/checklist, rủi ro, đối chiếu kế hoạch↔thực tế)
- [ ] 5F: Nhập nhân sự hàng loạt từ Excel + tự sinh mật khẩu + ngưng-hoạt-động thay vì xóa
- [ ] 5G: 16 loại công việc + ô "Khác" + trường động theo loại; thống kê "Khác" gợi ý bổ sung
- [ ] 5D: Email theo sự kiện (18 sự kiện, snapshot PDF, digest, bản tin sáng, nhật ký mail) — CHỜ CHỐT (chị từng nói chưa cần; v3_1 đánh dấu bắt buộc)
- [ ] 9B: Báo cáo theo chu kỳ ngày/tuần/tháng/năm + khoảng ngày, so sánh kỳ trước, xuất Excel/PDF

## Giai đoạn 2 — Ra quyết định
- [ ] Cảnh báo xung đột ưu tiên (điều kiện A/B, 5 phương án, lý do ≥10 ký tự,
      phương án 4 SLA 30' tự chuyển phương án 2), tab "Lịch sử ưu tiên",
      thẻ Dashboard "Số lần xung đột ưu tiên"
- [ ] Điểm chất lượng tổng hợp (5 thành phần, trọng số cấu hình được)
- [ ] Phân loại nguyên nhân phát sinh (chủ quan/khách quan/do người yêu cầu)

## Giai đoạn 3 — Hồ sơ & kết xuất
- [ ] Nhật ký thay đổi (audit log) — không xóa vết
- [ ] Đính kèm file thật (ảnh/PDF/Word/Excel), giới hạn cấu hình
- [ ] Trang Báo cáo (điểm CL theo người/tháng/loại, SLA, phát sinh theo nguyên nhân, xung đột)
- [ ] Xuất Excel; 5 biểu mẫu in PDF A4
- [ ] Danh mục & SLA cấu hình được (loại việc, luồng, ưu tiên, ngưỡng SLA, giờ làm việc, trọng số)
