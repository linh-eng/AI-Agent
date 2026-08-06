# HƯỚNG DẪN SỬ DỤNG — WEBAPP QUẢN LÝ KHO THNG

Tài liệu dành cho nhân viên sử dụng hệ thống quản lý kho (Nhập – Xuất – Lắp ráp –
Tháo dỡ – Truy vết Serial).

---

## 1. Đăng nhập

1. Mở trình duyệt (Chrome/Edge/Cốc Cốc), gõ địa chỉ do quản trị cung cấp, ví dụ:
   **`http://192.168.1.50:7000`**
2. Nhập **Email** và **Mật khẩu** được cấp → bấm **Đăng nhập**.
3. Muốn thoát: bấm **Đăng xuất** ở góc trên bên phải.

> Mỗi người một tài khoản riêng. Không dùng chung tài khoản để hệ thống ghi đúng
> ai đã thao tác (phục vụ truy vết).

---

## 2. Giao diện chung

- **Thanh menu bên trái:** các chức năng chính. Menu hiển thị **tùy theo quyền** của
  từng người (ví dụ chỉ Admin thấy mục *Người dùng*).
- **Góc trên bên phải:** tên và vai trò của bạn + nút Đăng xuất.
- Trên điện thoại/máy tính bảng: bấm biểu tượng ☰ để mở menu.

---

## 3. Vai trò & quyền

| Vai trò | Làm được gì chính |
|---|---|
| **Admin** | Toàn quyền + quản lý người dùng, cấu hình |
| **Ban Giám đốc** | Xem tất cả; **duyệt** kiểm kê, duyệt rã máy, duyệt xuất vượt khóa dự án |
| **Mua hàng** | Tạo phiếu nhập, quản lý NCC |
| **Kế toán kho** | Nhập hệ thống, quản lý sản phẩm/đối tác, **duyệt xuất kho** |
| **Thủ kho** | Nhận hàng, quét serial, cất kệ, cấp phát, lấy hàng, đóng gói, kiểm kê |
| **Kỹ thuật/Lắp ráp** | Lắp ráp, ghi as-built, QC, rã máy, xử lý RMA |
| **QC** | Kiểm tra chất lượng |
| **Kinh doanh** | Tạo phiếu xuất, lệnh lắp ráp |
| **Bảo hành/Dịch vụ** | Tiếp nhận máy lỗi, RMA, đòi bảo hành NCC |

> Nếu bấm vào chức năng mà báo **"Không có quyền"**, nghĩa là vai trò của bạn không
> được phép — liên hệ Admin.

---

## 4. Quy trình tổng thể

```
Danh mục (kho, dự án, NCC, sản phẩm)
      ↓
NHẬP KHO  →  (LẮP RÁP nếu là máy lắp)  →  TỒN KHO
      ↓
XUẤT KHO (duyệt → lấy hàng → bàn giao)
      ↓
BẢO HÀNH / RÃ MÁY (khi có phát sinh)
      ↓
KIỂM KÊ định kỳ  •  BÁO CÁO
```

---

## 5. Hướng dẫn từng chức năng

### 5.1. Danh mục nền tảng (cài đặt ban đầu)

Làm trước khi nhập/xuất. Thường do **Kế toán kho / Admin** thiết lập.

- **Danh mục kho:** 12 kho cố định (K-TM Thương mại, K-DA Dự án, K-LK Linh kiện,
  K-HH Hư hỏng...). Kho có cột *"Tính tồn khả dụng"* = hàng có được tính để bán hay không.
- **Vị trí kệ:** tạo Khu vực (Zone) → tạo Vị trí (Bin) để cất hàng theo kệ.
- **Dự án:** mã dự án + khách hàng. Hàng gắn dự án bị **khóa** — không xuất cho khách khác.
- **NCC / Khách hàng:** nhà cung cấp và khách hàng (có hạn mức công nợ).
- **Sản phẩm:** mỗi mặt hàng chọn **chế độ quản lý**:
  - *Serial:* laptop, màn hình... (quét từng máy)
  - *Lô:* mực in, linh kiện có lô (ghi số lô + số lượng)
  - *Số lượng:* cáp, ốc... (chỉ đếm)
  - *License:* phần mềm bản quyền (mã key)

**Cách thêm:** vào mục tương ứng → bấm **+ Thêm** → điền form → **Lưu**.

### 5.2. Nhập kho

**Ai dùng:** Mua hàng / Kế toán kho / Thủ kho.

1. Vào **Nhập kho → + Tạo phiếu nhập**.
2. Chọn **Loại nghiệp vụ** (N1 Mua mới, N2 Hàng dự án, ...). Hệ thống tự hiện
   **checklist chứng từ bắt buộc** và **kho đích**.
3. Chọn **NCC**, nhập **PO**, **Hóa đơn**. Thêm các **dòng hàng** (sản phẩm, số lượng,
   dự án hoặc đánh dấu *hàng thương mại*).
