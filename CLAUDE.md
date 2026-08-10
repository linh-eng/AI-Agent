# CLAUDE.md

Tài liệu ngữ cảnh cho AI (Claude Code và công cụ tương tự) khi làm việc trong repo này.

## Mục đích

Webapp **quản lý kho cho Sophia Wellness** — doanh nghiệp wellness/spa. Kho gồm 4 nhóm hàng:
mỹ phẩm/skincare, thực phẩm chức năng (TPCN), vật tư tiêu hao spa, thiết bị & máy.

Đặc thù nghiệp vụ: quản lý tồn **theo lô + hạn sử dụng (HSD)**; xuất kho ưu tiên **FEFO** (hết hạn
trước xuất trước); cảnh báo hàng sắp/đã hết hạn và dưới định mức tồn.

## Trạng thái hiện tại — **MVP hoàn chỉnh**

- **Auth + RBAC:** JWT cookie httpOnly + bcrypt; 4 vai trò (ADMIN, MANAGER, WAREHOUSE, STAFF).
- **Danh mục:** sản phẩm (chế độ `LOT`/`QUANTITY`, cờ `requiresExpiry`, định mức tồn, ngưỡng cảnh báo HSD),
  nhóm hàng, nhà cung cấp, kho.
- **Nhập kho:** phiếu nhập theo NCC + kho, nhiều dòng (mã lô, HSD, ngày SX, SL, giá vốn). Ghi sổ ngay:
  sinh/cộng `StockBatch` + `StockMovement` (INBOUND). Ràng buộc: sản phẩm `LOT` phải có mã lô; nếu
  `requiresExpiry` thì bắt buộc HSD.
- **Xuất kho:** phiếu xuất (SALE / INTERNAL_USE / DISPOSAL / ADJUSTMENT); tự phân bổ lô **FEFO**
  (HSD sớm nhất trước, cùng HSD thì lô cũ trước; lô không HSD xếp sau), chặn xuất vượt tồn.
- **Tồn kho realtime:** tồn theo sản phẩm (gộp lô), lọc theo kho, HSD gần nhất, giá trị tồn theo giá vốn.
- **Cảnh báo:** lô đã/sắp hết hạn (ngưỡng theo `expiryAlertDays` của sản phẩm, mặc định 60 ngày) và
  sản phẩm dưới định mức (`onHand <= minStock`).
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
      alerts/        # Trung tâm cảnh báo (HSD + dưới định mức)
      products/      # Sản phẩm
      categories/    # Nhóm hàng
      suppliers/     # Nhà cung cấp
      warehouses/    # Kho
    api/             # Route handlers REST (auth + catalog + inventory/alerts/dashboard/receipts/issues)
  components/        # app-shell, page-header, session-provider, ui/*
  lib/               # prisma, auth, session, rbac, api, client, utils, codes (sinh mã phiếu),
                     # validation (Zod), inventory (tồn + cảnh báo), inbound-service (nhập),
                     # outbound-service (xuất + FEFO)
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
- Hướng phát triển tiếp: chuyển kho giữa nhiều kho, theo dõi tài sản/bảo hành cho thiết bị (serial),
  kiểm kê định kỳ, báo cáo Nhập–Xuất–Tồn + xuất CSV/in phiếu.
