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
- [x] Phân loại nguyên nhân phát sinh (chủ quan/khách quan/do người yêu cầu) — bắt buộc chọn
- [x] Điểm chất lượng tổng hợp (5 thành phần, trọng số QCONF; hiển thị vòng tròn + phân rã; Dashboard "Điểm chất lượng BQ")
- [x] Cảnh báo xung đột ưu tiên: điều kiện A (P1 trùng) & B (≥3 P1/P2); hộp cảnh báo + danh sách việc đang mở;
      5 phương án; lý do ≥10 ký tự; tab "Lịch sử ưu tiên"; Dashboard "Xung đột ưu tiên"
- [x] Phương án 4: SLA 30' — máy chủ tự áp phương án 2 khi quá hạn (quét mỗi phút)
- [x] Dashboard bổ sung: Trả lại/Từ chối/Mở lại; biểu đồ vòng đời 10 trạng thái
- [x] **Kế hoạch thực hiện (5E)**: form kế hoạch (thời gian DK, phương án, checklist đầu việc con,
      rủi ro, dự phòng, điều kiện tiên quyết, cam kết nhận việc); cổng bắt buộc: không có kế hoạch
      xác nhận + Người thực hiện thì không sang "Đang xử lý"; cảnh báo & bắt lý do khi hoàn tất DK
      trễ hơn thời hạn mong muốn; thanh tiến độ checklist ở chi tiết & danh sách.
      (Đối chiếu kế hoạch↔thực tế tại nghiệm thu: bổ sung ở GĐ3 cùng Báo cáo.)

**→ GIAI ĐOẠN 2 HOÀN TẤT.**

## Giai đoạn 3 — Hồ sơ & kết xuất (đã bổ sung theo v3_2)
- [x] **3a**: Danh mục 10 phòng ban (5B) + 18 loại công việc (5G) mã/luồng/ưu tiên; ô "Khác (ghi rõ)"
      bắt buộc + luồng để Điều phối chọn; tự điền luồng & gợi ý ưu tiên theo loại
- [x] **3b**: Hồ sơ người dùng (5C) tự điền vào phiếu; "Tạo thay người khác"; "Khách hàng bên ngoài"; Thông tin cá nhân; ngưng-hoạt-động chặn đăng nhập
- [x] **3c**: Nhật ký thay đổi (audit log) — máy chủ ghi diff trường, tab riêng, không xóa vết
- [x] **3d**: Thông tin dự án & triển khai (5H) — Danh mục Dự án (quản lý trong Cấu hình + thêm nhanh trong form);
      trường động Nhóm G/H/I/K/L chỉ hiện với loại việc triển khai/giao nhận/bảo hành; cổng chặn chuyển
      "Đang xử lý" khi thiếu trường bắt buộc H/I/L (báo rõ thiếu gì + gợi ý gửi yêu cầu bổ sung);
      nút "Sao chép địa điểm & người nhận từ ticket trước của dự án".
- [x] **3e**: Thông báo chuyển bước 5D (thủ công) — nút "Gửi thông báo" + cửa sổ soạn sẵn + đánh dấu đã/chưa
- [x] **3f**: Đính kèm file thật — tải lên (ảnh/PDF/Word/Excel…) lưu trên đĩa `uploads/` + bảng `files`;
      tải về / xóa theo ticket; giới hạn dung lượng cấu hình được (`maxUpload`).
- [x] **3g**: Trang Báo cáo theo chu kỳ (9B) — nút chọn nhanh (Hôm nay…Năm trước) + khoảng ngày + bộ lọc
      (phòng ban/loại/ưu tiên/người thực hiện/trạng thái); 5 nhóm chỉ tiêu (Khối lượng/SLA/Chất lượng/
      Phát sinh/Điều hành) + bảng xếp theo người; xuất Excel (.xls) + 5 biểu mẫu in PDF A4
      (Phiếu yêu cầu, Phiếu giao việc, Biên bản phát sinh, Phiếu nghiệm thu, Báo cáo kỳ).
- [x] **3h**: Màn "Danh mục & Cấu hình" chỉnh được (ngưỡng SLA, giờ làm T7, trọng số điểm CL, ngưỡng quá tải, dung lượng file)

**→ GIAI ĐOẠN 3 HOÀN TẤT.**

### Ghi chú v3_2 (khác v3_1)
- 5D: bỏ email tự động → nút "Gửi thông báo" thủ công (không cần máy chủ mail).
- 5H (mới): thông tin dự án & triển khai (địa điểm/tầng/người nhận/điều kiện ra vào/yêu cầu KD).
- Các mục khác giữ nguyên.
