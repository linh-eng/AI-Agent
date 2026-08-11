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

## Module Spa / Thẩm mỹ — Khách hàng · Booking · Dịch vụ · Phác đồ · Chi phí

Module thứ hai, dùng chung hạ tầng (Next.js App Router, Prisma, JWT auth, RBAC, UI) với phần kho.
Quản lý hành trình khách hàng của spa/thẩm mỹ: CRM → Booking → Đánh giá → Phác đồ → Buổi thực hiện →
Chi phí/Thanh toán → Follow-up.

- **Dữ liệu (prisma/schema.prisma, cuối file):** `Customer`, `CrmActivity` (nhật ký CSKH append-only),
  `ServiceCategory`/`Service`, `Booking`, `Assessment`, `TreatmentPlan`/`TreatmentStage`/`TreatmentSession`,
  `Payment`, `Task` + các enum (`Gender`, `BookingStatus`, `CrmActivityType`, `PlanStatus`,
  `SessionStatus`, `PaymentMethod`, `TaskPriority`, `TaskStatus`). Tác nhân lưu bằng tên (String) đồng nhất
  với phần kho.
- **Nguyên tắc cứng:** không hard-delete (soft delete qua `isActive`/`status`); CRM/Payment/Session
  không ghi đè — mỗi lần là record độc lập; `TreatmentPlan.version` + `changeLog`; **Booking `COMPLETED`
  khóa dữ liệu lịch sử** (chỉ sửa ghi chú), giá chốt tại thời điểm booking; dữ liệu tài chính nhạy cảm
  (giá vốn/chi phí/lợi nhuận) chỉ role có `finance.read` mới xem (mask ở server).
- **RBAC (src/lib/rbac.ts):** roles mới `MANAGER, RECEPTION, CUSTOMER_CARE, SPECIALIST, CASHIER, MARKETING`;
  permissions `customer.*`, `crm.write`, `service.*`, `booking.*`, `treatment.*`, `payment.*`, `task.write`,
  `campaign.write`, `finance.read`.
- **Lib:** `src/lib/clinic-validation.ts` (Zod), `src/lib/clinic.ts` (sinh mã, tổng hợp công nợ,
  dựng timeline tổng hợp mục 23, mask tài chính, ghi audit), `src/lib/clinic-labels.ts` (nhãn VN + tone).
- **API (src/app/api):** `customers` (+`[id]` gồm timeline/công nợ, soft delete), `crm-activities`
  (tự tạo task khi có follow-up), `services`/`service-categories`, `bookings` (+`[id]`, `[id]/status`),
  `assessments`, `treatment-plans` (+`[id]` bump version), `treatment-sessions` (+`[id]`), `payments`,
  `tasks` (+`[id]`), `clinic/dashboard`.
- **UI (src/app/(app)):** `/crm` (dashboard KPI + doanh thu), `/customers` (+`[id]` hồ sơ: tổng quan,
  timeline, CSKH, booking, phác đồ, đánh giá, thanh toán), `/bookings`, `/services`,
  `/treatment-plans` (+`[id]`: giai đoạn, buổi, thêm/ghi nhận buổi, tạo version), `/tasks`.
  Sidebar (`src/components/app-shell.tsx`) chia 2 nhóm: **Spa & CRM** và **Kho THNG**; `/` → `/crm`.
- **Seed:** thêm 6 user spa (mật khẩu `<role>123`, vd `quanly@thng.com.vn`/`quanly123`) + dịch vụ mẫu +
  khách `KH-000001` với hành trình đầy đủ (đánh giá, phác đồ `TP-000001`, 2 buổi, booking, CSKH, cọc, task).

### Thư viện Spa — Brand · Technology · Protocol Library · Product Catalog · Form Builder (đã xong)

Bổ sung theo bản "Bổ sung yêu cầu — Phác đồ / Công nghệ / Brand Protocol / Sản phẩm" (module 1–4 + phần builder).

