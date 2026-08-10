# Sophia Wellness — Webapp quản lý kho

Hệ thống quản lý kho cho **Sophia Wellness**: nhập – xuất kho, **tồn realtime theo lô & hạn sử dụng (HSD)**,
cảnh báo hàng sắp/đã hết hạn và dưới định mức tồn. Phù hợp 4 nhóm hàng: mỹ phẩm/skincare, thực phẩm
chức năng, vật tư tiêu hao spa, thiết bị & máy.

> Trạng thái: **MVP + Phase 2 + Phase 3**. MVP: Auth/RBAC, danh mục, nhập kho theo lô + HSD, xuất kho **FEFO**,
> tồn kho realtime, cảnh báo. Phase 2: **chuyển kho** giữa chi nhánh, **trừ kho tự động theo liệu trình dịch vụ**,
> **tài sản/bảo hành thiết bị theo serial**, **báo cáo Nhập–Xuất–Tồn + CSV**. Phase 3: **kiểm kê định kỳ**,
> **in phiếu & tem lô**, **lịch sử bảo trì thiết bị**, **báo cáo doanh thu dịch vụ**.

## Công nghệ

Next.js 14 (App Router) · TypeScript · TailwindCSS · Prisma + PostgreSQL · JWT (jose) + bcrypt · Zod.

## Chạy dự án

Yêu cầu: Node ≥ 18, PostgreSQL.

```bash
npm install
cp .env.example .env          # sửa DATABASE_URL và AUTH_SECRET
npm run prisma:push           # tạo bảng theo schema
npm run db:seed               # nạp dữ liệu mẫu (sản phẩm + tồn theo lô, có lô sắp/đã hết hạn)
npm run dev                   # http://localhost:3000
```

### Tài khoản demo

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị | admin@sophia.vn | admin123 |
| Quản lý | quanly@sophia.vn | manager123 |
| Thủ kho | thukho@sophia.vn | warehouse123 |
| Nhân viên | nhanvien@sophia.vn | staff123 |

## Nghiệp vụ chính

- **Danh mục:** sản phẩm (chế độ quản lý *theo lô* — có/không HSD — hoặc *theo số lượng*), nhóm hàng,
  nhà cung cấp, kho.
- **Nhập kho:** lập phiếu nhập theo NCC + kho; mỗi dòng ghi mã lô, HSD, ngày SX, số lượng, giá vốn.
  Ghi sổ ngay: sinh/cộng lô tồn + bút toán biến động (`StockMovement`).
- **Xuất kho:** lập phiếu xuất (bán / dùng nội bộ / hủy / điều chỉnh); hệ thống **tự chọn lô theo FEFO**
  (HSD sớm nhất xuất trước), chặn xuất vượt tồn khả dụng.
- **Chuyển kho:** phiếu chuyển giữa 2 kho/chi nhánh; rút lô ở kho nguồn theo FEFO, giữ nguyên lô & HSD sang kho đích.
- **Dịch vụ/liệu trình:** khai báo định mức tiêu hao; ghi nhận thực hiện N lượt → tự lập phiếu xuất tiêu hao (FEFO).
- **Tài sản/thiết bị:** theo dõi thiết bị theo serial, trạng thái sử dụng, ngày mua & hạn bảo hành, **lịch sử bảo trì/sửa chữa**.
- **Kiểm kê định kỳ:** chốt tồn theo lô, nhập số thực đếm, tự điều chỉnh chênh lệch khi duyệt.
- **In phiếu & tem:** in phiếu nhập/xuất/chuyển (khổ A4) và tem lô (mã lô + HSD) trực tiếp từ trình duyệt.
- **Tồn kho realtime:** tồn theo sản phẩm (gộp mọi lô), lọc theo kho, HSD gần nhất, giá trị tồn.
- **Cảnh báo:** lô đã/sắp hết hạn (ngưỡng cấu hình, mặc định 60 ngày), sản phẩm dưới định mức, và thiết bị sắp/đã hết bảo hành.
- **Báo cáo:** Nhập–Xuất–Tồn theo kỳ + kho, và **doanh thu dịch vụ** (doanh thu – giá vốn – lợi nhuận); xuất CSV.

## Điểm nhấn kiến trúc

- **Mô hình dữ liệu** (`prisma/schema.prisma`): lõi tồn kho là `StockBatch` (lô của 1 sản phẩm tại 1 kho,
  kèm HSD), mọi biến động ghi vào `StockMovement`; phiếu nhập/xuất bất biến sau khi ghi sổ; audit log append-only.
- **RBAC** (`src/lib/rbac.ts`) là nguồn sự thật chung cho seed và kiểm quyền server; API bảo vệ bằng
  `requirePermission(...)`, route trang bảo vệ bằng `middleware.ts`.
- **Logic nghiệp vụ tách riêng:** nhập (`src/lib/inbound-service.ts`), xuất + FEFO
  (`src/lib/outbound-service.ts`), tồn kho & cảnh báo (`src/lib/inventory.ts`), validation Zod
  (`src/lib/validation.ts`).

## Lệnh hữu ích

```bash
npm run build       # build production
npm run typecheck   # kiểm tra kiểu
npm run prisma:generate
```
