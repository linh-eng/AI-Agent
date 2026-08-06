# CLAUDE.md

This file gives AI assistants (Claude Code and similar tools) the context needed to work in this repository.

## Project purpose

Webapp quản lý kho cho **THNG** — doanh nghiệp kinh doanh thiết bị CNTT, có lắp ráp và tháo dỡ.
Đặc thù: quản lý tới **Serial/IMEI**, quan hệ **serial cha–con** (máy lắp ráp chứa nhiều linh kiện có serial riêng),
truy vết xuất xứ (CO/CQ, tờ khai HQ, lô) và bảo hành hai tầng (hãng + THNG), truy vết hai chiều.

Tham chiếu yêu cầu đầy đủ: bản mô tả 10 module (M1–M10) và lộ trình 7 phase.

## Current status — **Hoàn tất toàn bộ 7 phase** 🎉

- **Phase 1:** Auth + RBAC, schema Prisma đầy đủ cho toàn bộ mục 6, màn hình danh mục nền tảng.
- **Phase 2:** Nhập kho (M1–M3) — tạo phiếu nhập theo mã nghiệp vụ N1–N12 (bung checklist chứng từ +
  set kho đích), nhận hàng sinh serial/lot + xuất xứ (CO/CQ/tờ khai) + bảo hành 2 tầng (hãng + THNG) +
  biến động tồn + timeline serial; quét serial + Scan-to-Bin; luồng "hàng lỗi → K-HH". Quản lý serial/lô
  với **truy vết hai chiều** (xuôi: máy → cây linh kiện; ngược: linh kiện → máy → dự án → khách).
- **Phase 3:** Lắp ráp (M4) — Work Order (lắp theo đơn / để tồn kho) + BOM kế hoạch; cấp phát linh kiện
  (quét serial → WIP `K-TAM`); QC/burn-in đầu ra (FAIL quay lại lắp ráp); hoàn thành sinh serial thành
  phẩm + **as-built BOM có version** (liên kết serial/lô/license con) + BH THNG + gán license (cài phần
  mềm); linh kiện thừa trả `K-LK`; nhập kho thành phẩm. Mọi bước ghi stock_movement + serial_event.
- **Phase 4:** Tồn kho realtime & kiểm kê (M5) — dashboard tồn theo kho/sản phẩm (thực tế/khả dụng/giữ/WIP)
  với **quy tắc khả dụng = IN_STOCK + không nằm trong máy (parentSerialId null) + kho tính tồn**; cảnh báo
  (dưới tồn tối thiểu, hàng tồn lâu, linh kiện sắp hết BH NCC khi còn trong kho); báo cáo theo dự án; kiểm kê
  (chụp serial kỳ vọng → quét thực tế → tự so lệch thiếu/thừa → BGĐ duyệt → bút toán ADJUSTMENT).
- **Phase 5:** Xuất kho (M6–M8) — tạo phiếu xuất theo mã X1–X11 → trình duyệt → kế toán duyệt (chặn bán
  vượt tồn khả dụng + kiểm hạn mức công nợ) / từ chối kèm lý do → picking **quét 100% serial** (chặn sai
  serial, sai sản phẩm, serial không khả dụng, **khóa dự án K-DA** — chỉ mở khi có quyền duyệt override) →
  đóng gói & bàn giao (biên bản giao: hình thức, đơn vị VC, mã vận đơn, ký điện tử, video đóng gói). Serial
  → SOLD/RENTED + stock_movement OUTBOUND + serial_event.
- **Phase 6:** Bảo hành/RMA/hư hỏng & rã máy (M9–M10) — tiếp nhận máy khách (N3 → K-BH-KH,
  IN_WARRANTY_INTAKE); phân luồng (gửi hãng X4 → K-BH-NCC + VendorRma / sửa phí → K-SC / hỏng → K-HH +
  DamagedItem SLA 15 ngày); hãng trả về (N4: sửa xong trả khách, hoặc **REPLACED** → serial cũ REPLACED +
  liên kết replaced_by + **as-built BOM version mới** + tự mở phiếu **đòi BH ngược NCC** nếu linh kiện cũ
  còn hạn hãng); chốt xử lý K-HH (thanh lý → SCRAPPED K-TL...). Rã máy: đề nghị → **BGĐ duyệt bắt buộc** →
  đối chiếu as-built → serial cha DISASSEMBLED, serial con thu hồi vào K-TMAY (grade) hoặc K-TL (hỏng).
  Bảng SLA cấu hình ở `src/lib/sla.ts`.
- **Phase 7:** Báo cáo & in ấn (mục 7) — báo cáo tổng hợp (`src/lib/reports.ts`): Nhập–Xuất–Tồn theo kho,
  theo NCC (tỷ lệ lỗi + số vụ RMA), tồn đọng K-HH & K-BH-NCC quá hạn, hiệu quả lắp ráp (tỷ lệ QC fail),
  bảo hành tổng quan, kết quả rã máy; trang `/reports` + **xuất CSV** (Excel) + **in báo cáo** (print CSS).
  In ấn chứng từ/tem (`src/lib/print.ts`): **in tem serial** (M3) từ màn truy vết, **in biên bản bàn giao**
  (M8) từ phiếu xuất.

