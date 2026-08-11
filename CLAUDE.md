# CLAUDE.md

Tài liệu ngữ cảnh cho AI (Claude Code và công cụ tương tự) khi làm việc trong repo này.

## Mục đích

Webapp **quản lý kho cho Sophia Wellness** — doanh nghiệp wellness/spa. Kho gồm 4 nhóm hàng:
mỹ phẩm/skincare, thực phẩm chức năng (TPCN), vật tư tiêu hao spa, thiết bị & máy.

Đặc thù nghiệp vụ: quản lý tồn **theo lô + hạn sử dụng (HSD)**; xuất kho ưu tiên **FEFO** (hết hạn
trước xuất trước); cảnh báo hàng sắp/đã hết hạn và dưới định mức tồn.

## Trạng thái hiện tại — **MVP + Phase 2 + Phase 3**

- **Auth + RBAC:** JWT cookie httpOnly + bcrypt; 4 vai trò (ADMIN, MANAGER, WAREHOUSE, STAFF).
- **Danh mục:** sản phẩm (chế độ `LOT`/`QUANTITY`, cờ `requiresExpiry`, định mức tồn, ngưỡng cảnh báo HSD),
  nhóm hàng, nhà cung cấp, kho.
- **Nhập kho:** phiếu nhập theo NCC + kho, nhiều dòng (mã lô, HSD, ngày SX, SL, giá vốn). Ghi sổ ngay:
  sinh/cộng `StockBatch` + `StockMovement` (INBOUND). Ràng buộc: sản phẩm `LOT` phải có mã lô; nếu
  `requiresExpiry` thì bắt buộc HSD.
- **Xuất kho:** phiếu xuất (SALE / INTERNAL_USE / DISPOSAL / ADJUSTMENT); tự phân bổ lô **FEFO**
  (HSD sớm nhất trước, cùng HSD thì lô cũ trước; lô không HSD xếp sau), chặn xuất vượt tồn.
- **Chuyển kho (Phase 2):** phiếu chuyển giữa 2 kho; rút lô ở kho nguồn theo FEFO, tạo/cộng lô tương ứng
  (giữ nguyên mã lô + HSD) ở kho đích; mỗi lần tách lô ghi 2 `StockMovement` (OUTBOUND + INBOUND, `refType=TRANSFER`).
- **Dịch vụ/liệu trình (Phase 2):** khai báo định mức tiêu hao (`Service` + `ServiceItem`); ghi nhận thực hiện
  N lượt (`ServiceUsage`) → tự lập phiếu xuất `INTERNAL_USE` (FEFO) trừ kho theo định mức × số lượt.
- **Tài sản/thiết bị (Phase 2):** `Asset` theo serial, trạng thái (IN_STOCK/IN_USE/MAINTENANCE/RETIRED),
  ngày mua & hạn bảo hành — quản lý riêng, không nằm trong tồn theo lô.
- **Kiểm kê định kỳ (Phase 3):** phiếu kiểm kê (`StockCount` + `StockCountItem`) chốt tồn hệ thống theo lô;
  nhập số thực đếm; khi duyệt cập nhật tồn lô về số đếm và ghi `StockMovement` ADJUSTMENT cho chênh lệch.
- **In phiếu/tem (Phase 3):** in phía client qua `src/lib/print.ts` (`window.open` viết HTML rồi `print()`) —
  `printReceipt` / `printIssue` / `printTransfer` (phiếu A4) và `printBatchLabels` (tem lô: mã lô + HSD).
- **Lịch sử bảo trì (Phase 3):** `MaintenanceLog` (bảo trì/sửa chữa/kiểm tra, chi phí, đơn vị) gắn với `Asset`;
  xem tại trang chi tiết tài sản `/assets/[id]`.
- **Doanh thu dịch vụ (Phase 3):** `Service.price` (đơn giá/lượt); mỗi `ServiceUsage` chốt `revenue` (giá×lượt)
  và `cost` (giá vốn vật tư tiêu hao theo lô đã xuất); báo cáo doanh thu–giá vốn–lợi nhuận theo kỳ.
- **Tồn kho realtime:** tồn theo sản phẩm (gộp lô), lọc theo kho, HSD gần nhất, giá trị tồn theo giá vốn.
- **Cảnh báo:** lô đã/sắp hết hạn (ngưỡng theo `expiryAlertDays`, mặc định 60 ngày), sản phẩm dưới định mức
  (`onHand <= minStock`), và **thiết bị sắp/đã hết bảo hành**.
- **Báo cáo N-X-T (Phase 2):** tồn đầu – nhập – xuất – tồn cuối theo kỳ + kho, tính từ `StockMovement`;
  xuất **CSV** (UTF-8 BOM) phía client.
- **Dashboard:** số liệu tổng hợp + phiếu nhập/xuất gần đây.

## Tech stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **UI:** TailwindCSS + component shadcn-style tự viết (`src/components/ui`)
- **DB:** PostgreSQL + Prisma ORM (`prisma/schema.prisma`)
- **Auth:** JWT (jose) trong cookie httpOnly + bcrypt; RBAC theo vai trò/quyền
- **Validation:** Zod

## Cấu trúc