4. Bấm **Tạo phiếu** → mở màn **Nhận hàng**.
5. Tại màn nhận hàng, với hàng **Serial:** quét/nhập từng serial (mỗi dòng 1 serial),
   chọn **vị trí kệ**, nhập **xuất xứ (CO/CQ/tờ khai)** và **hạn bảo hành** (hãng + THNG).
   Hàng **Lô:** nhập số lô + số lượng.
6. Nếu hàng bị lỗi: tích **"Hàng lỗi"** → hệ thống chuyển thẳng vào kho **K-HH**.
7. Bấm **Xác nhận nhận hàng** → tồn được ghi vào kho, sinh serial + lịch sử.

### 5.3. Lắp ráp (máy lắp từ linh kiện)

**Ai dùng:** Kinh doanh (tạo lệnh) + Kỹ thuật (thực hiện).

1. **Lắp ráp → + Tạo lệnh lắp ráp:** chọn *lắp theo đơn* hoặc *để tồn kho*, chọn
   thành phẩm, thêm **BOM kế hoạch** (linh kiện dự kiến).
2. Vào chi tiết lệnh:
   - **Cấp phát linh kiện:** quét serial linh kiện → chuyển vào kho WIP (đang lắp).
   - **QC / Burn-in:** nhập kết quả (Đạt/Không đạt) + số giờ chạy thử.
   - **Hoàn thành:** nhập **serial thành phẩm**, chọn linh kiện lắp vào máy, gắn
     **bảo hành THNG**, gán **license** (nếu cài phần mềm) → bấm **Hoàn thành**.
3. Máy thành phẩm được nhập kho; linh kiện thừa tự trả về kho linh kiện; hệ thống
   lưu **cấu hình as-built** để truy vết sau này.

### 5.4. Tồn kho

**Ai dùng:** tất cả (chỉ xem).

- Xem tồn **theo kho** và **theo sản phẩm**: *Thực tế / Khả dụng / Đang giữ / WIP*.
- **Khả dụng** = hàng thật sự có thể bán (không tính hàng trong máy, không tính kho
  hư hỏng/bảo hành).
- Khu **Cảnh báo:** hàng dưới tồn tối thiểu, hàng tồn lâu, linh kiện sắp hết bảo hành
  hãng khi còn trong kho.

### 5.5. Xuất kho

**Ai dùng:** Kinh doanh/Thủ kho (tạo & lấy hàng) + Kế toán (duyệt).

1. **Xuất kho → + Tạo phiếu xuất:** chọn loại (X1 Bán, X2 Giao dự án, X8 Cho thuê...),
   khách hàng/dự án, thêm dòng hàng → **Tạo phiếu**.
2. Bấm **Trình duyệt**.
3. **Kế toán** vào duyệt: hệ thống **chặn nếu bán vượt tồn** hoặc quá hạn mức công nợ.
   Có thể **Duyệt** hoặc **Từ chối kèm lý do**.
4. Sau khi duyệt, **Thủ kho** vào **Picking:** quét **đủ 100% serial** thực xuất
   (sai serial/sai hàng/không khả dụng → hệ thống chặn).
   - Hàng khóa theo dự án khác → bị chặn, cần người có quyền duyệt mở khóa.
5. **Đóng gói & bàn giao:** nhập hình thức giao, đơn vị vận chuyển, **mã vận đơn**,
   ký điện tử, (hàng giá trị cao) link video đóng gói → bấm **Xuất & bàn giao**.
6. Có thể bấm **In** để in **Biên bản bàn giao**.

### 5.6. Bảo hành / RMA

**Ai dùng:** Bảo hành/Dịch vụ.

1. **Bảo hành / RMA → Tiếp nhận bảo hành (N3):** nhập serial máy khách gửi, tình trạng,
   tem niêm phong → máy chuyển vào kho **K-BH-KH**.
2. **Phân luồng** phiếu tiếp nhận:
   - *Gửi hãng* (còn bảo hành) → tạo phiếu RMA, theo dõi **SLA** (cảnh báo quá hạn).
   - *Sửa có phí* → kho sửa chữa K-SC.
   - *Không sửa được* → kho hư hỏng K-HH (phải chốt xử lý trong **15 ngày**).
3. **Hãng trả về:** chọn *Sửa xong* (trả khách) hoặc *Thay mới* → serial cũ được đánh
   dấu đã thay, sinh serial mới, đồng bộ bảo hành; nếu linh kiện cũ còn hạn hãng, hệ
   thống **tự mở phiếu đòi bảo hành ngược NCC**.
4. **K-HH:** với mỗi máy hỏng, bấm **Chốt** hướng xử lý (trả NCC / bồi thường / tận
   dụng linh kiện / thanh lý).

### 5.7. Rã máy (tháo dỡ)

**Ai dùng:** Kỹ thuật (đề nghị & thực hiện) + BGĐ (duyệt).