- **Dữ liệu (cuối `schema.prisma`):** `Brand`, `Technology`, `BrandProtocol` (+join `BrandProtocolTechnology`,
  `BrandProtocolProduct`; enum `ProtocolKind` BRAND/INTERNAL, `LibraryStatus` DRAFT→REVIEW→APPROVED→ACTIVE→
  ARCHIVED, `version`+`changeLog`), `SpaProduct` (`ProductType` PROFESSIONAL/HOME_CARE/BOTH, `cost` nhạy cảm,
  `inventoryProductId` link mềm tới kho), `ProductRecommendation` (`RecommendationPriority` ESSENTIAL/
  RECOMMENDED/OPTIONAL), `FormTemplate` + `FormInstance` (áp mẫu → snapshot `schemaSnapshot`, KHÔNG đổi bản
  gốc). `TreatmentSession` thêm `technologyId`, `brandProtocolId`, `orderIndex` (kéo–thả), `steps`,
  `professionalProducts`.
- **RBAC:** `library.read` (thêm vào `CLINIC_READ`), `brand.write`, `technology.write`, `protocol.write`,
  `protocol.approve`, `form.write`, `catalog.write`, `recommend.write`. Gán: MANAGER (đủ), SPECIALIST
  (protocol/technology/form/recommend), MARKETING (catalog), BOD (protocol.approve).
- **Lib:** `src/lib/form-builder.ts` (kiểu `FormSchema`: sections/groups/fields + 32 field types + tab;
  `LogicRule` IF/AND(ALL)/OR(ANY)/THEN show|hide|require; `evaluateLogic`, `computeCalc`, `schemaTabs`,
  `newField/newSection`). `src/lib/library-validation.ts` (Zod). Nhãn ở `clinic-labels.ts`.
- **API:** `brands`(+`[id]`), `technologies`(+`[id]`), `brand-protocols`(+`[id]`: status/version/join;
  chặn Approve/Active nếu thiếu `protocol.approve`), `spa-products`(+`[id]`, mask `cost`),
  `product-recommendations`(+`[id]`), `form-templates`(+`[id]`), `form-instances`(+`[id]`: POST = snapshot
  mẫu), `treatment-sessions/reorder`.
- **UI:** nhóm sidebar **Thư viện Spa** → `/brands`, `/technologies`, `/protocols`(+`[id]` editor bước/
  công nghệ/sản phẩm/workflow/version), `/catalog`, `/form-templates`(+`[id]` **builder kéo–thả 3 cột** +
  tab Logic + Xem trước), `/form-instances/[id]` (điền phiếu). `components/form-renderer.tsx` render schema
  động. Hồ sơ khách thêm tab **Sản phẩm đề xuất** + **Biểu mẫu** (áp mẫu). `/treatment-plans/[id]`: buổi
  chọn công nghệ/brand protocol + bước + sản phẩm chuyên nghiệp; **kéo–thả sắp xếp thứ tự buổi**.
- **Seed:** brand DMK/Dermalogica, công nghệ Laser Pico, protocol `PROTO-DMK-BRIGHT` (ACTIVE, có bước +
  join), 3 sản phẩm, biểu mẫu `FORM-SKIN-ASSESS` (ACTIVE, có conditional logic), 1 đề xuất SP cho KH-000001.

### Quyết định kiến trúc

- **Coexistence, không viết lại:** module spa nằm chung repo/app với kho THNG, dùng chung User/Role/
  Permission/AuditLog. Tác nhân (nhân viên) lưu **tên (String)** thay vì FK User — đồng nhất với phần kho,
  tránh sửa model `User`.
- **Bất biến & lịch sử:** protocol/form/plan có `version`+`changeLog`; FormInstance snapshot schema; Payment/
  CrmActivity/Session append-only; soft delete `isActive`.
- **Che dữ liệu tài chính:** mask ở server (`maskFinance`) theo `finance.read` cho `expectedCost`/`cost`/
  `plannedCost`/`actualCost` và `cost/profit` dashboard.
- **Form Builder dynamic:** schema lưu JSON, không hard-code; drag–drop dùng HTML5 DnD native (không thêm
  thư viện), conditional logic đánh giá client-side qua `evaluateLogic`.

