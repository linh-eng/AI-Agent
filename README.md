# THNG — Webapp quản lý kho

Hệ thống quản lý kho cho THNG: **Nhập – Xuất – Lắp ráp – Tháo dỡ – Truy vết Serial**.
Quản lý tới Serial/IMEI, quan hệ serial cha–con của máy lắp ráp, xuất xứ (CO/CQ/tờ khai HQ),
bảo hành hai tầng (hãng + THNG) và truy vết hai chiều.

> Trạng thái: **Phase 1 hoàn tất** — Auth + RBAC, schema Prisma đầy đủ, và màn hình danh mục nền tảng
> (kho A1, dự án, NCC/khách hàng, sản phẩm theo `tracking_mode`, vị trí kệ). Phase 2–7 sẽ bổ sung sau.

## Công nghệ

Next.js 14 (App Router) · TypeScript · TailwindCSS · Prisma + PostgreSQL · JWT (jose) + bcrypt · Zod.

## Chạy dự án

Yêu cầu: Node ≥ 18, PostgreSQL.

```bash
npm install
cp .env.example .env          # sửa DATABASE_URL và AUTH_SECRET
npm run prisma:push           # tạo bảng theo schema
npm run db:seed               # nạp dữ liệu mẫu (gồm 1 máy lắp ráp as-built BOM)
npm run dev                   # http://localhost:3000
```

### Tài khoản demo

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | admin@thng.com.vn | admin123 |
| Ban Giám đốc | bod@thng.com.vn | bod123 |
| Thủ kho | thukho@thng.com.vn | thukho123 |
| Kế toán kho | ketoan@thng.com.vn | ketoan123 |
| Kỹ thuật | kythuat@thng.com.vn | kythuat123 |

(Các vai trò còn lại: `muahang`, `qc`, `kinhdoanh`, `baohanh` — mật khẩu `<tên>123`.)

## Điểm nhấn kiến trúc

- **Mô hình dữ liệu** (`prisma/schema.prisma`) phủ toàn bộ mục 6 của bản mô tả, mã hóa sẵn các quy tắc cứng:
  `warehouse_id` bắt buộc, serial bất biến với `parent_serial_id`/`replaced_by_serial_id`,
  `bom_as_built` có `version`, cờ `counts_as_available` cho kho, audit log append-only.
- **RBAC** (`src/lib/rbac.ts`) là nguồn sự thật chung cho seed và kiểm quyền server; API route bảo vệ bằng
  `requirePermission(...)`, route trang bảo vệ bằng `middleware.ts`.
- **Ràng buộc nghiệp vụ** ("có dự án HOẶC hàng thương mại", "NCC bắt buộc khi nhập") ở `src/lib/validation.ts`.

## Lệnh hữu ích

```bash
npm run build       # build production
npm run typecheck   # kiểm tra kiểu
npm run prisma:generate
```
