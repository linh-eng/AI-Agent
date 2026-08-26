# Lịch sử phiên bản — Sophia Wellness (Quản lý kho)

Số phiên bản hiển thị ở góc dưới sidebar và trang đăng nhập. Quy ước: MAJOR.MINOR.PATCH.
Mỗi bản zip cập nhật đặt tên theo version, ví dụ `sophia-wellness-v1.0.0.zip`.

## 1.16.0 — 2026-08-26
- **Cảnh báo:** thêm **ô lọc** (áp dụng cho tất cả mục) + **sắp xếp theo mức ưu tiên** — cái sắp/đã đến hạn
  hiện lên trên (HSD gần nhất, công nợ đến hạn trước, bảo trì đến hạn trước, sản phẩm thiếu hụt nhiều nhất…).
- **Báo cáo:** thêm **lọc theo nhóm hàng** (áp dụng cho bảng N-X-T + CSV).
- **Thêm ô tìm kiếm/lọc** cho: Liệu trình dịch vụ, Ghi nhận dịch vụ, Tài sản/Thiết bị, Khấu hao, Lịch bảo trì,
  Công nợ, Tay cầm/Shot.
- **Kho Dịch Vụ — HSD sau mở có GIỚI HẠN TỐI ĐA:** HSD sau mở = **min(HSD bao bì, ngày mở + PAO nhóm)**.
  Đặt PAO ở Nhóm hàng (vd Serum 6 tháng; Kem/Mặt nạ 12 tháng; Tinh dầu 12 tháng) → HSD sau mở không vượt quá giới hạn đó.
- **Công nợ:** thêm cột **Trạng thái** (Đã thanh toán / Còn nợ) — tự chuyển “Đã thanh toán” khi trả hết.
- **Lịch bảo trì / sửa chữa:** thêm **Vị trí thiết bị** (Ở kho công ty / Đang ở chỗ bảo trì) và **Ngày dự kiến về kho**
  cho mỗi lần bảo trì (nhập ở form Ghi bảo trì, hiển thị trong lịch sử).
- ⚠️ Có thêm cột mới cho bảo trì → cần chạy **`npm run prisma:push`** khi cập nhật.

## 1.15.0 — 2026-08-26
- **Kho Dịch Vụ (sửa lỗi & làm đúng ý):**
  - **“Còn lại” = TỒN THỰC TẾ của sản phẩm** (tính động từ kho), không còn luôn hiện 0 / “đã hết”.
  - Mỗi sản phẩm chỉ **1 dòng** (gộp, không tách nhiều hộp phân số).
  - **HSD sau mở** ưu tiên **HSD nhập ở sản phẩm**, nếu không có thì ngày mở + PAO nhóm hàng → hiện đúng khi
    đã nhập ngày mua / mở nắp / HSD cho sản phẩm.
  - Trạng thái đúng theo tồn (còn hàng = Đang sử dụng).
- **Bảo trì / sửa chữa:** thêm **Sửa** và **Xóa** từng bản ghi trong “Lịch sử bảo trì / sửa chữa”.
- **Nhập liệu bằng Enter:** form **Thêm/Sửa đợt thanh toán**, **Ghi bảo trì**, **Ghi sản lượng** nay bấm
  **Enter để nhảy sang ô kế tiếp** (kể cả ô không bắt buộc), thay vì lưu sớm.
- Không đổi cấu trúc database so với 1.14.0 (chỉ cần `prisma:push` nếu cập nhật từ bản trước 1.14.0).

## 1.14.1 — 2026-08-21
- **Sửa lỗi thiếu quyền (nút Thêm/Sửa thanh toán không hiện):** quyền đăng nhập nay lấy theo **mã nguồn
  (`rbac.ts`)** hợp với DB — khi có quyền mới (vd `asset.manage`), **chỉ cần ĐĂNG NHẬP LẠI** là có ngay,
  **không cần chạy `db:sync-rbac`** nữa. Quản trị có đủ mọi quyền. → Sau khi cập nhật, **đăng xuất rồi đăng nhập lại**
  là mục Thanh toán & Công nợ hiện nút **Thêm đợt / Sửa** đầy đủ.
- Không đổi database (không cần `prisma:push`).