### Migration DB — dùng migration history (KHÔNG dùng `db push` cho production)

Dự án đã chuyển sang **Prisma Migrate** làm chiến lược triển khai schema chính thức. Không dùng
`prisma db push` cho staging/production nữa (chỉ dùng cho prototype nhanh trong máy dev khi thật cần).

- **Thư mục `prisma/migrations/`** chứa lịch sử migration; `migration_lock.toml` khóa provider = postgresql.
- **`0_init`**: migration nền (baseline) sinh từ toàn bộ schema hiện tại (kho THNG + Spa + Thư viện Spa),
  hoàn toàn **additive** (chỉ `CREATE` — không có `DROP`). Sinh bằng
  `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
- Mỗi module bổ sung sau baseline có **một migration riêng**, sinh bằng `migrate diff` giữa 2 phiên bản
  schema (không cần DB) và đã kiểm tra **0 lệnh phá hủy** trước khi commit:
  `0_init` → `1_proposals_care_forms` (M5–M7) → `2_session_materials` (M8) → `3_price_management` (M9) →
  `4_marketing` (M10).

**Quy trình triển khai (deployment):**
- **DB mới (fresh):** `npm run prisma:migrate:deploy` → chạy toàn bộ migration theo thứ tự. Rồi `npm run db:seed`.
- **DB đang chạy bằng `db push` từ trước (baselining — KHÔNG mất dữ liệu):** vì schema đã khớp, đánh dấu
  baseline đã áp dụng bằng `npm run prisma:baseline` (`prisma migrate resolve --applied 0_init`), sau đó các
  migration tiếp theo áp bằng `npm run prisma:migrate:deploy`.
- **Phát triển (dev, có DB):** `npm run prisma:migrate` (`migrate dev`) để tạo + áp migration mới; `npm run
  prisma:migrate:status` để kiểm tra trạng thái.

**An toàn dữ liệu:**
- Tất cả migration hiện tại là additive (thêm bảng/cột), **không destructive**. Nếu về sau cần thao tác phá
  hủy (drop/rename cột có dữ liệu), phải **gắn cờ rõ ràng** trong tên migration + comment và tách riêng, kèm
  bước sao lưu; không gộp lẫn với thay đổi additive.
- **Không bao giờ** chạy `prisma migrate reset` trên môi trường có dữ liệu thật (lệnh này DROP toàn bộ schema).
- Bản ghi lịch sử nghiệp vụ (proposal đã chốt, session đã hoàn thành, booking, thanh toán) được bảo toàn bằng
  **snapshot/version** ở tầng ứng dụng (xem phần "Data integrity"), độc lập với thay đổi catalog/giá về sau.

### Module 5–10 (đã xong) — Proposal · Care · Session Forms · Materials · Pricing · Marketing

- **M5 Treatment Proposal (`treatment_proposals`/`_options`/`proposal_items`):** nhiều phương án
  (ESSENTIAL/RECOMMENDED/PREMIUM/CUSTOM), tự tính tổng, so sánh cạnh nhau; chốt → `acceptedSnapshot` bất
  biến + `agreedPrice`; mask `unitCost`/ghi chú nội bộ theo `finance.read`; khóa sửa khi ACCEPTED.
  API `/proposals`(+`[id]`,`[id]/accept`). UI `/proposals`(+`[id]`). RBAC `proposal.read/write/accept`.
- **M6 Care library (`care_instructions`/`care_instruction_instances`):** mẫu Pre/Post/General/Follow-up có
  version + trạng thái; áp cho khách → snapshot nội dung, cá nhân hóa không đổi mẫu; `DeliveryChannel` chuẩn
  bị Portal/Email/Zalo/WhatsApp/SMS. API `/care-instructions`,`/care-instances`. UI `/care-instructions` +
  hồ sơ khách tab **Hướng dẫn**. RBAC `care.write`.
- **M7 Session forms:** `FormInstance` thêm `status`/`completedBy`/`completedAt`; gắn biểu mẫu vào từng buổi
  (snapshot schema+version), điền + **Hoàn thành** (khóa bất biến). Nâng cấp field: **TABLE** = lưới thêm–xóa
  dòng theo cột; **SIGNATURE** = canvas ký lưu `{dataUrl,signedBy,signedAt}`; **CALCULATED** an toàn (không
  eval): sum/avg/add/subtract/multiply/divide/percentage.
- **M8 Materials↔Inventory↔Session (`session_materials`/`material_movements`):** bucket planned/reserved/
  issued/consumed/returned/waste; `applyMaterialMovement` (REQUEST/RESERVE/ISSUE/CONSUME/RETURN/WASTE/DAMAGE)
  + snapshot giá vốn; `recomputeSessionMaterialCost` → `session.materialCost` (tiêu hao đóng góp chi phí thật,
  tự gán `actualCost` nếu trống). Phân biệt SP chuyên nghiệp (`isProfessional`) vs home-care. UI: nút **Vật tư**
  mỗi buổi. RBAC `material.write`.
- **M9 Pricing (`price_rules`):** giá theo Service/Product/Technology/Package × STANDARD/BRANCH/MEMBER/VIP/
  CAMPAIGN/CUSTOM, hiệu lực theo ngày; đổi giá = tạo bản mới + archive bản cũ (append-only, `version`+
  `supersedesId`). `resolvePrice` chọn giá tốt nhất; **Booking lưu snapshot** giá lúc tạo. API `/price-rules`
  (+`[id]` archive, `/resolve`). UI `/pricing`. RBAC `price.read/write`.
- **M10 Marketing (`marketing_campaigns`/`leads`):** chiến dịch (channel/budget/cost), lead
  (NEW→CONTACTED→BOOKED→WON→LOST) → convert thành khách; attribution first-touch qua `Customer.campaignId`/
  `Booking.campaignId`; `campaignMetrics` (leads/khách/booking/doanh thu/conversion/ROI/cost-per-lead/customer).
  API `/marketing-campaigns`(+`[id]` metrics), `/leads`(+`[id]`,`[id]/convert`). UI `/marketing`(+`[id]`).
  RBAC `marketing.read/write`.

**Timeline khách (mục 23):** đã gộp thêm sự kiện proposal / care / recommendation ngoài crm/booking/
assessment/plan/session/payment — hồ sơ khách là nơi xem toàn bộ hành trình.

**Data integrity (snapshot vs mutable):** template/catalog/price là mutable; bản ghi lịch sử được đông cứng
bằng snapshot/version: proposal `acceptedSnapshot`, FormInstance `schemaSnapshot`+`templateVersion`, care
instance snapshot content, booking/session giá snapshot, ProposalItem `unitPrice` snapshot. Sửa mẫu/giá về
sau KHÔNG đổi bản ghi đã chốt.

### Nợ kỹ thuật / phần tạm thời (cập nhật)

- Field media (`IMAGE`/`VIDEO`/`FILE`) vẫn nhập URL, chưa upload file thật; SIGNATURE lưu dataURL base64
  trong JSON (chưa tách blob storage).
- **M8**: tham chiếu kho (`inventoryProductId`/`warehouseId`) là **soft String** — CHƯA trừ tồn thật trong
  `StockMovement` của phần kho THNG; kiểm tra tồn khả dụng chưa hard-block (mới snapshot cost + bucket).
- **M9**: `resolvePrice` chưa áp tự động cho proposal/session (mới áp cho booking); chưa có UI gói (PACKAGE)
  ngoài nhập tay tên.
- **M10**: attribution mới first-touch (1 campaign/khách); multi-touch để mở rộng sau.
- `TABLE`/`REPEATING_GROUP` dùng chung renderer lưới (REPEATING_GROUP chưa render subFields lồng nhau).
- Chưa có test tự động; kiểm chứng bằng `tsc --noEmit` + `next build` (đều pass) — chưa chạy migration/seed
  trên Postgres thật trong môi trường này.

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