```
prisma/
  schema.prisma      # RBAC + danh mục + StockBatch (lô/HSD) + phiếu nhập/xuất + StockMovement
  seed.ts            # RBAC, kho, nhóm hàng, NCC, sản phẩm + tồn đầu kỳ theo lô (có lô sắp/đã hết hạn)
src/
  app/
    login/           # Trang đăng nhập
    (app)/           # Layout có sidebar + các trang sau đăng nhập
      dashboard/     # Tổng quan + phiếu gần đây
      inventory/     # Tồn kho realtime theo sản phẩm/kho
      inbound/       # Nhập kho: list + new (tạo phiếu) + [id] (chi tiết)
      outbound/      # Xuất kho: list + new (FEFO) + [id] (chi tiết)
      transfers/     # Chuyển kho: list + new + [id]
      stock-counts/  # Kiểm kê định kỳ: list + [id] (nhập thực đếm + duyệt)
      service-usage/ # Ghi nhận thực hiện dịch vụ (tự trừ kho)
      services/      # Liệu trình dịch vụ + định mức tiêu hao + đơn giá
      assets/        # Tài sản/thiết bị: list + [id] (chi tiết + lịch sử bảo trì)
      reports/       # Báo cáo N-X-T + Doanh thu dịch vụ (2 tab) + xuất CSV
      alerts/        # Trung tâm cảnh báo (HSD + dưới định mức + bảo hành)
      products/ categories/ suppliers/ warehouses/   # Danh mục
    api/             # Route handlers REST (auth + catalog + inventory/alerts/dashboard/receipts/
                     # issues/transfers/stock-counts/services/service-usages/assets(+maintenance)/reports)
  components/        # app-shell, page-header, session-provider, ui/*
  lib/               # prisma, auth, session, rbac, api, client, utils, codes (sinh mã phiếu),
                     # labels (nhãn+tone enum dùng chung), print (in phiếu/tem qua window.open),
                     # validation (Zod), inventory (tồn + cảnh báo + bảo hành), reports (N-X-T + doanh thu),
                     # csv, inbound-service, outbound-service (FEFO), transfer-service,
                     # service-service (tiêu hao dịch vụ), stockcount-service (kiểm kê)
  middleware.ts      # Bảo vệ route: chưa đăng nhập -> /login hoặc 401
```

## Build / run / test

```bash
npm install                 # cài deps (postinstall tự chạy prisma generate)
cp .env.example .env        # cấu hình DATABASE_URL, AUTH_SECRET
npm run prisma:push         # đồng bộ schema vào Postgres
npm run db:seed             # nạp dữ liệu mẫu
npm run dev                 # chạy dev (http://localhost:3000)
npm run build               # build production
npm run typecheck           # kiểm tra kiểu TS
```

Tài khoản demo: `admin@sophia.vn` / `admin123` (mỗi vai trò 1 user, mật khẩu `<vaitro>123`, ví dụ
`manager123`, `warehouse123`, `staff123`).

## Quy ước & quy tắc cứng

- **`warehouseId` bắt buộc** trên mọi bản ghi tồn (`StockBatch`, `StockMovement`, phiếu nhập/xuất).
- **Lô là đơn vị tồn:** mỗi `StockBatch` = 1 sản phẩm tại 1 kho (kèm mã lô + HSD). Sản phẩm `QUANTITY`
  dùng 1 lô gộp không mã/không HSD. Tồn sản phẩm = tổng `quantity` các lô.
- **Nhập:** sản phẩm `LOT` bắt buộc mã lô; `requiresExpiry=true` bắt buộc HSD. Nhập cộng dồn vào lô khớp
  (cùng sản phẩm/kho/mã lô/HSD) hoặc tạo lô mới.
- **Xuất:** phân bổ **FEFO**; chặn xuất vượt tồn khả dụng. Một dòng xuất có thể tách qua nhiều lô.
- **Phiếu bất biến sau ghi sổ**; mọi thay đổi số lượng đều có `StockMovement`. `audit_logs` append-only.
- **RBAC:** nguồn sự thật ở `src/lib/rbac.ts` (dùng chung seed + kiểm quyền server). API dùng
  `requirePermission(...)`.
- UI/tài liệu bằng tiếng Việt; định dạng số/ngày theo VN (`src/lib/utils.ts`).

## Quy ước mở rộng

- Thêm nghiệp vụ mới: cập nhật `schema.prisma` (nếu cần) → thêm Zod ở `validation.ts` → API route
  (`requirePermission`) → service ở `src/lib/*-service.ts` → trang UI → cập nhật seed + file này.
- Giá trị tồn hiện tính theo `unitCost` của lô; có thể mở rộng giá bán/lợi nhuận sau.
- Ghi nhận dịch vụ tạo phiếu xuất `INTERNAL_USE` rồi lưu `ServiceUsage.issueId` để truy vết (2 bước, không
  cùng 1 transaction — nếu cần chặt hơn có thể gộp).
- Báo cáo N-X-T lọc theo 1 kho là chính xác; xem gộp toàn kho thì số nhập/xuất có tính cả bút toán chuyển
  kho nội bộ (tồn cuối vẫn đúng).
- Kiểm kê chốt danh sách lô lúc tạo phiếu; khi duyệt tính chênh lệch theo tồn hiện tại của lô (an toàn nếu
  có phát sinh xen giữa). Doanh thu/giá vốn dịch vụ được chốt vào `ServiceUsage` tại thời điểm ghi nhận.
- In ấn: `lib/print.ts` mở cửa sổ mới viết HTML rồi `print()` (không tạo route riêng). Nhãn/tone enum gom ở
  `lib/labels.ts` — mọi trang import từ đây, không khai báo lặp trong page.
- Hướng phát triển tiếp: in mã vạch/QR trên tem, xuất PDF phiếu, phân bổ chi phí, báo cáo tồn theo thời điểm.