## 1.14.0 — 2026-08-21
- **Kho Dịch Vụ:**
  - Thêm cột **Mã liệu trình** (bấm vào → mở trang Liệu trình và tô sáng đúng liệu trình đã mở hộp).
  - **HSD sau mở nắp** nay **tính động** theo PAO hiện tại của nhóm hàng (đặt “Hạn dùng sau mở nắp” ở
    Nhóm hàng là hiện ngay, kể cả hộp đã mở trước đó).
  - **Bỏ nút Xóa** (tránh lệch dữ liệu — hàng vào đây là do Ghi nhận dịch vụ tự xuất). Vẫn giữ Sửa còn lại / Đánh dấu đã hết.
  - Cột **Còn lại** rõ hơn: hiện “còn X {đơn vị}” + “đã dùng …”.
- **Công nợ tài sản:** nhật ký thanh toán thêm cột **Lũy kế đã trả** (cộng dồn qua từng đợt) — đọc lịch sử rõ ràng.
  (Thêm/sửa đợt, ngày, tự tính còn nợ đã có từ 1.12.0.)
- **Windows:** thêm `scripts/windows/KHOI-DONG-LAI.bat` — **chuột phải → Run as administrator** để **tự tắt server cũ
  rồi chạy bản mới** (khỏi bị lỗi cổng 9000 đang bận khi cập nhật).
- ⚠️ Có thêm cột mới (liệu trình của hộp) → cần chạy **`npm run prisma:push`** khi cập nhật.

## 1.13.0 — 2026-08-20
- **Kho Dịch Vụ — liên kết theo MÃ HÀNG HÓA (bỏ điều kiện HSD):** khi Ghi nhận dịch vụ, **mọi** vật tư/hàng hóa
  được tiêu hao đều **tự ghi nhận sang Kho Dịch Vụ** theo mã hàng — không còn phụ thuộc việc có/không có HSD.
  Hàng có HSD sau mở (PAO nhóm) thì tính hạn, hàng không HSD vẫn lưu đầy đủ dữ liệu tiêu hao (không bị mất).
- **Khấu hao TÍNH THEO NGÀY:** khấu hao/ngày = Nguyên giá ÷ tổng số ngày; **lũy kế phản ánh đúng số ngày thực tế**
  đã trôi qua kể từ ngày bắt đầu (mặc định = **Ngày mua / ngày ghi trên chứng từ**). Bảng theo năm chốt đúng về 0.
  Trang chi tiết hiển thị thêm **Khấu hao / ngày**.
- **Thanh toán & Công nợ (đã có từ 1.12.0, nhắc lại):** mỗi lần trả là **1 dòng trong nhật ký** (không gộp tổng);
  **sửa số tiền & ngày** từng đợt; **còn phải trả tự cập nhật** theo các đợt đã ghi.
- Không đổi cấu trúc database so với 1.12.0 (chỉ cần `prisma:push` nếu cập nhật từ bản trước 1.12.0).

## 1.12.0 — 2026-08-20
- **Khấu hao tài sản:**
  - **Chỉnh sửa khấu hao ngay tại trang Khấu hao** (nút ✏️ mỗi tài sản — nguyên giá, phương pháp, số tháng,
    ngày bắt đầu, tổng sản lượng).
  - **Tự trích khấu hao từ Ngày mua**: nếu không nhập “Ngày bắt đầu”, hệ thống dùng **Ngày mua**.
  - **Đường thẳng theo đúng công thức**: Khấu hao/tháng = **Nguyên giá ÷ Số tháng**; Lũy kế = cộng dồn từ
    ngày bắt đầu; **Giá trị còn lại = Nguyên giá − Lũy kế** (giảm dần về 0).
- **Thanh toán & Công nợ tài sản:**
  - **Sửa đợt thanh toán** (nút ✏️): cập nhật số tiền, ngày, phương thức, ngân hàng, chứng từ → **tự tính lại công nợ**.
  - **Ngày đến hạn thanh toán** + **cảnh báo công nợ sắp/đến hạn** ở Trung tâm cảnh báo (badge menu đếm cả mục này).
  - (Thông tin ngân hàng + đính kèm Ủy nhiệm chi/Hóa đơn VAT/Hợp đồng đã có sẵn.)
- **Sửa lỗi đồng bộ Kho Dịch Vụ:** Ghi nhận dịch vụ nay **báo rõ** đã cập nhật Kho Dịch Vụ hay chưa
  (trước đây lỗi bị ẩn). Lưu ý: chỉ hàng **“Theo dõi HSD”** mới vào Kho Dịch Vụ; cần đã chạy `prisma:push`.
- ⚠️ Có thêm cột mới (ngày đến hạn thanh toán) → cần chạy **`npm run prisma:push`** khi cập nhật.