1. **Rã máy → Đề nghị rã máy:** nhập serial máy + lý do.
2. **Ban Giám đốc duyệt** (bắt buộc).
3. Sau khi duyệt, vào **Thực hiện:** hệ thống liệt kê linh kiện theo as-built; chọn
   **grade A/B/C** cho từng linh kiện thu hồi (hoặc đánh dấu hỏng) → **Thực hiện rã máy**.
   Máy cha chuyển trạng thái *Đã rã*; linh kiện thu hồi về kho **K-TMAY**.

### 5.8. Kiểm kê

**Ai dùng:** Thủ kho (đếm) + BGĐ (duyệt).

1. **Kiểm kê → + Tạo phiếu kiểm kê:** chọn kho cần kiểm.
2. **Quét serial thực tế** đang có trong kho.
3. Hệ thống tự so lệch: **Khớp / Thiếu / Thừa**.
4. Bấm **Trình duyệt** → **Ban Giám đốc duyệt** → hệ thống sinh **bút toán điều chỉnh**.

### 5.9. Serial (truy vết) & In tem

**Ai dùng:** tất cả.

- **Serial:** tìm theo số serial/SKU, lọc theo kho/trạng thái.
- Bấm vào một serial để xem **truy vết hai chiều**:
  - *Xuôi:* máy → cây linh kiện bên trong → xuất xứ/PO/NCC.
  - *Ngược:* linh kiện → máy cha → dự án → khách hàng.
- Trong cửa sổ truy vết có nút **In tem** để in tem serial.

### 5.10. Lô hàng

Xem danh sách các lô (hàng quản lý theo lô): số lô, số lượng, ngày SX, hạn dùng.

### 5.11. Báo cáo

**Ai dùng:** Quản lý/BGĐ/Kế toán.

- Báo cáo tổng hợp: **Nhập–Xuất–Tồn theo kho**, **theo NCC** (tỷ lệ lỗi), **tồn đọng
  quá hạn** (K-HH, K-BH-NCC), hiệu quả lắp ráp, bảo hành, rã máy.
- Nút **CSV** để tải về mở bằng Excel; nút **In báo cáo** để in.

### 5.12. Quản lý người dùng (chỉ Admin)

1. **Người dùng → + Thêm người dùng:** nhập email, họ tên, mật khẩu, chọn **vai trò**.
2. Bấm **Sửa** ở mỗi dòng để: đổi họ tên, **đặt lại mật khẩu**, đổi vai trò,
   **khóa/mở** tài khoản.

> Việc đầu tiên nên làm: tạo tài khoản riêng cho từng nhân viên và **đổi mật khẩu
> các tài khoản mẫu** (admin123...).

---

## 6. Quy tắc quan trọng cần nhớ

- **Serial không bao giờ bị xóa** — chỉ đổi trạng thái (đảm bảo truy vết).
- Mọi hàng luôn **thuộc một kho**; chuyển kho đều có ghi nhận.
- Nhập kho **bắt buộc có NCC** và **(dự án hoặc đánh dấu hàng thương mại)**.
- Hàng ở **K-HH, K-BH-KH, K-BH-NCC, K-SC, K-TL** không được tính là hàng bán.
- Xuất kho phải **quét đủ 100% serial**.

---

## 7. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân / Cách xử lý |
|---|---|
| Bấm chức năng báo **"Không có quyền"** | Vai trò không được phép — nhờ Admin cấp quyền/đổi vai trò |
| **Không đăng nhập được** | Sai email/mật khẩu — nhờ Admin đặt lại mật khẩu (mục Người dùng) |
| Duyệt xuất báo **"Tồn khả dụng không đủ"** | Không đủ hàng để bán — kiểm tra lại tồn hoặc nhập thêm |
| Quét serial khi xuất báo **"không đúng sản phẩm / không khả dụng"** | Quét nhầm serial, hoặc hàng đang ở kho không bán được |
| Serial báo **"bị khóa theo dự án khác"** | Hàng thuộc dự án khác — cần người có quyền duyệt mở khóa |
| Vào web **không thấy trang** / trắng | Máy chủ chưa chạy — báo IT/Admin khởi động lại dịch vụ |

---

## 8. Tài khoản mẫu (đổi mật khẩu trước khi dùng thật)

| Vai trò | Email | Mật khẩu mẫu |
|---|---|---|
| Admin | admin@thng.com.vn | admin123 |
| Ban Giám đốc | bod@thng.com.vn | bod123 |
| Mua hàng | muahang@thng.com.vn | muahang123 |
| Kế toán kho | ketoan@thng.com.vn | ketoan123 |
| Thủ kho | thukho@thng.com.vn | thukho123 |
| Kỹ thuật | kythuat@thng.com.vn | kythuat123 |
| QC | qc@thng.com.vn | qc123 |
| Kinh doanh | kinhdoanh@thng.com.vn | kinhdoanh123 |
| Bảo hành | baohanh@thng.com.vn | baohanh123 |

*— Hết —*