Toàn bộ lộ trình 7 phase đã hoàn tất. Chỉ số "giá trị" (tiền) hiện dựa trên số lượng vì schema chưa có
trường giá vốn — có thể bổ sung trường giá để tính giá trị nhập/tồn/thu hồi sau.

## Tech stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **UI:** TailwindCSS + component shadcn-style tự viết (`src/components/ui`)
- **DB:** PostgreSQL + Prisma ORM (`prisma/schema.prisma`)
- **Auth:** JWT (jose) trong cookie httpOnly + bcrypt; RBAC theo vai trò/quyền
- **Validation:** Zod

## Structure

```
prisma/
  schema.prisma      # Toàn bộ mô hình dữ liệu mục 6 (đầy đủ cho cả 7 phase)
  seed.ts            # Seed RBAC, kho A1, đối tác, dự án, sản phẩm + 1 máy lắp ráp as-built BOM
src/
  app/
    login/           # Trang đăng nhập
    (app)/           # Layout có sidebar + các trang sau đăng nhập
      dashboard/     # Tổng quan + tồn theo kho
      inventory/     # Tồn kho realtime theo kho/sản phẩm + cảnh báo (M5)
      inbound/       # Nhập kho: list + tạo phiếu + màn nhận hàng (quét serial, scan-to-bin)
      outbound/      # Xuất kho: list + tạo + duyệt + picking quét serial + bàn giao
      work-orders/   # Lắp ráp: list + tạo lệnh + workbench (cấp phát/QC/hoàn thành as-built)
      warranty/      # Bảo hành/RMA: tiếp nhận + phân luồng + nhận về hãng + K-HH SLA
      disassembly/   # Rã máy: list + đề nghị + duyệt BGĐ + thực hiện ([id])
      stock-counts/  # Kiểm kê: list + tạo + quét đối chiếu + duyệt BGĐ
      serials/       # Danh sách serial + truy vết hai chiều (+ in tem)
      lots/          # Danh sách lô hàng
      reports/       # Báo cáo tổng hợp (mục 7) + xuất CSV + in
      projects/      # Dự án + báo cáo hàng theo dự án ([id])
      warehouses/    # Danh mục kho A1
      bins/          # Zone / Bin (Scan-to-Bin)
      projects/      # Dự án
      partners/      # NCC / Khách hàng
      products/      # Sản phẩm (tracking_mode)
    api/             # Route handlers REST (auth + CRUD danh mục + inbound/serials/lots)
  components/        # app-shell, page-header, session-provider, serial-trace, ui/*
  lib/               # prisma, auth, session, rbac, warehouses, validation, api, client, utils,
                     # inbound (cấu hình N1–N12), inbound-service (receive), workorder-service
                     # (lắp ráp: allocate/qc/complete), inventory (tồn+cảnh báo),
                     # stockcount-service (kiểm kê), outbound + outbound-service
                     # (xuất: submit/approve/ship), warranty-service (M9),
                     # disassembly-service (M10), sla (bảng SLA), reports (báo cáo),
                     # csv (xuất CSV), print (in tem/biên bản), labels
  middleware.ts      # Bảo vệ route: chưa đăng nhập -> /login hoặc 401
```

## Build / run / test commands

```bash
npm install                 # cài deps (postinstall tự chạy prisma generate)
cp .env.example .env        # cấu hình DATABASE_URL, AUTH_SECRET
npm run prisma:push         # đồng bộ schema vào Postgres (hoặc prisma:migrate)
npm run db:seed             # nạp dữ liệu mẫu
npm run dev                 # chạy dev (http://localhost:3000)
npm run build               # build production (prisma generate + next build)
npm run typecheck           # kiểm tra kiểu TS
```

Tài khoản demo sau khi seed: `admin@thng.com.vn` / `admin123` (mỗi vai trò có 1 user, mật khẩu `<vaitro>123`).

## Conventions & quy tắc cứng (bám bản mô tả)

- **`warehouse_id` bắt buộc** trên mọi bản ghi tồn (Serial, Lot, StockMovement).
- Kho `K-HH, K-BH-KH, K-BH-NCC, K-SC, K-TL` **không tính tồn khả dụng** (`counts_as_available=false`).
- Nhập kho: `supplier_id` NOT NULL; `project_id` **hoặc** `is_commercial_stock` (kiểm ở `src/lib/validation.ts`).
- **Serial bất biến:** không xóa, chỉ đổi `status`; thay thế trỏ `replaced_by_serial_id`; cha–con qua `parent_serial_id`.
- **`bom_as_built` có `version`**, liên kết serial cha ↔ serial/lot/license con.
- `audit_logs` append-only.
- RBAC: nguồn sự thật ở `src/lib/rbac.ts` (dùng chung cho seed và kiểm quyền server).
- Danh mục kho A1 cố định ở `src/lib/warehouses.ts`.
- **Dùng chung** bảng `projects`, `partners`, `serials` với Module Hỗ trợ (không tạo bản sao).
- UI/tài liệu bằng tiếng Việt; định dạng số/ngày theo VN.

## Development workflow

- Nhánh phát triển hiện tại: `claude/thng-warehouse-management-ovqy6h`.
- Mỗi thay đổi nghiệp vụ mới nên: cập nhật `schema.prisma` (nếu cần) → API route + Zod → UI → seed/demo.
- Khi thêm module mới, cập nhật file này cho khớp thực tế codebase.