## 1.11.0 — 2026-08-20
- **Lọc & Chỉnh sửa danh mục:**
  - **Nhà cung cấp:** thêm ô **tìm kiếm** (mã/tên/người liên hệ/ĐT/MST, bỏ dấu) + nút **Sửa** từng NCC.
  - **Thương hiệu:** thêm ô **tìm kiếm** + nút **Sửa** từng thương hiệu.
  - **Nhóm hàng:** thêm ô **tìm kiếm** (mã/tên).
- **Nhập Excel — điền bù dữ liệu còn thiếu (không ghi đè):** khi nhập **Sản phẩm** mà **SKU đã tồn tại**
  (hoặc nhập **Tài sản** mà **số serial đã tồn tại**), hệ thống **chỉ điền vào các ô đang trống** từ file Excel,
  **giữ nguyên** dữ liệu cũ đã có — thay vì báo lỗi trùng. Kết quả nhập hiển thị thêm số **“Điền bù ô trống”**.
- Chỉ thêm/sửa giao diện + logic — không đổi database, không thêm quyền.

## 1.10.1 — 2026-08-19
- Thêm nút **“Nhập Excel”** ngay trong trang **Sản phẩm, Tài sản/Thiết bị, Nhập kho, Xuất kho**
  (cạnh nút “Thêm…”) — bấm là mở thẳng đúng mục ở trang *Nhập liệu Excel*. Không cần vào menu Hệ thống nữa.
- Chỉ sửa giao diện — không đổi database, không thêm quyền.

## 1.10.0 — 2026-08-19
- **Nhập liệu bằng Excel** (menu Hệ thống → *Nhập liệu Excel*): tạo hàng loạt cho **Sản phẩm,
  Tài sản/Thiết bị, Nhập kho, Xuất kho** từ file `.xlsx`.
  - Mỗi mục có nút **Tải form mẫu** (.xlsx gồm sheet dữ liệu + sheet *Hướng dẫn* có ví dụ từng cột).
  - Tải file lên → hệ thống **kiểm tra & báo lỗi theo từng dòng/phiếu** (SKU trùng, thiếu nhóm hàng/kho/NCC,
    thiếu số lượng, xuất vượt tồn…), dòng hợp lệ vẫn được tạo.
  - **Nhập kho / Xuất kho nhiều dòng**: gộp theo cột *“Mã phiếu (gộp dòng)”*; tái dùng đúng nghiệp vụ hiện có
    (sinh lô + bút toán khi nhập; **FEFO** khi xuất). Tham chiếu nhóm hàng/kho/NCC/SKU theo **mã hoặc tên**.
  - Phân quyền theo từng mục (chỉ hiện mục người dùng có quyền tạo).
- Thêm thư viện đọc Excel (`xlsx`) → khi cập nhật **nhớ chạy `npm install`** (không cần `prisma:push`).

## 1.9.0 — 2026-08-18
- **Phân hệ "Quản lý tài sản"** (nhóm menu mới) — 3 trang báo cáo tổng hợp theo nhiều tài sản
  & theo thời gian, đọc từ dữ liệu sẵn có (nhập liệu vẫn ở trang chi tiết tài sản):
  - **Khấu hao** (`/asset-depreciation`): bảng chi tiết từng tài sản (nguyên giá / đã khấu hao
    lũy kế / còn lại / % / khấu hao xong) + **bảng quá trình khấu hao theo năm gộp toàn danh mục**;
    chọn mốc "tính đến ngày"; **xuất CSV**.
  - **Lịch bảo trì** (`/asset-maintenance`): bảng theo dõi bảo trì định kỳ toàn bộ thiết bị —
    lần gần nhất, kế tiếp, số ngày tới hạn, trạng thái (Quá hạn / Đến hạn / Bình thường);
    thẻ tổng hợp số lượng; **xuất CSV**.
  - **Công nợ tài sản** (`/asset-debts`): tổng hợp đồng / đã thanh toán / còn công nợ / tiến độ
    theo từng tài sản + dòng tổng cộng; **xuất CSV**.
- Menu cũ "Dịch vụ & Thiết bị" tách thành **"Dịch vụ"** và **"Quản lý tài sản"** (gộp Tài sản/Thiết bị,
  Khấu hao, Lịch bảo trì, Công nợ, Tay cầm/Shot).
- Chỉ thêm giao diện + API đọc — **không đổi database, không thêm quyền**. Cập nhật chỉ cần giải nén đè.

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
