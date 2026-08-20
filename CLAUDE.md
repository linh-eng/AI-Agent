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
- (Đã bổ sung ở Phase Production Hardening — xem mục dưới.)

## Phase Production Hardening (P1–P5) — inventory thật · pricing · storage · tests · Customer Portal

Giai đoạn củng cố tính đúng đắn & sẵn sàng production. **Đã xác thực trên PostgreSQL 16 thật**
(migrate deploy + seed + 25 test vitest đều pass; `tsc`, `next build`, `next lint` sạch lỗi).

### Database migrations (thêm)
`5_inventory_link` (Lot.reservedQty, SessionMaterial.lotId, MaterialMovement.lotId/stockMovementId) →
`6_media_assets` (media_assets + MediaKind) → `7_customer_portal` (customer_portal_accounts,
CareInstructionInstance.acknowledgedAt). **Tất cả additive, 0 lệnh DROP.** Tổng 8 migration: `0_init`
… `7_customer_portal`. Quy trình deploy/baseline như mục "Migration DB".

### P1 — Inventory rules (nguồn sự thật = StockMovement)
- Vật tư buổi gắn **Lot kho** (`SessionMaterial.lotId`) sẽ **trừ tồn thật**. `Lot.quantity` = tồn vật lý,
  `Lot.reservedQty` = đang giữ; **khả dụng = quantity − reservedQty**.
- Vòng đời: `REQUEST → RESERVE → ISSUE → CONSUME/WASTE/DAMAGE → RETURN`. **ISSUE** là điểm trừ tồn duy nhất
  (ghi `StockMovement` OUTBOUND + snapshot giá vốn); RETURN cộng lại (INBOUND); CONSUME/WASTE/DAMAGE định
  đoạt phần đã xuất (không trừ tồn lần 2, chặn vượt phần đang cầm).
- **Chặn tồn âm** khi RESERVE/ISSUE, trừ khi `ALLOW_NEGATIVE_STOCK=true` (config). **An toàn đồng thời**:
  khóa dòng Lot bằng `SELECT … FOR UPDATE` trong transaction (test: 2 ISSUE đồng thời không oversell).
- **CONSUME** cộng vào `session.materialCost` và `actualCost` (tiêu hao = chi phí thật). SP chuyên nghiệp
  (không gắn lô) chỉ tính chi phí, không đụng tồn. `src/lib/material-service.ts`, `src/lib/config.ts`.

### P2 — Price resolution rules
- **Thứ tự ưu tiên:** `CUSTOM > CAMPAIGN > VIP > MEMBER > BRANCH > STANDARD`, chỉ giá **còn hiệu lực** theo
  ngày, và **lọc theo nhóm khách** (`priceTypesForCustomer`): khách thường KHÔNG hưởng MEMBER/VIP.
- `resolvePrice` + `resolveItemPricing` áp khi tạo **booking, treatment session, product recommendation,
  proposal (POST & PATCH item)** → **LƯU SNAPSHOT** giá tại thời điểm tạo. Đổi bảng giá/catalog về sau
  KHÔNG đổi bản ghi đã lập/đã chốt (proposal `acceptedSnapshot`, booking/session `price`, ProposalItem
  `unitPrice`). PACKAGE là target giá hợp lệ (UI `/pricing`). `src/lib/pricing.ts`.

### P3 — Storage architecture (media riêng tư)
- Interface `StorageProvider` (put/get/delete) — `LocalStorageProvider` ghi vào thư mục **ngoài `public/`**
  (`STORAGE_DIR`, mode 0600, chống path-traversal). Đổi sang S3/GCS chỉ cần thêm provider + `STORAGE_DRIVER`.
- `MediaAsset`: metadata (filename, contentType, size, kind, customerId, sessionId, uploadedBy,
  `sharedWithCustomer`, `isArchived`). **Không có URL công khai** — chỉ tải qua `/api/media/[id]` (nhân viên,
  `customer.read`) hoặc `/api/portal/media/[id]` (khách, phải sở hữu + đã chia sẻ). Upload kiểm size + MIME
  allowlist. **Xóa = archive mềm** (không mồ côi tham chiếu). Ảnh trước/sau ở màn ghi buổi dùng upload thật.

### Tests (test/, vitest + DB `thng_test`) — 25 test
`inventory` (reserve/issue/consume/return, chặn oversell, đồng thời, chi phí) · `pricing` (precedence,
tier, hiệu lực, snapshot bất biến) · `workflow` (customer→assessment→plan→session→form instance snapshot→
care snapshot→booking→media→payment→timeline; proposal accept snapshot) · `storage` (roundtrip, traversal)
· `rbac` (ma trận finance.read, maskFinance) · `portal-security` (IDOR, cross-session, media share-gating).
Chạy: `npm test` (cần `.env.test` trỏ `thng_test`, không chạy trên DB thật).

### P5 — Customer Portal + Security decisions
- **Xác thực tách biệt:** phiên portal cookie riêng `thng_portal`, scope `"portal"`, payload chỉ có
  `customerId`. `verifyPortalSession` từ chối token nhân viên và ngược lại. Middleware tách khu `/portal` &
  `/api/portal`.
- **Chống IDOR (enforce ở SERVER):** mọi truy vấn portal scope theo `customerId` **lấy từ phiên** (không tin
  client); route đối tượng kiểm ownership và trả **404** nếu không sở hữu (không lộ tồn tại). Media khách chỉ
  trả khi `customerId` khớp + `sharedWithCustomer` + chưa archive.
- **Chống rò rỉ:** endpoint portal whitelist trường — KHÔNG trả giá vốn/chi phí/margin/ghi chú nội bộ/đánh
  giá nội bộ/vật tư/tồn/audit. Nhân viên: `maskFinance` theo `finance.read`. Media không public.
- **Audit:** ghi `PROPOSAL_ACCEPTED_PORTAL`, `PORTAL_ACCOUNT_SET`, `PRICE_SET`, biến động vật tư.
- Đăng nhập trả lỗi chung (không lộ email tồn tại); mật khẩu bcrypt.
- Rà soát: mọi route API đều có `require*` (trừ auth/portal login-logout, `auth/me` chỉ trả phiên của chính
  người gọi). `grep` xác nhận portal routes không select trường nhạy cảm.

### Còn lại / nợ kỹ thuật (Phase Hardening)
- **SIGNATURE** vẫn lưu dataURL base64 trong JSON phiếu (chưa đẩy blob sang storage); attachments của
  form-instance chưa đổi sang upload.
- Chưa có **UI bật cờ `sharedWithCustomer`** cho từng ảnh (mới qua API/seed) — cần thêm nút chia sẻ ở màn
  ghi buổi để khách thấy ảnh trước/sau.
- Inventory tích hợp qua **Lot** (LOT-tracking). Sản phẩm QUANTITY thuần & serial chưa nối vào luồng vật tư
  buổi. Chưa trừ tồn cho `professionalProducts` nhập tay không gắn lô.
- `resolvePrice` chưa có UI **gói (PACKAGE)** dạng danh sách hạng mục (mới nhập tên + giá).
- Storage mới có **LocalStorageProvider**; production nên cấu hình S3/GCS + backup. Test tích hợp mức HTTP
  route (Next runtime) chưa có — test hiện ở tầng service/DB + đơn vị.
- Chưa có rate-limiting cho đăng nhập portal/nhân viên (khuyến nghị trước production).

> Các mục trên (UI chia sẻ media, storage S3, backup, rate-limit, HTTP integration test) **đã được
> xử lý trong Phase Production Security Hardening (SEC1–SEC8)** ngay dưới đây.

## Phase Production Security Hardening (SEC1–SEC8) — chống brute-force · tách secret · object storage · backup · HTTP tests · media-sharing UI

Giai đoạn siết an ninh trước khi triển khai staging. **Đã xác thực trên PostgreSQL 16 thật**: `tsc` sạch,
`next lint` 0 lỗi, `next build` OK, **48 test vitest pass** (8 file, gồm test tích hợp HTTP mới), migrate
deploy + status + seed chạy sạch trên DB **staging trắng** (`thng_staging`).

### Migration thêm
`8_auth_throttle` (bảng `auth_throttles`). Additive, 0 lệnh DROP. Tổng **9 migration**: `0_init` …
`8_auth_throttle`. Quy trình deploy/baseline không đổi (xem "Migration DB").

### Kiến trúc xác thực (auth architecture)
- **Hai phiên TÁCH BIỆT hoàn toàn**, cookie riêng, secret riêng, scope riêng:
  - **Nhân viên**: cookie `thng_session`, ký bằng `AUTH_SECRET`, payload gồm `userId/email/roles/permissions`.
    Lib: `src/lib/auth.ts` (ký/verify, edge-safe jose) + `src/lib/session.ts` (`getSession/requireAuth/
    requirePermission`, dùng `next/headers`).
  - **Khách (portal)**: cookie `thng_portal`, ký bằng `PORTAL_AUTH_SECRET` (nếu trống → phái sinh
    `${AUTH_SECRET}::portal`, **luôn khác** secret staff), payload **chỉ** `customerId` + scope `"portal"`.
    Lib: `src/lib/portal-auth.ts` (edge-safe) + `src/lib/portal-session.ts` (`requirePortal`).
- **Cô lập phiên (kiểm chứng bằng test):** token staff KHÔNG verify được ở portal và ngược lại (secret khác
  nhau + kiểm `scope`). Test `http-integration` đặt token chéo vào cookie đối phương → nhận **401**.
- Mọi route API đều có `require*` trừ: `auth/login`, `auth/logout`, `auth/me` (chỉ trả phiên của chính
  người gọi), `portal/login`, `portal/logout`, `storage/blob` (ủy quyền bằng **signed token**, không phiên).

### SEC1 — Rate limiting + progressive lockout (`src/lib/rate-limit.ts`)
- **Lưu state trong DB** (`auth_throttles`) → đúng trên **multi-instance / serverless** (không dùng bộ nhớ
  tiến trình). Đếm thất bại theo **NHIỀU key song song: theo IP và theo account identifier** (`staff:ip:` /
  `staff:acct:` / `portal:ip:` / `portal:acct:`).
- **Khóa TẠM THỜI lũy tiến** theo số lần thất bại trong cửa sổ `WINDOW` (mặc định 15': `LOGIN_THROTTLE_WINDOW_MS`):
  **5→1 phút, 8→5 phút, 11→15 phút, 15+→60 phút (trần)**. **KHÔNG khóa vĩnh viễn**; reset khi đăng nhập
  thành công (`recordSuccess`) hoặc hết cửa sổ.
  - *Lý do ngưỡng:* cho phép người dùng thật gõ nhầm vài lần (≤4 không phạt), chặn dứt điểm dò mật khẩu tự
    động (mỗi bậc tăng cấp số nhân), trần 60' tránh biến thành DoS khóa tài khoản vĩnh viễn.
- Áp cho **login nhân viên** và **login cổng khách** (`checkThrottle` TRƯỚC khi so mật khẩu → **429** kèm
  `retryAfter`). Áp cho identifier **bất kể account tồn tại hay không** → không lộ sự tồn tại.
- **Phản hồi chung an toàn:** sai mật khẩu và account-không-tồn-tại trả **cùng** thông báo 401
  ("Email hoặc mật khẩu không đúng"). **Audit** khi bắt đầu khóa (`LOGIN_THROTTLED`) — **không log mật
  khẩu/bí mật**. Đăng nhập thành công ghi `LOGIN`.

### SEC2 — Tách secret (env, không hard-code)
- `AUTH_SECRET` (staff) và `PORTAL_AUTH_SECRET` (portal) **độc lập**. Không hard-code secret; đọc từ env.
  Cảnh báo (console.warn) khi thiếu ở `NODE_ENV=production`. Toàn bộ biến môi trường tài liệu hóa trong
  **`.env.example`** (không có giá trị secret thật): `DATABASE_URL`, `AUTH_SECRET`, `PORTAL_AUTH_SECRET`,
  `SESSION_MAX_AGE`, `PORTAL_SESSION_MAX_AGE`, `LOGIN_THROTTLE_WINDOW_MS`, `ALLOW_NEGATIVE_STOCK`,
  `STORAGE_DRIVER/STORAGE_DIR/STORAGE_MAX_BYTES/STORAGE_SIGNED_URL_TTL`, `S3_*`.

### SEC3 — Object storage + signed URL (`src/lib/storage.ts`, `src/lib/config.ts`)
- Interface `StorageProvider` {`put/get/delete/getSignedUrl`}. **LocalStorageProvider** (dev; ghi ngoài
  `public/`, mode 0600, chống path-traversal, signed URL nội bộ `/api/storage/blob?t=<HMAC token>`) và
  **S3StorageProvider** (`STORAGE_DRIVER=s3`; bucket **private**, **presigned GET** hết hạn ngắn). Đổi driver
  chỉ qua env — không sửa code gọi.
- **Không có URL công khai vĩnh viễn** cho media riêng tư. Tải chỉ qua route có kiểm quyền:
  `/api/media/[id]` + `/api/media/[id]/url` (nhân viên `customer.read`) hoặc `/api/portal/media/[id]` +
  `.../url` (khách: **phải sở hữu + `sharedWithCustomer=true` + chưa archive**, nếu không → **404**).
- **Kiểm tra ủy quyền TRƯỚC khi cấp signed URL** (route `/url` chạy `require*`/ownership rồi mới ký). Signed
  token HMAC (`signBlobToken/verifyBlobToken`, `timingSafeEqual`) có hạn `STORAGE_SIGNED_URL_TTL`.
- **Khóa object không đoán được** (`newStorageKey` = `yyyy/mm/uuid.ext`). `validateUpload` kiểm **size +
  MIME allowlist + chặn đuôi thực thi/script** (`.exe .js .svg .php .sh …`) → chặn upload mã thực thi. **Xóa
  = archive mềm** (`isArchived`), không mồ côi tham chiếu.

### SEC4 — Backup & recovery (`docs/BACKUP.md`)
- Tài liệu chiến lược sao lưu **PostgreSQL** (pg_dump ngày + PITR/WAL; retention 14 ngày/8 tuần/12 tháng) và
  **object storage** (S3 versioning + Object Lock + CRR; retention 90 ngày), quy trình khôi phục **đồng bộ
  cùng mốc thời gian** DB↔blob, RPO ≤15' / RTO ≤2h, kiểm thử restore hằng quý.
- **Trung thực:** doc ghi rõ **"TÀI LIỆU/KẾ HOẠCH — CHƯA vận hành"**; backup **chưa** được cấu hình chạy
  thật (đây là blocker hạ tầng, xem "Blocker còn lại").

### SEC5 — HTTP integration test (`test/http-integration.test.ts`, 16 test)
- Gọi **route handler thật** của Next với `Request` thật, đi qua **toàn bộ** xác thực (cookie phiên) + RBAC
  + ownership + Prisma trên **Postgres thật**. Lớp mô phỏng **duy nhất** là vận chuyển cookie (jar mock
  `next/headers`); ký/verify token, phân quyền, DB đều là mã production.
- Bao phủ: **Auth** (login đúng/sai/khóa 429/portal/cô lập phiên 2 chiều), **Authz** (ẩn danh→401, thiếu
  quyền→403, không `finance.read`→`cost`=null), **Portal IDOR** (A xem của B→404, id giả→404, item báo giá
  không lộ `unitCost`), **Media authz** (ẩn danh→401, chéo khách→404, chưa chia sẻ→404, nhân viên theo RBAC).

### SEC6 — UI chia sẻ media (`src/components/session-media-share.tsx`)
- Nhân viên (quyền `media.write`) bật/tắt **từng ảnh** để hiển thị trên Cổng khách, ngay trong màn **ghi
  buổi** (`/treatment-plans/[id]` → RecordSessionModal). **Mặc định RIÊNG TƯ** (`sharedWithCustomer=false`);
  Checkbox **disabled** nếu thiếu quyền. Portal **tôn trọng cờ tức thì** (đọc trực tiếp DB mỗi request).
- `/api/media/[id]` PATCH ghi **audit** `MEDIA_SHARED`/`MEDIA_UNSHARED` kèm `userId` (ai đổi, khi nào). Media
  nội bộ vẫn nội bộ **bất kể biết id** (kiểm ở server, không dựa UI ẩn).

### SEC7 — Re-audit an ninh (kết quả)
- **Server-side enforcement:** mọi authz ở tầng route/service (`require*`, ownership 404, `maskFinance`),
  không phụ thuộc ẩn UI. Rà `grep`: route portal **không** select `cost/unitCost/margin/ghi chú nội bộ/
  audit`.
- **Dependency:** `npm audit` → nâng **Next 14.2.15 → 14.2.35** (vá các CVE nghiêm trọng: DoS qua Server
  Actions, SSRF qua middleware redirect, cache poisoning, content injection, lộ thông tin dev-server). Giữ
  trong dòng 14.2.x (không nhảy major phá vỡ).

### Xác thực trước staging (SEC8)
Chạy sạch: `tsc` (0 lỗi) · `next lint` (0 lỗi, chỉ warning exhaustive-deps) · `next build` (OK) · **48 test**
(vitest, Postgres `thng_test`) · `prisma migrate deploy` + `migrate status` ("up to date") + `db:seed` trên
**DB staging trắng `thng_staging`**.

### Blocker / nợ kỹ thuật còn lại (SEC)
- **Backup CHƯA vận hành** — `docs/BACKUP.md` là kế hoạch; phải cấu hình pg_dump/PITR + S3 versioning/CRR +
  off-site + alerting trên hạ tầng thật trước khi coi là "đã bật". **(Blocker hạ tầng cho production.)**
- **Object storage production** — mặc định `STORAGE_DRIVER=local`; production phải đặt `s3` + bucket private
  + backup. S3 provider có sẵn nhưng chưa chạy end-to-end trên bucket thật trong CI.
- **Dependency còn lại:** vài CVE của `next`/`postcss` chỉ có bản vá ở **next@16 (major, phá vỡ)** — hoãn
  nâng major (DoS/HTTP smuggling — mức availability, thấp hơn nhóm bảo mật dữ liệu đã xử lý). Chuỗi công cụ
  dev (vitest/vite/esbuild/eslint) có CVE **chỉ ảnh hưởng dev server**, không ship production.
- **Rate-limit** dùng DB (đúng đa-instance) nhưng chưa có dọn rác bản ghi hết hạn (khuyến nghị cron
  `DELETE FROM auth_throttles WHERE locked_until < now() AND updated_at < now() - interval '1 day'`).

## Phase Hạ tầng Staging (INF1–INF6) — env 3 môi trường · object storage · storage hardening · chữ ký · logger · backup vận hành

Giai đoạn đưa hệ thống sang **môi trường Staging gần production**. Tài liệu triển khai:
`docs/STAGING.md` (deploy + bước provider), `docs/BACKUP.md` (backup/restore vận hành),
`docs/MONITORING.md` (logging/alert). **Đã xác thực:** tsc sạch · lint 0 lỗi · build OK ·
**56 test pass** (9 file) · migrate deploy (9 migration) + status + seed sạch trên DB staging trắng.

### Mô hình 3 môi trường (`.env.example`)
`development` (FS local) · `staging` (S3 private + secret riêng + `staging.<domain>`) ·
`production` (phase sau). Thêm `APP_URL/NEXT_PUBLIC_APP_URL` (không hard-code domain),
`APP_ENV`, `LOG_LEVEL`, `SENTRY_DSN`. **Serverless (Vercel): staging/prod BẮT BUỘC
`STORAGE_DRIVER=s3`** — FS local không bền vững giữa request/instance.

### INF2 — Storage hardening (`src/lib/storage.ts`)
- **S3 PutObject** thêm `ServerSideEncryption: AES256` (mã hóa at-rest); bucket vẫn **private**
  (không set ACL public).
- **`validateUploadBytes` + `sniffContentType`**: xác thực bằng **MAGIC BYTES** — KHÔNG tin
  MIME/filename browser; MIME khai báo phải **khớp** nội dung thật; chỉ nhận JPEG/PNG/WEBP/GIF/
  PDF/MP4/QuickTime/HEIC. Route upload media dùng validation này (chống upload exe ngụy trang ảnh).

### INF3 — Chữ ký → storage thật (`src/lib/signature-storage.ts`)
- `persistInlineSignatures`: khi lưu FormInstance, đẩy `dataURL` base64 (chữ ký/ảnh nhúng) lên
  storage **riêng tư** (`MediaAsset` kind=SIGNATURE, `sharedWithCustomer=false`), thay bằng
  `mediaId` — DB chỉ giữ object key + metadata, **không** giữ base64. Idempotent; lỗi upload
  không làm mất chữ ký (giữ tạm + log). `form-renderer` hiển thị chữ ký đã lưu qua `mediaId`
  (ảnh riêng tư, route kiểm quyền). **(Thay thế nợ kỹ thuật "SIGNATURE base64" của SEC.)**

### INF4 — Logger/monitoring (`src/lib/logger.ts`)
- Log JSON có **REDACT tự động**: che khóa nhạy cảm (password/secret/token/cookie/DATABASE_URL/
  S3 keys/AUTH_SECRET) + pattern trong value (JWT, `Bearer`, `data:…;base64`, query của signed/
  presigned URL). Cấp độ theo `LOG_LEVEL`. `handle()` 500 dùng logger + trả thông báo chung tiếng
  Việt ("Đã xảy ra lỗi. Vui lòng thử lại sau."). Sẵn sàng cắm Sentry qua `SENTRY_DSN`.

### INF5 — Tests (`test/staging-hardening.test.ts`, 8 test → tổng 56)
Bất biến version biểu mẫu/Protocol (áp mẫu → snapshot; sửa mẫu lên V2 KHÔNG đổi bản đã áp) ·
magic-byte upload (chặn exe ngụy trang, MIME lệch nội dung) · chữ ký → MediaAsset (DB không giữ
base64, idempotent) · logger redact bí mật.

### INF6 — Docs vận hành
`docs/STAGING.md` (env, tương thích serverless/Prisma pooling, deploy schema, cookie HTTPS, **các
bước provider: Postgres/R2-S3/Vercel/DNS/monitoring**, smoke test, danh sách KHÔNG-làm) ·
`docs/BACKUP.md` bổ sung **hướng dẫn thao tác + quy trình kiểm thử restore** · `docs/MONITORING.md`.

### Rate limiting đa-instance (xác nhận)
State ở **DB** (`auth_throttles`) → đúng trên serverless/nhiều instance (không dùng memory tiến
trình). Không cần đổi provider; abstraction rõ ràng.

### Blocker hạ tầng còn lại (CẦN người quản trị — chưa thể bật từ code)
- **DB provider staging** (Neon/Supabase/RDS): tạo instance + `DATABASE_URL` + bật automated
  backup/PITR. **[Critical để có staging]**
- **Object storage** (R2/S3): tạo bucket **private** + versioning + access key + đặt `S3_*`.
  **[Critical để có staging trên serverless]**
- **Deploy Vercel + domain `staging.<domain>` + DNS + HTTPS**. **[Critical]**
- **Backup/restore VẬN HÀNH thật** + kiểm thử restore (DB + object). **[High — trước production]**
- **Monitoring provider** (Sentry): đặt `SENTRY_DSN` + cài SDK. **[Medium]**
- **CVE `next`/`postcss`** chỉ vá ở next@16 (major) — **hoãn theo yêu cầu** (không nâng trong phase
  này). **[Medium/Low — availability]**
- Chưa trừ tồn cho `professionalProducts` nhập tay không gắn lô; cron dọn `auth_throttles`. **[Low]**

## Module VẬT TƯ SPA (MAT1–MAT6) — 2 khái niệm nghiệp vụ (đơn giản hóa)

Theo yêu cầu thu hẹp phạm vi: giao diện chỉ dùng **2 khái niệm**, KHÔNG dùng "kho kế toán / kho trung
tâm / inventory accounting / procurement". Module vật tư spa **tách hoàn toàn** khỏi Kho THNG (phần cứng).
Migration `9_spa_materials` (additive, 0 DROP; tổng **10 migration**). **61 test pass** (thêm
`test/spa-materials.test.ts`).

### 1) "Kho vật tư sử dụng" (`UsageMaterial` + `MaterialContainer`)
Vật tư/sản phẩm chuyên môn dùng trong dịch vụ — theo **lọ/chai/lô (container)**, **dùng chung nhiều
khách, nhiều buổi**. Container: `initialQty`, `remainingQty`, `unit`, `costSnapshot` (giá vốn cả lọ),
`openedAt`, `expiryDate`, `status` (IN_USE/LOW/EMPTY/DISPOSED). Material: `expectedPerSession` (định mức),
`lowThreshold`. UI: `/materials` (dashboard: đang dùng / lọ đang mở / sắp hết / sắp hết hạn / tiêu hao +
chi phí hôm nay) + danh sách lọ + nút **Dùng** / **Hủy lọ** / **Thêm vật tư** / **Thêm lọ/lô**.

### 2) "Vật tư khách hàng" (`CustomerMaterial`)
Vật tư **dành riêng 1 khách** — `allocatedQty` (đã cấp), `usedQty` (đã dùng), còn lại = cấp − dùng; dùng
qua nhiều buổi; **KHÔNG dùng chéo khách**. UI: `/customer-materials` + **tab "Vật tư khách hàng"** trong
hồ sơ khách.

### Tiêu hao (`MaterialUsage`) — lịch sử chung 2 nguồn
`src/lib/spa-material-service.ts`: `consumeFromContainer` (trừ `remainingQty`, phân bổ chi phí =
`quantity × costSnapshot/initialQty`, cập nhật status) và `consumeFromCustomerMaterial` (cộng `usedQty`,
**chặn dùng chéo khách** — buổi phải thuộc đúng khách sở hữu, chặn vượt số cấp). Cả 2 **khóa dòng
`SELECT … FOR UPDATE`** trong transaction (chống dùng vượt khi đồng thời), ghi `MaterialUsage`, và cộng
`session.materialCost` (gán `actualCost` nếu trống). `reverseUsage` để hoàn tác.

### Session Execution — chọn NGUỒN
`src/components/spa-material-consume.tsx` trong màn **Ghi nhận buổi** (`/treatment-plans/[id]`): chọn
**nguồn** (Kho vật tư sử dụng | Vật tư khách hàng) → chọn lọ/vật tư (vật tư khách chỉ liệt kê của đúng
khách) → hiện **còn lại** → nhập số dùng → lưu lịch sử + trừ tồn. Danh sách đã dùng trong buổi hiển thị ngay.

### Báo cáo & dashboard
`src/lib/materials-report.ts`: dashboard (`/api/materials/dashboard`) + báo cáo `/materials/report`:
tiêu hao theo **khách/buổi/dịch vụ/công nghệ/protocol/nhân viên**, **định mức vs thực tế**, chi phí (mask
theo `finance.read`). Sidebar nhóm **"Vật tư"**: Kho vật tư sử dụng · Vật tư khách hàng · Lịch sử sử dụng ·
Báo cáo vật tư.

### Demo (bắt buộc) — đã seed
- **JetPeel Solution Demo**: 1 lọ 100ml, giá vốn 2.000.000₫ (20.000₫/ml), định mức 5ml/buổi. Customer A
  dùng 5ml, Customer B 7ml, A dùng tiếp 6ml → **còn 82ml**; chi phí buổi 100k/140k/120k.
- **Vật tư khách hàng**: Customer A có 10 đơn vị; buổi 1 dùng 3, buổi 2 dùng 2 → **còn 5**. Khách khác
  KHÔNG dùng được (chặn ở service, có test).

### RBAC & nợ kỹ thuật
- Quyền: đọc = `customer.read`; ghi/tiêu hao = `material.write`. Chi phí (`costSnapshot`/`unitCost`/
  `costAllocated`) **mask theo `finance.read`**.
- `SessionMaterial`/`MaterialMovement` cũ (module 8, gắn Lot Kho THNG) **giữ nguyên** cho tương thích —
  UI vật tư spa dùng mô hình mới. Có thể gỡ luồng cũ trong màn buổi ở phase sau nếu muốn thống nhất.
- Chưa có UI sửa/hủy từng lần tiêu hao trên màn (đã có `reverseUsage` ở service). **[Low]**

## Lõi tài chính hợp nhất (mục 14–18) — Báo giá → Chốt → HÓA ĐƠN → Thanh toán → Công nợ

Bổ sung theo MASTER PROMPT (slice trọng tâm phần này). **Đã xác thực trên PostgreSQL 16 thật**: tsc sạch ·
lint 0 lỗi · build OK · **68 test pass** (thêm `test/invoice.test.ts`, 7 test) · migrate deploy (11 migration)
+ seed + seed:demo chạy sạch trên DB trắng.

### Migration thêm — `A_invoices` (KHÔNG phải `10_`)
Prisma sắp xếp migration theo **tên thư mục (lexicographic)**; chữ số < chữ hoa nên `10_...` sẽ chạy TRƯỚC
`1_...` (sai thứ tự, làm hỏng fresh deploy). Vì các migration cũ đã dùng tiền tố 1 chữ số `0..9` (đã áp trên
máy người dùng — không thể đổi tên), migration thứ 10 đặt tên **`A_invoices`** để đảm bảo sắp **sau cùng**.
Các migration sau tiếp tục dùng tiền tố chữ (`B_`, `C_`…). Additive, **0 lệnh DROP**. Tổng **11 migration**:
`0_init` … `9_spa_materials` → `A_invoices`.

### Dữ liệu (schema.prisma)
- `Invoice` (`invoices`): `code` (HD-xxxxxx), `customerId`, `proposalId?` (báo giá nguồn), `planId?`,
  `status` (`InvoiceStatus`: UNPAID/PARTIAL/PAID/CANCELLED), `subtotal/discount/total` (snapshot), `dueDate?`,
  `note`, `createdBy`. `InvoiceItem` (`invoice_items`): snapshot `name/quantity/unitPrice/amount`.
- `Payment` thêm `invoiceId?` (+relation) — thanh toán gắn hóa đơn; **1 hóa đơn nhiều lần trả** (append-only).
- `Customer` thêm `legacyId?` + `legacySource?` (đối chiếu **import MySpa** sau này) + `@@index([legacyId])`.
- `AppSetting` (`app_settings`): `key` → `value(JSON)` — cấu hình **Thương hiệu** lưu DB (mục 1).

### Service — `src/lib/invoice.ts`
`createInvoiceFromProposal` (chỉ từ báo giá **ACCEPTED**, dựng hạng mục từ `acceptedSnapshot`, tổng =
`agreedPrice`; **idempotent** — báo giá đã có hóa đơn chưa hủy thì trả lại, không tạo trùng) ·
`recomputeInvoiceStatus` (suy UNPAID/PARTIAL/PAID theo tổng đã trả; bỏ qua CANCELLED) · `invoicePaidAmount` ·
`customerInvoiceFinancials` (công nợ **TỪ HÓA ĐƠN**). `clinic.ts::customerFinancials` ưu tiên hóa đơn, fallback
phác đồ/booking khi khách chưa có hóa đơn (tương thích dữ liệu cũ). Timeline khách thêm sự kiện `invoice`.

### API
`/api/invoices` (GET list + kèm paidAmount/outstanding; POST tạo từ `proposalId` hoặc thủ công `customerId`+items)
· `/api/invoices/[id]` (GET chi tiết + payments + outstanding; PATCH hủy — **chặn hủy khi đã có thanh toán**) ·
`/api/payments` nâng cấp: nhận `invoiceId`, **chặn thu vượt công nợ còn lại**, tự `recomputeInvoiceStatus` ·
`/api/settings/brand` (GET mọi user đã đăng nhập; PUT cần `setting.write`).

### UI
Sidebar nhóm **Spa & CRM** thêm **Hóa đơn** + **Thanh toán**; nhóm mới **Hệ thống → Cài đặt**.
`/invoices` (dashboard công nợ + lọc trạng thái) · `/invoices/[id]` (hạng mục + lịch sử thu + nút **Thu tiền**
đa lần + **Hủy**) · `/payments` (sổ thu, link hóa đơn) · `/settings` (Thương hiệu: tên/khẩu hiệu/màu/logo, lưu DB).
Màn **Báo giá đã chốt** thêm nút **Tạo hóa đơn** → nhảy sang hóa đơn. Brand hiển thị (tên/logo) đọc từ DB qua
`getBrand()` ở layout, fallback `NEXT_PUBLIC_BRAND_NAME`. **Hồ sơ khách** có tab **Hóa đơn** + **Thanh toán**
riêng (ngoài Timeline). **Tên phần mềm mặc định = "Sophia Care"** (seed vào `app_settings`; đổi ở Cài đặt).

### RBAC
`invoice.read` (gộp vào `CLINIC_READ` — mọi vai trò spa xem được) · `invoice.write` (MANAGER/RECEPTION/CASHIER) ·
`setting.write` (MANAGER). Giá vốn hạng mục vẫn **mask theo `finance.read`** ở tầng báo giá.

### Demo (seed:demo)
PROP-100001 (KH-100004) **ĐÃ CHỐT** phương án Khuyến nghị (11.900.000₫) → **HD-000001** (PARTIAL) → thu
2 đợt 5.000.000₫ + 3.000.000₫ (đều gắn hóa đơn) → **đã trả 8.000.000₫ ≤ tổng phải thu, còn phải thu
3.900.000₫** (không có tiền dư). KH-100001 có `legacyId=MYSPA-8842`, `legacySource=MySpa`, `dob`.

### Còn lại / để phase sau (MASTER PROMPT phần chưa làm trong slice này) — **báo cáo trung thực**
Booking (kỹ thuật viên/master/phòng/giường/máy + lịch Ngày/Tuần/Tháng + phát hiện trùng lịch); HR đa vai trò +
vai trò nhân sự theo buổi kèm fee; giá sàn (bảng chi phí + cảnh báo/duyệt khi bán dưới sàn); CSKH nâng cao
(workflow follow-up có mẫu/checklist/kịch bản/kênh, chương trình CSKH sinh nhật/loyalty); đánh giá khách &
báo cáo kỹ thuật viên sau buổi; **import MySpa** (preview/mapping/validate/trùng lặp) — mới đặt nền `legacyId`;
tab **Hóa đơn/Thanh toán** riêng trong hồ sơ khách (hiện đã hiện trong Timeline + lọc `/invoices?customerId=`);
báo cáo A–O mở rộng. Đã sửa **bug hiển thị loại phương án** ở mức nhãn (map `PROPOSAL_KIND_LABEL` dùng chung
edit/view); cho phép **đổi tên phương án** (ô tên tự do trong màn báo giá).

## Booking nâng cao (mục 19–21) — Tài nguyên + Lịch + Cảnh báo trùng lịch

Phase sau MASTER PROMPT, ưu tiên #1. **Đã xác thực PostgreSQL 16 thật**: tsc sạch · lint 0 lỗi · build OK ·
**74 test pass** (thêm `test/booking.test.ts`, 6 test) · migrate deploy (12 migration) + seed + seed:demo sạch.

### Migration — `B_booking_resources`
Thêm cột `bed`, `machine`, `master`, `technician` vào `bookings` (String, theo quy ước "tác nhân = tên").
Additive, **0 lệnh DROP**. Tổng **12 migration**: `0_init` … `A_invoices` → `B_booking_resources`.
(Migration thứ 11+ tiếp tục tiền tố chữ `B_`, `C_`… để sắp đúng thứ tự — xem mục `A_invoices`.)

### Phát hiện trùng lịch — `src/lib/booking.ts`
`detectBookingConflicts({scheduledAt, durationMinutes, technician, master, room, bed, machine, excludeId})`:
2 booking trùng khi **cùng một giá trị tài nguyên** (khác rỗng, so sánh không phân biệt hoa/thường) **VÀ**
khoảng `[bắt đầu, kết thúc)` **giao nhau** (nửa mở — liền kề KHÔNG tính trùng). Thời lượng mặc định **60′**.
Chỉ xét booking còn "giữ chỗ" (`ACTIVE_STATUSES` = NEW/PENDING/CONFIRMED/ARRIVED/IN_PROGRESS/RESCHEDULED);
bỏ qua HỦY/KHÔNG ĐẾN/HOÀN THÀNH. `excludeId` bỏ qua chính booking đang sửa.

### API
`POST /api/bookings` và `PATCH /api/bookings/[id]`: nhận thêm resource + cờ `allowConflict` (không lưu DB).
Nếu có trùng và chưa `allowConflict` → **409** kèm `details.conflicts` (danh sách trùng). Có `allowConflict=true`
mới ghi. GET nhận `from`/`to` (đã có sẵn) để nạp theo khoảng cho lịch.

### UI — `/bookings`
4 chế độ xem: **Danh sách · Ngày · Tuần · Tháng** (điều hướng ‹ › + "Hôm nay"). Tuần = 7 cột ngày; Tháng =
lưới 6×7 (chip giờ+khách, "+N nữa"); Ngày = danh sách theo giờ. Form tạo booking có ô **Kỹ thuật viên,
Master, Phòng, Giường, Máy, Thời lượng**; khi trùng lịch hiện **banner cảnh báo vàng** liệt kê tài nguyên
nào bận (booking nào, giờ nào) + nút **"Vẫn đặt (bỏ qua cảnh báo)"** để ghi đè. Chip lịch hiển thị tài nguyên.

### Demo
BK-100001 (KTV Phạm Chuyên Viên, Phòng 2, Giường A, Máy RF #1, master Trần Quản Lý), BK-100003 (Phòng 3,
Máy RF #2). Thử tạo booking cùng KTV/phòng trùng giờ để thấy cảnh báo.

### Còn lại trong Booking (phase sau)
Kéo–thả đổi giờ trên lịch; lưới giờ (time-grid) dạng cột thời gian; lọc lịch theo KTV/phòng; đồng bộ
Booking ↔ TreatmentSession (buổi thực hiện). Danh mục tài nguyên (KTV/phòng/máy) hiện nhập tay (chưa có bảng
danh mục riêng) — sẽ chuẩn hóa khi làm HR (#2) & danh mục phòng/thiết bị.

## Nhân sự (mục 22–24) — Đa vai trò + phân công buổi kèm phí

Phase sau MASTER PROMPT, ưu tiên #2. **Đã xác thực PostgreSQL 16 thật**: tsc sạch · lint 0 lỗi · build OK ·
**78 test pass** (thêm `test/hr.test.ts`, 4 test) · migrate deploy (13 migration) + seed + seed:demo sạch.

### Migration — `C_hr`
`employees` (nhân sự) + `session_staff` (phân công buổi) + enum `SessionStaffRole`. Additive, **0 lệnh DROP**.
Tổng **13 migration**: `0_init` … `B_booking_resources` → `C_hr`.

### Dữ liệu
- `Employee` (`employees`): `code` NV-xxxxxx, `fullName`, `phone`, `email`, `roles String[]` (**đa vai trò**:
  Kỹ thuật viên/Master/CSKH/Sales/Quản lý/Lễ tân/Tư vấn/Bác sĩ), `defaultFee` (nhạy cảm — mask theo
  `finance.read`), `isActive` (soft delete). Nhân sự là thực thể riêng, **khác User đăng nhập**.
- `SessionStaff` (`session_staff`): `sessionId`, `employeeId?`, `staffName` (snapshot), `role`
  (`SessionStaffRole`: PRIMARY/ASSISTANT/MASTER/CHECKER/CONSULTANT = chính/hỗ trợ/master/kiểm tra/tư vấn),
  `fee` (nhạy cảm). Xóa buổi → cascade xóa phân công (nhân sự vẫn còn).

### API
`/api/employees` (GET list `?active=1&role=`, mask `defaultFee`; POST) · `/api/employees/[id]` (GET/PATCH,
soft delete qua `isActive`). `/api/session-staff` (GET `?sessionId` trả `{staff, totalFee, canSeeFinance}`
— tổng phí chỉ khi có `finance.read`; POST gán, tự lấy `defaultFee` của nhân sự nếu bỏ trống phí) ·
`/api/session-staff/[id]` (DELETE). Gán/xóa nhân sự buổi gated bằng `treatment.write` (người ghi buổi).

### RBAC
`hr.read` (gộp vào `CLINIC_READ` — mọi vai trò xem được để chọn khi ghi buổi) · `hr.write` (MANAGER/RECEPTION
— quản lý danh mục nhân sự). Phí (`defaultFee`, `fee`) **mask theo `finance.read`** ở cả list & tổng phí buổi.

### UI
Sidebar nhóm **Hệ thống → Nhân sự** (`/employees`): danh sách (mã/tên/**vai trò dạng chip**/liên hệ/phí mặc
định [mask]/trạng thái) + thêm/sửa (chọn **nhiều vai trò** bằng chip toggle, soft delete). Màn **Ghi nhận buổi**
(`/treatment-plans/[id]`) thêm mục **"Nhân sự thực hiện buổi"** (`components/session-staff.tsx`): chọn nhân
viên → vai trò → phí → thêm; hiện danh sách + **tổng phí** (nếu có quyền tài chính). **Timeline khách** ghi
nhân sự buổi ("Nhân sự: Tên (Chính), Tên (Kiểm tra)").

### Demo
4 nhân sự NV-000001..004 (đa vai trò). Buổi RF #1 của KH-100004 phân công: Phạm Chuyên Viên (Chính, 200k) +
Trần Quản Lý (Kiểm tra, 500k) → tổng phí 700k.

### Còn lại (phase sau)
Danh mục tài nguyên booking (phòng/máy) liên kết nhân sự; báo cáo hiệu suất/thù lao theo nhân sự; phí nhân sự
cộng vào giá sàn (làm ở #3 Giá sàn); chấm công/lịch làm việc. Nhân sự chưa liên kết `User` đăng nhập (tách biệt).

## Giá sàn (mục 25–26) — Bảng chi phí cấu thành → Giá sàn + chặn/duyệt bán dưới sàn

Phase sau MASTER PROMPT, ưu tiên #3. **Đã xác thực PostgreSQL 16 thật**: tsc sạch · lint 0 lỗi · build OK ·
**82 test pass** (thêm `test/price-floor.test.ts`, 4 test) · migrate deploy (14 migration) + seed + seed:demo sạch.

### Migration — `D_price_floor`
`service_price_floors` (1-1 với Service). Additive, **0 lệnh DROP**. Tổng **14 migration**:
`0_init` … `C_hr` → `D_price_floor`.

### Dữ liệu & công thức — `src/lib/price-floor.ts`
`ServicePriceFloor`: 6 thành phần chi phí (`laborCost` nhân sự KTV/master · `operationCost` vận hành ·
`depreciationCost` khấu hao thiết bị · `materialCost` vật tư · `roomCost` phòng/giường · `otherCost`) +
`minMarginPercent` (biên lợi nhuận tối thiểu %). **Tổng chi phí = Σ 6 thành phần**; **Giá sàn = tổng chi phí ×
(1 + biên/100)**. `computeFloor()` + `checkServicePriceFloor(serviceId, price)` → `{hasFloor, totalCost,
floorPrice, below, shortfall}`. Dịch vụ chưa khai báo chi phí → `hasFloor=false` (không chặn).

### API
`/api/price-floors` (GET: **cần `finance.read`** — trả list dịch vụ + chi phí + giá sàn + cờ `belowFloor` của
giá chuẩn; POST: upsert theo `serviceId`, cần `pricefloor.write`).

### Enforcement — Booking
`POST /api/bookings` sau khi chốt giá: nếu giá < giá sàn dịch vụ → **409** kèm `details.priceFloor`
(floorPrice/shortfall/`canOverride`). Chỉ ghi khi `allowBelowFloor=true` **VÀ** người dùng có
`pricefloor.override`. UI booking hiện **banner đỏ "Giá dưới giá sàn"** + nút **"Duyệt bán dưới sàn & lưu"**
(người có quyền) hoặc **"Cần người có quyền duyệt"** (khóa).

### RBAC
`pricefloor.write` (MANAGER/CASHIER — khai báo chi phí) · `pricefloor.override` (MANAGER/BOD — duyệt bán dưới
sàn). Chi phí/giá sàn **chỉ `finance.read` xem** (trang trả 403 nếu thiếu). 

### UI — `/price-floor`
Sidebar nhóm **Spa & CRM → Giá sàn**: bảng dịch vụ (tổng chi phí/biên/giá sàn/giá chuẩn + cờ "Giá chuẩn dưới
sàn"); modal khai báo 6 thành phần + biên → **xem trước tổng chi phí & giá sàn ngay**. Thiếu `finance.read`
thì trang báo không đủ quyền.

### Demo
Dịch vụ RF: chi phí 1.400.000 (nhân sự 700k + vận hành 150k + khấu hao 200k + vật tư 250k + phòng 100k),
biên 15% → **giá sàn 1.610.000**; giá chuẩn 1.800.000 (trên sàn). Thử tạo booking RF giá 1.000.000 để thấy
chặn/duyệt dưới sàn.

### Còn lại (phase sau)
Áp giá sàn cho **báo giá/hóa đơn** (hiện enforce ở booking); chi phí nhân sự tự lấy từ phân công buổi (hiện
nhập tay `laborCost`); giá sàn theo **gói/khuyến mãi**; lịch sử thay đổi giá sàn (version).

## CSKH follow-up (mục 31–35) — Quy trình chăm sóc + chương trình sinh nhật

Phase sau MASTER PROMPT, ưu tiên #4. **Đã xác thực PostgreSQL 16 thật**: tsc sạch · lint 0 lỗi · build OK ·
**85 test pass** (thêm `test/followup.test.ts`, 3 test) · migrate deploy (15 migration) + seed + seed:demo sạch.

### Migration — `E_followup`
`followup_templates` + `followup_steps` + enum `FollowUpTrigger`; `tasks` thêm `channel` (DeliveryChannel),
`checklist` (Json), `followUpTemplateId`. Additive, **0 lệnh DROP**. Tổng **15 migration**:
`0_init` … `D_price_floor` → `E_followup`.

### Dữ liệu & service — `src/lib/followup.ts`
`FollowUpTemplate` (code CS-xxxxxx, `trigger`: AFTER_SERVICE/AFTER_SESSION/BIRTHDAY/MANUAL, isActive) →
`FollowUpStep[]` (`dayOffset` số ngày sau mốc · `channel` kênh · `title` việc · `script` kịch bản ·
`checklist String[]`). `applyFollowUpTemplate({templateId, customerId, anchorDate, assignee})` → sinh **Task**
mỗi bước (dueDate = anchor + dayOffset, gắn channel/checklist/followUpTemplateId) trong 1 transaction + ghi
**CrmActivity** FOLLOW_UP (hiện trong timeline khách). `upcomingBirthdays(days, today)` → khách sinh nhật trong
N ngày tới (so ngày/tháng, tính tuổi + số ngày còn lại; `today` truyền vào để test tất định).

### API
`/api/followup-templates` (GET list; POST cần `followup.write`) · `/api/followup-templates/[id]` (GET/PATCH,
thay toàn bộ steps khi gửi) · `/api/followup-templates/[id]/apply` (POST, cần `task.write` — áp cho khách) ·
`/api/crm/birthdays?days=30` (sinh nhật sắp tới).

### RBAC
`followup.write` (MANAGER/CUSTOMER_CARE/RECEPTION — quản lý quy trình). Áp quy trình dùng `task.write`; đọc
quy trình/sinh nhật dùng `customer.read`.

### UI — `/followups`
Sidebar **Spa & CRM → CSKH · Follow-up**: **(1)** thẻ **Sinh nhật 30 ngày tới** (chip tên + ngày + tuổi +
"còn N ngày" + nút **Chúc mừng** áp quy trình BIRTHDAY); **(2)** bảng **quy trình** (mở rộng xem các bước) +
**Tạo/Sửa** (trình soạn bước: mốc ngày/kênh/việc/kịch bản/checklist mỗi dòng) + nút **Áp** (chọn khách +
mốc + người phụ trách → tạo N việc follow-up). Việc sinh ra hiện ở **/tasks** và **timeline khách**.

### Demo
2 quy trình: `CS-000001` Chăm sóc sau liệu trình (3 bước: Zalo +1 ngày, SMS +3, gặp +14) · `CS-000002` Chúc
mừng sinh nhật (BIRTHDAY). 2 khách có sinh nhật gần (KH-100002 20/08, KH-100004 30/08) để thấy thẻ sinh nhật.

### Còn lại (phase sau)
Tự động kích hoạt quy trình khi hoàn thành buổi/dịch vụ (hiện áp thủ công); gửi tin thật qua Zalo/SMS/Email
(hiện tạo việc để nhân viên chủ động liên hệ); chương trình loyalty/tích điểm; báo cáo hiệu quả follow-up.

## Đánh giá sau buổi & Before/After (mục 36–37, 8)

Phase sau MASTER PROMPT, ưu tiên #5. **Đã xác thực PostgreSQL 16 thật**: tsc sạch · lint 0 lỗi · build OK ·
**88 test pass** (thêm `test/review.test.ts`, 3 test) · migrate deploy (16 migration) + seed + seed:demo sạch.

### Migration — `F_session_review`
`session_reviews` (1-1 với TreatmentSession, `sessionId` unique). Additive, **0 lệnh DROP**. Tổng **16
migration**: `0_init` … `E_followup` → `F_session_review`.

### Dữ liệu & service — `src/lib/review.ts`
`SessionReview`: `satisfactionScore` (1–5, hài lòng chung) · `technicianScore` (1–5, chấm KTV) ·
`technicianName` · `comment` (nhận xét khách) · `wouldReturn` · `technicianReport` (báo cáo KTV, nội bộ) ·
`reviewedBy`. **1 đánh giá / buổi (upsert)**. `reviewSummary()` → điểm hài lòng/KTV TB, tỷ lệ quay lại, điểm
theo từng KTV (mục 37). `beforeAfterGroups(filter)` → gom `MediaAsset` kind BEFORE_IMAGE/AFTER_IMAGE **theo
buổi** (kèm khách/dịch vụ/KTV/ngày), lọc theo khách/dịch vụ/khoảng ngày (mục 8).

### API
`/api/session-reviews` (GET `?sessionId` trả 1 bản / `?customerId` trả list; POST upsert cần `treatment.write`)
· `/api/session-reviews/summary` (tổng hợp đánh giá) · `/api/before-after` (nhóm ảnh trước–sau, lọc; cần
`customer.read`). Ảnh phục vụ qua `/api/media/[id]` (đã có, kiểm quyền).

### UI
- **Ghi nhận buổi** (`/treatment-plans/[id]`) thêm mục **"Đánh giá & báo cáo sau buổi"**
  (`components/session-review.tsx`): sao hài lòng + sao KTV + tên KTV + nhận xét + "sẽ quay lại" + **báo cáo
  KTV**; lưu độc lập (upsert).
- Sidebar **Spa & CRM → Before/After & Đánh giá** (`/before-after`): thẻ tổng hợp (số đánh giá, hài lòng TB,
  điểm KTV TB, tỷ lệ quay lại) + **đánh giá theo KTV** + **bộ lọc** (khách/dịch vụ/ngày) + lưới **cặp
  Trước–Sau theo buổi** (bấm ảnh phóng to so sánh).
- **Timeline khách** ghi điểm đánh giá vào sự kiện buổi ("Đánh giá: hài lòng 5/5, KTV 5/5").

### RBAC
Đọc đánh giá/summary = `treatment.read`; ghi = `treatment.write`. Xem Before/After = `customer.read` (ảnh vẫn
qua route kiểm quyền, không public). Báo cáo KTV là nội bộ (không lộ qua Cổng khách).

### Demo
Buổi RF #1 (KH-100004): đánh giá hài lòng 5/5, KTV 5/5, "sẽ quay lại", báo cáo KTV; kèm 2 ảnh Before/After đã
seed (đã chia sẻ cho khách). Trang `/before-after` hiển thị cặp ảnh + tổng hợp điểm.

### Nghiệm thu Mục 10 (v0.19.0) — KPI khớp bộ lọc gallery + bằng chứng A–L
- **Fix VII.F (filter consistency):** `reviewSummary(filter)` nhận CÙNG bộ lọc với gallery
  (khách/dịch vụ/khoảng ngày, lọc dịch vụ/ngày qua quan hệ `session.performedAt`); `/api/session-reviews/
  summary` đọc `customerId/serviceId/from/to`; trang `/before-after` nạp KPI + gallery bằng cùng query →
  KPI KHÔNG còn global khi lưới ảnh đã lọc. (Trước đó KPI luôn toàn cục — đã sửa.)
- **Đồng bộ trạng thái instance** không liên quan (đây là Mục 10). Lineage giữ nguyên: ảnh Before/After →
  `MediaAsset.sessionId` → `TreatmentSession`(customerId/serviceId/planId/stageId/bookingId/performer).
  KTV hiển thị = `session.performer` (snapshot buổi); điểm KTV theo `SessionReview.technicianName` (snapshot).
- **Privacy (đã có từ SEC, tái xác nhận):** ảnh mới `sharedWithCustomer=false` mặc định; portal chỉ trả ảnh
  của chính khách + đã chia sẻ + chưa archive (else 404, chống lộ chéo); tắt chia sẻ → portal 404, nội bộ giữ.
- **Tỷ lệ quay lại — công thức rõ:** `#review(wouldReturn=true) / #review(wouldReturn≠null) × 100` — là **ý
  định quay lại** từ đánh giá, KHÔNG phải lượt tái khám thực tế (nếu sau này cần "khách quay lại thực tế" =
  #khách≥2 buổi / #khách có buổi thì phải định nghĩa riêng — hiện ngoài phạm vi).
- **Test:** `test/before-after.test.ts` (5) — lineage, filter, privacy default/toggle/portal/cross-customer,
  RBAC (403/401), KPI đúng DB + isolation ≥2 KTV + filter-consistency. **229 test pass** (không regression).
- **Nợ:** demo chỉ có 1 KTV được đánh giá (cô lập ≥2 KTV chứng minh ở test); slider so sánh & khách tự đánh
  giá qua portal vẫn để phase sau.

### Nghiệm thu Mục 11 (Dịch vụ & Thư viện Spa) — master data dùng xuyên hệ thống
- **KHÔNG đổi code nghiệp vụ** — các thư viện (Service/Brand/Technology/Protocol/SpaProduct/FormTemplate/
  CareInstruction) đã đủ: danh sách + chi tiết + tạo/sửa theo quyền + trạng thái active/inactive + **soft-delete
  mọi DELETE** (không hard-delete → không orphan). RBAC enforce backend từng route (LIBRARY_READ đọc; BRAND_/
  TECHNOLOGY_/PROTOCOL_/CATALOG_/FORM_/CARE_WRITE ghi).
- **Bất biến lịch sử:** FormInstance `schemaSnapshot`+`templateVersion`; CareInstance snapshot content+
  `templateVersion`; Protocol `bumpVersion` append-only (`changeLog`). Session cũ giữ `serviceId/technologyId/
  brandProtocolId/versionAtExecution` — sửa master KHÔNG rewrite.
- **Một master, không duplicate:** demo có đúng 5 dịch vụ (RF `DV-RF-01` được **13 booking + 7 session** tham
  chiếu cùng serviceId); SpaProduct phân loại bằng **field `productType`** (PROFESSIONAL/HOME_CARE), không theo
  tên (Klapp có cả 2 loại trên cùng brand). Technology dùng xuyên service.technologyIds + employee competence +
  session.technologyId. Dropdown master lọc **active-only**.
- **Test:** `test/library.test.ts` (8) — RBAC 403/401, soft-delete integrity + active-only, snapshot Form/Care/
  Protocol, quan hệ Brand→Product + Technology cross-use. **237 test pass** (không regression).
- **Nợ:** mẫu Hướng dẫn chăm sóc demo chưa gắn `serviceId` (general POST_CARE) → gợi ý theo dịch vụ trả rỗng
  ("chưa có mẫu phù hợp"); matching logic đúng (test chứng minh với template có serviceId).

## Import khách hàng (mục 41) — MySpa/CSV: preview → mapping → validate → trùng → báo cáo

Phase sau MASTER PROMPT, ưu tiên #6 (mục cuối lộ trình). **Đã xác thực PostgreSQL 16 thật**: tsc sạch · lint
0 lỗi · build OK · **92 test pass** (thêm `test/import-customers.test.ts`, 4 test). **KHÔNG có migration mới** —
dùng nền `Customer.legacyId`/`legacySource` (`@@index([legacyId])`) đã đặt từ phase Hóa đơn. Tổng vẫn **16
migration**.

### Kiến trúc — tổng quát, KHÔNG đoán schema nguồn
Phía UI map cột nguồn → trường chuẩn rồi gửi các dòng đã map; server không phụ thuộc cột MySpa cụ thể.
`src/lib/import-customers.ts`:
- `analyzeImportRows(rows, legacySource)` (**dry-run**): validate từng dòng (bắt buộc họ tên; email regex;
  ngày sinh `dd/MM/yyyy`|`yyyy-MM-dd`; giới tính "Nam/Nữ/Male/Female" → MALE/FEMALE/OTHER) → **phát hiện
  trùng** với khách đã có (theo **SĐT**, hoặc **legacyId + legacySource**) và **trùng trong lô**. Trả
  `{index, status: NEW|DUPLICATE|ERROR, errors, matchedBy, normalized}`.
- `commitImport(rows, legacySource)`: **chỉ tạo dòng NEW** (bỏ qua trùng & lỗi), sinh mã KH tuần tự an toàn
  trong transaction (base = count, +i), gán `legacyId`+`legacySource`. Trả **báo cáo**
  `{total, created, skippedDuplicate, errorRows, createdCodes}`. **Không ghi đè khách đã có.**

### API
`POST /api/imports/customers/preview` (phân tích dry-run) · `POST /api/imports/customers/commit` (ghi + báo
cáo). Cả hai cần `customer.write`. Giới hạn 5000 dòng/lần.

### UI — `/import-customers` (Hệ thống → Nhập khách hàng)
4 bước: **(1)** dán CSV hoặc tải `.csv` (parser tự viết, hỗ trợ ngoặc kép/phẩy trong ô) + nút **Dùng mẫu**;
**(2)** **ghép cột** nguồn → 10 trường chuẩn (**auto-map** theo tên cột VN/EN) + nhập `legacySource` (mặc
định MySpa); **(3)** **Kiểm tra & xem trước**: bảng từng dòng + trạng thái (Thêm mới/Trùng/Lỗi) + lý do +
số đếm; **(4)** **Nhập** → báo cáo (đã tạo/bỏ qua trùng/lỗi + danh sách mã KH). Cảnh báo rõ: khách trùng
KHÔNG bị ghi đè.

### Nâng cấp Mục 12 (v0.20.0) — normalize · dup ưu tiên · update-merge · ImportBatch · audit
Migration **`Q_import_batch`** (additive, 0 DROP; tổng **27 migration**). **241 test pass** (import-customers 7
+ import-http 1, thay cho 4 test cũ).
- **Chuẩn hóa (`import-customers.ts`):** `normalizePhone` (+84/0084/84→0, bỏ khoảng trắng/dấu chấm/gạch —
  KHÔNG bịa số); `normalizeEmail` (trim+lowercase). Ngày sinh mơ hồ/sai → ERROR (không đảo ngày/tháng).
- **Duplicate ưu tiên rõ:** externalId(`legacyId`+`legacySource`) → **phone chuẩn hóa** → **email chuẩn hóa**
  → trùng trong lô. **KHÔNG merge theo tên đơn thuần** (trùng tên khác key → tạo mới). Trả `matchedCustomerId`.
- **Chiến lược trùng (`strategy`):** `skip` (mặc định — không đổi khách cũ) | `update` (**merge "chỉ điền
  field đang trống"**: KHÔNG ghi đè dữ liệu đang có; audit `CUSTOMER_IMPORT_UPDATED` `source=IMPORT`+`batchCode`
  + diff từng field cũ→mới).
- **Lưu vết:** model **`ImportBatch`** (IMP-xxxxxx): source/filename/strategy/mapping snapshot/total/created/
  updated/skipped/errorRows/createdCodes/updatedCodes/**errors[{index,reason,data}]**/importedBy. Báo cáo trả
  `batchCode`+`errors[]` (tải CSV lỗi ở UI). Audit `CUSTOMERS_IMPORTED` gắn `entityId=batchId`.
- **Preview** thêm `willCreate/willUpdate/willSkip` (khớp chiến lược). **Idempotency:** import lại cùng file →
  created 0 (dedup theo externalId/phone/email nhất quán).
- **UI:** thêm dropdown **Xử lý dòng trùng** (Bỏ qua | Cập nhật), badge Sẽ tạo/Sẽ cập nhật/Sẽ bỏ qua, mã lô
  + danh sách lỗi + **tải CSV lỗi**. RBAC: `customer.write` (test HTTP 401/403/200).
- **Nợ:** import lịch sử giao dịch/phác đồ/ảnh vẫn phase sau; `.xlsx` trực tiếp chưa (hiện CSV); merge rule
  hiện chỉ "điền chỗ trống" (chưa có chế độ ghi đè có xác nhận).

## Quản trị người dùng (Admin) — tài khoản đăng nhập + gán vai trò

Module quản trị tài khoản đăng nhập (khác **Nhân sự** — Nhân sự là danh mục nhân viên; đây là tài khoản
User + Role để đăng nhập & phân quyền). **Không có migration mới** (dùng `User`/`Role`/`UserRole` sẵn có).
Xác thực: tsc sạch · lint 0 lỗi · build OK · **95 test pass** (thêm `test/users.test.ts`, 3 test).

### RBAC
Dùng quyền `user.manage` **đã có sẵn** (chỉ `ADMIN` có, qua `ALL_PERMISSIONS`). Mọi route/trang gated bằng
`requirePermission(USER_MANAGE)`; trang UI báo "chỉ Admin" nếu thiếu quyền; mục sidebar **ẩn** với vai trò
không có quyền (lọc theo `session.permissions` trong `app-shell`).

### API
`/api/users` (GET list — **KHÔNG trả passwordHash**; POST tạo: email unique, băm mật khẩu bcrypt, gán vai
trò theo `roleCodes` hợp lệ) · `/api/users/[id]` (GET; PATCH đổi tên/vai trò [thay toàn bộ user_roles]/
đặt lại mật khẩu/khóa-mở; **chặn tự khóa chính mình**). Validation: `userCreateSchema`/`userUpdateSchema`.

### UI — `/users` (Hệ thống → Quản trị người dùng)
Danh sách (tên/email/**vai trò chip**/ngày tạo/trạng thái) + **Thêm/Sửa/Xóa** (email, họ tên, mật khẩu/đặt lại,
chọn **nhiều vai trò** ADMIN/BOD/MANAGER/RECEPTION/CUSTOMER_CARE/SPECIALIST/CASHIER/MARKETING, khóa/mở).
`DELETE /api/users/[id]` — **chặn tự xóa mình + xóa Admin cuối cùng**; `audit_logs.userId` là quan hệ tùy chọn
→ tự set null khi xóa (không lỗi FK). Bump **v0.9.1**.

### FIX QUYỀN — quyền lấy từ MÃ NGUỒN (không cần seed lại)
**Vấn đề:** login trước đây suy quyền từ **RolePermission trong DB**; sau khi cập nhật code (thêm quyền mới như
`hr.write`, `pricefloor.*`, `followup.write`) mà chưa `db:seed` lại thì DB thiếu quyền → dù là Admin cũng KHÔNG
thấy nút (vd "Thêm nhân sự"). **Sửa:** `api/auth/login` nay lấy quyền từ `ROLE_PERMISSIONS[roleCode]` (mã nguồn =
nguồn sự thật), fallback DB cho vai trò lạ → cập nhật code là có quyền ngay **sau khi đăng nhập lại** (không cần
seed). Người dùng đang đăng nhập cần **đăng xuất & đăng nhập lại** để nhận quyền mới (JWT nạp lúc login).

### FIX QUYỀN v2 — tính quyền lại ở MỖI request (v0.9.2, KHÔNG cần đăng nhập lại)
`getSession()` (`src/lib/session.ts`) nay **suy quyền lại từ `session.roles` qua `ROLE_PERMISSIONS`** ở mỗi
request (hợp nhất với quyền trong token cho vai trò lạ). Token cũ vẫn giữ `roles` đúng → quyền luôn khớp mã
nguồn ngay, **không cần đăng xuất/đăng nhập lại**. Áp cho cả server (`requirePermission`) lẫn client
(`useCan` qua layout `getSession()` + `/api/auth/me`).

### Nghiệm thu Mục 14 (Quản trị người dùng) — bất biến "Admin cuối" + audit before/after
Nghiệm thu tài khoản đăng nhập (khác **Nhân sự/Employee** — hai thực thể tách biệt, không merge). **KHÔNG
migration** (dùng `User`/`Role`/`UserRole` sẵn có; 0 DROP). Chỉ sửa **additive** ở `api/users/[id]` PATCH.
- **Vá lỗ bypass "Admin cuối" qua PATCH:** trước đây chỉ DELETE chặn xóa admin active cuối; PATCH vẫn cho
  **(a) gỡ vai trò ADMIN** hoặc **(b) khóa `isActive=false`** admin cuối → mất quyền quản trị. Nay PATCH tính
  `willRemainActiveAdmin`; nếu thao tác làm admin active cuối không còn là admin-active và `otherActiveAdmins==0`
  → **409**. DELETE giữ nguyên guard cũ. Self-guard giữ nguyên (không tự xóa/khóa chính mình → 409).
- **Audit giàu hơn:** `USER_UPDATED` ghi `changes` before/after cho `isActive` và `roles` (mảng code sắp xếp) +
  cờ `resetPassword` (KHÔNG log mật khẩu/hash). `USER_CREATED`/`USER_DELETED` giữ actor `userId`+target `entityId`.
- **Bằng chứng (test `test/users.test.ts`, 12 test HTTP thật trên Postgres):** A không lộ passwordHash · B/L RBAC
  401/403/200 · C bcrypt + trùng 409 · D đa vai trò + loại role rác · E đổi role → quyền hiệu lực (login lại) ·
  F reset pw (cũ fail/mới ok/không lộ hash) · G/H khóa-mở ảnh hưởng login · I hard delete + audit userId→null ·
  J self-guard · **K** DELETE admin cuối (actor super-role user.manage KHÔNG phải ADMIN → tránh vướng self) ·
  **K2** PATCH gỡ-role/khóa admin cuối→409, có 2 admin thì cho phép · M audit before/after không rò rỉ. Login
  route (`api/auth/login`) từ chối `!user.isActive` (chứng minh G/H). **255 test pass** (baseline 248 + 7).

### Nghiệm thu Mục 15 (Phân quyền theo vai trò / RBAC toàn hệ thống) — enforce BACKEND, không dựa ẩn menu
Xác thực RBAC toàn hệ thống trên **7 vai trò** (ADMIN/MANAGER/RECEPTION/CUSTOMER_CARE/SPECIALIST/CASHIER/
MARKETING). **KHÔNG sửa business rule/schema/RBAC** — baseline (`src/lib/rbac.ts`) đã đúng; chỉ **THÊM**
`test/rbac-matrix.test.ts` (15 test HTTP thật) để chứng minh. **0 migration · 0 DROP · 0 thay đổi mã nguồn
nghiệp vụ.**
- **Enforce ở server (không ẩn menu):** audit 164 route API — 6 route không guard đúng là whitelist hợp lệ
  (auth login/logout/me, storage/blob [signed token], portal login/logout); còn lại đều `require*`. Financial
  privacy qua `maskFinance`/`canSeeFinance` ở SERVER (đặt field=null), 21 route tài chính áp mask.
- **Bằng chứng A–P (test HTTP thật + live 7 vai trò + SQL):** A persistence (session.permissions suy từ
  `ROLE_PERMISSIONS`) · B anonymous→401 · C Admin toàn quyền + `/users` 200 · D Quản lý nghiệp vụ+tài chính,
  KHÔNG tự nhận user.manage (→403) · E Lễ tân khách/booking/thu tiền, treatment.write+user.manage→403, giá
  vốn=null · F CSKH CRM/task, price-floors→403, giá vốn/SP.cost/fee/dashboard.cost+profit=null · G Chuyên
  viên treatment, finance/user DENY · H Thu ngân thanh toán/giá sàn+tài chính, user/protocol DENY · I
  Marketing chiến dịch, treatment/payment/user DENY (MARKETING có finance.read cho ROI) · J **financial
  privacy kiểm JSON trực tiếp** (non-finance null, finance có giá trị) · K direct-API-attack (role thấp→route
  cao→403/redacted) · L multi-role **UNION** quyền (SPECIALIST+CASHIER) + role rác→0 quyền · M đổi vai trò →
  **đăng nhập lại** phản ánh quyền mới · N UI (Admin có thẻ Chi phí/Lợi nhuận, CSKH không) · O audit
  USER_UPDATED before/after + LOGIN, không log secret · P regression.
- **Ghi chú baseline (KHÔNG phải lỗi — không tự đổi):** (1) mọi vai trò spa chia sẻ `CLINIC_READ` → đọc rộng,
  khác biệt ở **WRITE + field tài chính**; (2) RECEPTION có `pricefloor.read` = chỉ thấy **NGƯỠNG** giá sàn
  (`floorPrice`), còn cost breakdown/biên vẫn mask theo `finance.read` (baseline Mục 7); (3) MARKETING có
  `finance.read` phục vụ ROI (baseline Mục 10). Menu có thể hiện module read-only nhưng **backend chặn** (403)
  khi thiếu quyền → quyết định bằng server, không bằng UI.
- **Regression:** baseline 255/34 → **270 test / 35 file** (+15 rbac-matrix, +1 file); Mục 2–14 xanh; tsc 0
  lỗi; next build OK.

#### Bổ sung Mục 15 — DOANH THU (revenue KPI) = dữ liệu tài chính (quyết định chính thức)
Theo quyết định nghiệm thu: **KPI/dữ liệu doanh thu là dữ liệu tài chính**, chỉ user có `finance.read` mới
được xem — **permission-based, KHÔNG hard-code theo tên role**.
- **Nguyên nhân trước đây:** `GET /api/clinic/dashboard` trả `revenue` + `revenueSeries` **vô điều kiện** (chỉ
  `cost/profit` gated theo `finance.read`) → mọi role có `booking.read` (gồm CSKH/Chuyên viên/Lễ tân) đều nhận
  số doanh thu.
- **Đã vá (additive, 0 migration):** `src/app/api/clinic/dashboard/route.ts` — `revenue: canFinance ? … : null`
  và `revenueSeries: canFinance ? … : null` (redact ở SERVER, cùng cơ chế cost/profit). `src/app/(app)/crm/
  page.tsx` — thẻ **Doanh thu** + biểu đồ 6 tháng chỉ render khi `canSeeFinance` (không để giá trị thật trong
  HTML rồi ẩn bằng CSS).
- **Mapping thực tế (revenue theo `finance.read`):** ✅ Admin, Quản lý, Thu ngân, **Marketing** (có
  `finance.read` phục vụ ROI — theo permission, không hard-code) · ❌ Lễ tân, CSKH, Chuyên viên (revenue=null).
- **Test:** `test/rbac-matrix.test.ts` thêm **J2** — non-finance (CSKH/Chuyên viên/Lễ tân) revenue+revenueSeries
  =null; finance (Quản lý/Thu ngân/Marketing) = 3.500.000; cost/profit/floorPrice/staffFee giữ nguyên privacy.
  **271 test / 35 file** (270 + 1). Live before/after + ảnh CSKH (không thẻ Doanh thu) vs Quản lý (có).

#### Bổ sung Mục 15 (N) — Sidebar/menu render theo PERMISSION (permission-based, không tên role)
Lỗi UI-RBAC: sidebar trước đây render **mọi menu** cho mọi phiên (chỉ `/users` có gate) → CSKH vẫn thấy
Hóa đơn/Thanh toán/Bảng giá/Giá sàn/Marketing dù không có quyền. Backend đã chặn 403/redact (source of truth),
nhưng menu gây hiểu nhầm. **KHÔNG sửa backend/permission matrix.**
- **`src/lib/nav.ts` (mới):** cấu hình nav + `canSeeNavItem`/`visibleNavGroups(permissions)`. Mỗi mục gắn
  `perm` = permission code (hoặc **mảng any-of**) mà module CẦN. Nhóm rỗng bị loại. `app-shell.tsx` gọi
  `visibleNavGroups(session.permissions)` (không tự lọc, không map theo tên role).
- **Mapping menu→permission (permission-based):** Hóa đơn=`invoice.write` · Thanh toán=`payment.write` ·
  Bảng giá=`price.write` · Giá sàn=`[pricefloor.read, finance.read]` · Marketing=`marketing.read` ·
  Chăm sóc=`[followup.apply, followup.write, task.write]` · Công việc=`task.write` · Quản trị user=`user.manage` ·
  Cài đặt=`setting.write` · Nhân sự=`staff.read` · Nhập khách=`customer.write` · Thư viện=`library.read` ·
  Vật tư=`customer.read` · cụm Kho THNG=warehouse perms (vai trò spa không có → ẩn cả cụm). Khách/Lịch hẹn/
  Dịch vụ/Phác đồ/Báo giá/Hình ảnh = read tương ứng (đọc chung — mọi vai trò spa giữ).
- **Kết quả:** CSKH ẩn Hóa đơn/Thanh toán/Bảng giá/Giá sàn/Marketing/Quản trị user/Cài đặt; Thu ngân hiện
  Hóa đơn/Thanh toán/Bảng giá/Giá sàn; Marketing hiện Marketing+Giá sàn (finance.read/ROI); Admin hiện Quản trị
  user; mọi vai trò spa ẩn cụm Kho THNG.
- **Test:** `test/nav-rbac.test.ts` (10 test, unit trên `ROLE_PERMISSIONS` — nguồn sự thật). Backend guard vẫn
  giữ 401/403/redaction (rbac-matrix). **281 test / 36 file** (271 + 10). tsc + build sạch. Ảnh 6 vai trò.
- **Ghi chú:** menu đọc-chung (Nhân sự `staff.read`, Nhập khách `customer.write`, Thư viện `library.read`,
  Vật tư `customer.read`) vẫn hiện cho vai trò có quyền đọc — đúng nguyên tắc "có quyền đọc → có thể giữ";
  dữ liệu tài chính trong các trang này vẫn mask ở server.

#### CHỐT Mục 15 = PASS TOÀN BỘ (A–P + J2 + N)
Xác minh cuối bằng session thật + DB `role_permissions` + direct API (không sửa code):
- **N (UI visibility):** ảnh sidebar Thu ngân = `CASHIER`/Đỗ Thu Ngân (session thật); menu khớp `ROLE_PERMISSIONS`
  (hiện Hóa đơn/Thanh toán/Bảng giá/Giá sàn; ẩn Marketing/Chăm sóc/Công việc/Nhập khách/Quản trị user). Menu
  "Nhân sự" hợp lệ: `staff.read` có trong **DB `role_permissions` (`CASHIER|staff.read`)** + session; backend
  `GET /api/employees` = 200. Direct API khớp matrix: price-floors/invoices 200, payment gate 422,
  user/marketing/treatment 403. Menu ẩn ⇔ API cũng chặn.
- **A–M, O–P + financial privacy + regression:** giữ PASS (271→281 test / 36 file; tsc + build sạch;
  0 migration, 0 DROP). Quyết định doanh thu = dữ liệu tài chính (J2) đã áp dụng.
- **Chốt:** Mục 15 nghiệm thu **PASS toàn bộ** tại commit nav permission-based (branch
  `claude/customer-treatment-management-system-ozcn03`). Backend RBAC là source of truth; UI phản ánh permission,
  không hard-code tên role; không sửa business rule/schema/permission matrix Mục 2–14.

### Nghiệm thu Mục 16 (Cập nhật phần mềm KHÔNG mất dữ liệu) — PASS toàn bộ A–P
Kiểm tra **update/upgrade path** (không thêm feature). Baseline Mục 2–15 bất biến; **KHÔNG sửa code**
(script update + migration đã an toàn) → working tree sạch, không commit code. Trên Linux không chạy `.bat`
trực tiếp → **equivalent execution** trên **DB copy** (`thng_upd`), KHÔNG đụng source `thng_warehouse`.
- **Script (`windows/`):** `update-windows.bat` = dừng cổng 9500 → `git pull` → `npm install` → `prisma
  migrate deploy` → `next build` (có `|| goto :err` + `exit /b 1`; **KHÔNG** `db:seed`/DROP/reset/.env overwrite).
  `start-windows.bat` = `npm run start:lan` (không DB command). `setup-windows.bat` có `db:seed` nhưng là **cài
  lần đầu**, KHÔNG thuộc update flow.
- **Backup/restore (B/P):** `pg_dump` exit 0 (298 KB > 0); restore vào DB temp `thng_upd` exit 0, 0 error,
  counts khớp source → backup usable.
- **Migration (E):** 27 migration additive — DROP TABLE/COLUMN=0, TRUNCATE=0, DELETE=0, SET NOT NULL=0,
  DROP CONSTRAINT=0. `migrate deploy` = "No pending migrations" (idempotent, chạy 2 lần no-op).
- **.env (D):** `sha256(.env)` before == after; key set không đổi; update không ghi đè.
- **Data preservation (I/J):** 21/21 bảng count before==after; sentinel `KH-000001`/`HD-000001` 11.9tr
  PARTIAL/`PT-000001` 5tr TRANSFER/`NV-000001`/brand giữ nguyên; **md5 customers không đổi** (`2cff14e3…`);
  source DB không bị đụng (md5 giữ nguyên — chỉ pg_dump đọc).
- **RBAC Mục 15 sau update (K):** CSKH revenue/cost/profit=null + price-floors/users 403; Thu ngân
  revenue=3.5tr + price-floors 200 + users 403; Quản lý users 403. Financial privacy + sidebar permission-based
  **không regression**.
- **Version (L):** `package.json` 0.20.0 == `APP_VERSION` (single-source); sidebar + Cài đặt cùng `versionLabel()`.
- **Regression (N):** **281 test / 36 file PASS**; tsc 0 lỗi; build OK; health check 10 route = 200/401 đúng.
- **Chốt:** Mục 16 **PASS toàn bộ A–P**; 0 migration mới, 0 DROP; không CONFLICT với baseline Mục 15.

## Hồ sơ khách hàng 360° (v0.10.0) — danh sách + hồ sơ trung tâm khách

Tổ chức lại & bổ sung dữ liệu/UX cho **module Khách hàng** (KHÔNG đổi engine Booking/Phác đồ/Giá/Vật tư/
Marketing). **KHÔNG migration mới** (dùng model sẵn có). Xác thực: tsc sạch · lint 0 lỗi · build OK ·
**101 test pass** (thêm `test/customer360.test.ts`, 4 test).

### Backend
- `src/lib/utils.ts`: `computeAge(dob, now?)` — tính tuổi tròn (tất định qua tham số `now` để test).
- `src/lib/clinic.ts`: `customerSummary(customerId)` → KPI hồ sơ (tổng buổi hoàn thành, tổng booking, **booking
  tiếp theo**, **follow-up tiếp theo**, việc CSKH đang chờ, **phác đồ đang chạy** + tiến độ buổi + buổi kế,
  **lần thực hiện / KTV / dịch vụ / đánh giá gần nhất**). Suy từ dữ liệu hiện có, thiếu → `null` (UI không lỗi).
- `GET /api/customers`: bộ lọc kết hợp (AND) — `q` (tên/mã/SĐT/email), `source`, `assignedTo`, `serviceId`
  (booking/session), `technician` (booking.technician / session.performer / session.staff), `plan` (tên),
  `status` (active/inactive/all), `from`/`to` (ngày tạo). Trả thêm dob/gender/group/isActive.
- `GET /api/customers/facets`: nguồn/nhân viên/KTV/dịch vụ distinct cho dropdown lọc.
- `GET /api/customers/[id]`: thêm `sessions` (service/plan/staff/review), `proposals` (+`_count.options`),
  `summary`. Payment kèm `invoice.code`. (`customer-materials` GET thêm `planName`, `lastUsedAt`.)

### UI — Danh sách (`/customers`)
Cột: Mã · Họ tên · Giới tính · **Ngày sinh · Tuổi** (tính từ dob) · Điện thoại · Nguồn · Phụ trách · Ngày tạo ·
Trạng thái. Ô tìm nhanh + panel **Bộ lọc** (nguồn/phụ trách/KTV/dịch vụ/phác đồ/trạng thái/khoảng ngày) +
Áp dụng/Xóa lọc. Bảng cuộn ngang khi hẹp.

### UI — Hồ sơ 360° (`/customers/[id]`)
- **Header**: tên, mã, ngày sinh + tuổi, giới tính, SĐT, email, nguồn, phụ trách (+ badge nhóm/lưu trữ/nguồn cũ).
- **Hàng KPI** (8 thẻ): tổng lần thực hiện, tổng giá trị, đã thanh toán, công nợ, booking tiếp theo, follow-up
  tiếp theo, phác đồ đang thực hiện, KTV gần nhất.
- **Quick actions**: Tạo Booking (modal, POST `/api/bookings`, xử lý cảnh báo trùng lịch/giá sàn → "vẫn đặt") ·
  Nhật ký CSKH · Báo giá (→ `/proposals?customerId=&new=1` mở sẵn form) · Follow-up (modal → Task). Menu
  **"Thêm thao tác"**: Đánh giá · Đề xuất sản phẩm · Gửi hướng dẫn · Thêm Before/After (→ trang phác đồ đang
  chạy) · Áp biểu mẫu · Ghi nhận thanh toán · Cấp tài khoản Cổng khách.
- **11 tab đúng thứ tự**: Tổng quan · Timeline · Booking & Lần thực hiện · Phác đồ · Đánh giá & Before/After ·
  Sản phẩm đề xuất · Vật tư khách hàng · Chăm sóc khách hàng · Báo giá · Hóa đơn & Thanh toán · Biểu mẫu & Tài
  liệu. Có **tab con**: Visits (Booking | Lần thực hiện), Đánh giá (Đánh giá | Before/After), Chăm sóc (Nhật ký |
  Follow-up | Hướng dẫn), Hóa đơn (Hóa đơn | Thanh toán).
- **Tổng quan** = dashboard mini 6 panel (Thông tin hiện tại / Hành động tiếp theo / Lịch sử gần nhất / Tài chính
  / Before/After gần nhất [thumbnail] / Sản phẩm đề xuất gần nhất).
- **Timeline** có lọc: từ/đến ngày, loại sự kiện, từ khóa (dịch vụ/KTV/phác đồ). **Before/After** lọc theo dịch
  vụ/ngày + lightbox phóng to. **Tải lười theo tab** (materials/forms/care/invoices) → không query toàn bộ 1 lúc.
- **RBAC giữ nguyên**: nút quick-action ẩn theo `useCan(*.write)`; media qua route kiểm quyền (không public);
  chi phí/giá vốn vẫn mask theo `finance.read` ở tầng server.

### Demo (seed:demo) — KH-100004 (Đỗ Thùy Linh) đủ mọi tab
Có dob/nguồn/phụ trách/phác đồ/booking (quá khứ COMPLETED + **sắp tới CONFIRMED**)/session + KTV + review/
Before-After/đề xuất SP/**vật tư khách hàng**/nhật ký CSKH/**follow-up task**/**hướng dẫn đã gửi**/**biểu mẫu áp
sẵn**/báo giá đã chốt/hóa đơn HD-000001 (trả một phần)/thanh toán.

## Lịch hẹn nâng cao (v0.11.0) — vận hành: thời lượng, xung đột, override, đổi/hủy, phác đồ, công suất

Nâng cấp **module Booking/Lịch hẹn** thành công cụ vận hành (KHÔNG đụng engine khác). Migration
**`G_booking_enhance`** (additive, 0 DROP; tổng **17 migration**). **116 test pass** (thêm
`test/booking-http.test.ts` 10 + mở rộng `test/booking.test.ts` → 11).

### Migration & schema
`bookings` thêm (soft ref, không rebuild phác đồ): `planId/stageId/sessionNumber`, `assistants String[]`,
`createdBy`, mốc vòng đời `confirmedAt/checkedInAt/startedAt/completedAt`, hủy `cancelReason/cancelledBy/
cancelledAt`, không đến `noShowReason/noShowBy/noShowAt`, `rescheduleHistory Json` (lịch sử đổi lịch),
`overrideLog Json` (đặt đè trùng lịch).

### Backend
- **RBAC:** thêm `booking.override` (MANAGER/BOD/ADMIN). RECEPTION có `booking.write` nhưng KHÔNG override
  → chỉ được đổi giờ/tài nguyên, không đặt đè.
- **`src/lib/booking.ts`:** `detectBookingConflicts` (đã có, theo khoảng [start,end) + từng tài nguyên KTV/
  master/phòng/giường/máy) + **`suggestAlternativeSlots`** (quét cửa sổ 8h–20h, bước 30′, tối đa vài ngày,
  in-memory; KHÔNG gợi ý nếu KTV/master `isActive=false`) + `logBookingActivity` (ghi Timeline khách).
- **API:** `POST /api/bookings` (tự lấy thời lượng từ dịch vụ; 409 kèm `conflicts`+`suggestions`+`canOverride`;
  đặt đè cần `booking.override` **+ lý do bắt buộc** → ghi `overrideLog`+audit `BOOKING_OVERRIDE`+timeline) ·
  `PATCH /api/bookings/[id]` (sửa + override gating; khóa khi COMPLETED) · `GET /api/bookings/[id]` (kèm tên
  phác đồ/giai đoạn) · `PATCH /api/bookings/[id]/status` (xác nhận/đến/bắt đầu/hoàn thành/**hủy**/**không đến**
  — ghi mốc thời gian + lý do + audit + timeline) · **`POST /api/bookings/[id]/reschedule`** (giữ lịch cũ, ghi
  `rescheduleHistory`, override gating, timeline) · **`GET /api/bookings/suggest-slots`** · `GET /api/bookings`
  lọc server-side thêm `technician/serviceId/room/machine`.

### UI — `/bookings` (Lịch hẹn)
- Việt hóa toàn bộ ("Tạo lịch hẹn", "Chi tiết lịch hẹn"...). 4 chế độ **Danh sách/Ngày/Tuần/Tháng** + Hôm nay/‹/›
  + **Bộ lọc** (dịch vụ/KTV/phòng/máy/trạng thái, server-side). Chip lịch hiển thị **khung giờ bắt đầu–kết thúc**.
- **Form tạo lịch:** chọn dịch vụ → **tự điền thời lượng chuẩn** + hiện **giờ kết thúc dự kiến**; nhân sự hỗ trợ;
  **liên kết phác đồ** (chọn khách → nạp phác đồ → giai đoạn → buổi số); cảnh báo trùng **cụ thể từng tài nguyên**
  + **gợi ý khung giờ** (bấm để chọn) + ô **lý do đặt đè** (chỉ hiện với người có quyền) / khóa với người không quyền.
- **Chi tiết lịch (modal):** Khách/Dịch vụ+Phác đồ+Buổi/Thời gian (giờ bắt đầu–kết thúc, thời lượng)/Nhân sự+Tài
  nguyên/Ghi chú/Lịch sử đổi lịch/Đặt đè. **Quick actions theo trạng thái:** Xác nhận · Khách đã đến · Bắt đầu ·
  Hoàn thành · Đổi lịch · Không đến · Hủy · (COMPLETED) Ghi nhận lần thực hiện · Mở hồ sơ khách.
- **View Ngày** thêm dải **công suất**: Tổng lịch hôm nay / KTV đang bận / KTV còn trống / Máy đang dùng / Phòng
  đang dùng. View Tháng bấm ngày → mở View Ngày.
- **Sidebar:** đổi nhãn Booking→**Lịch hẹn**, Before/After & Đánh giá→**Hình ảnh & Đánh giá**, Brand→**Thương hiệu**,
  CSKH · Follow-up→**Chăm sóc khách hàng** (chỉ nhãn, không đổi route/DB).

### Nguyên tắc & nợ kỹ thuật (Lịch hẹn)
- **Booking ≠ Session:** hoàn thành lịch KHÔNG tự đánh dấu buổi hoàn thành; nút "Ghi nhận lần thực hiện" mở trang
  phác đồ để ghi buổi thực tế (2 record độc lập).
- Timeline khách ghi sự kiện quan trọng (tạo/đổi/hủy/không đến/chuyển trạng thái) qua CrmActivity — KHÔNG đổi cấu
  trúc Hồ sơ khách đã nghiệm thu.
- Danh mục Phòng/Máy/Giường vẫn nhập tay (chưa có bảng tài nguyên riêng); lịch làm việc/nghỉ phép nhân sự chưa có
  (conflict checker đã sẵn cấu trúc để bổ sung; hiện chỉ bỏ qua nhân sự `isActive=false` khi gợi ý slot). Nhãn
  "Booking tiếp theo" trong Hồ sơ khách 360° giữ nguyên (không đổi cấu trúc mục đã nghiệm thu).

### Lịch hẹn — tài nguyên từ danh mục (v0.11.1)
Chỉnh cuối Mục Lịch hẹn: các trường tài nguyên trong form là **Select thực từ danh mục** (không gõ tự do).
Migration **`H_booking_resources`** (`booking_resources` + enum `ResourceType` ROOM/BED/MACHINE, `parentId`
giường→phòng, `isActive`; additive, 0 DROP; **tổng 18 migration**). **119 test pass**.
- **API:** `/api/booking-resources` (GET lọc `type`/`active`; POST tạo — gated `booking.write`) ·
  `/api/booking-resources/[id]` (PATCH sửa/bật-tắt, KHÔNG hard-delete).
- **UI:** component **SearchableSelect** (KTV chính, Master, Phòng, Giường, Máy — tìm kiếm trong danh mục) +
  **MultiSelect** (Nhân sự hỗ trợ, chọn nhiều). Giường **lọc theo phòng** đã chọn (parentId). Nút **"Tài
  nguyên"** mở modal quản lý danh mục (thêm/bật-tắt Phòng/Giường/Máy) → "workflow tạo tài nguyên riêng".
  Booking vẫn lưu **tên** (String) — không đổi cột; danh mục chỉ ràng buộc lựa chọn.
- **Đổi lịch bắt buộc lý do** (server `bookingRescheduleSchema.reason` required + UI khóa nút khi trống).
  Nút **"Ghi nhận lần thực hiện"** hiện khi buổi **Đang thực hiện** hoặc **Hoàn thành** (Booking ≠ Session).
- **Demo:** danh mục Phòng 1–3 / Giường A–B / Máy RF #1–2 · HIFU #1; **8 lịch ngày 2026-08-13** đủ trạng thái
  (Mới/Đã xác nhận/Khách đã đến/Đang thực hiện/Hoàn thành/Hủy/Không đến/đã đổi lịch) để View Ngày & công suất
  có dữ liệu. Test thêm: đổi lịch thiếu lý do → 422; tạo tài nguyên + giường gắn phòng.

## Dịch vụ & Nhóm dịch vụ (v0.12.0) — dữ liệu nền cho Lịch hẹn/Phác đồ

Nâng cấp **module Dịch vụ** thành dữ liệu nền (KHÔNG đụng Khách hàng/Lịch hẹn đã nghiệm thu; không refactor
module khác). Migration **`I_service_config`** (additive, 0 DROP; tổng **19 migration**). **126 test pass**
(thêm `test/service-http.test.ts` 7).

### Schema (I_service_config)
- `service_categories` thêm `description`, `isActive`.
- `services` thêm: `status` (enum **ServiceStatus** ACTIVE/PAUSED/ARCHIVED; `isActive` = status==ACTIVE, giữ
  tương thích lọc cũ), `machineMinutes`, `roomMinutes`, `technologyIds[]`, `protocolIds[]`,
  `defaultTechnologyId`, `defaultProtocolId`, `staffRequirements` (Json `[{role,quantity,required}]`),
  `resourceRequirements` (Json `{room/bed/machine:{required,default}}`), `updatedAt`. Công nghệ/protocol là
  **soft ref** (id) — không rebuild thư viện.
- Model mới `ServiceMaterialStandard` (vật tư định mức: name/quantity/unit/note/required/spaProductId?/
  usageMaterialId?/orderIndex; cascade theo service).

### Backend
- `src/lib/service.ts`: `splitServiceInput` (tách materials + đồng bộ isActive theo status),
  `materialCreateRows`, `enrichServiceDetail` (giải TÊN công nghệ/protocol từ id + tóm tắt giá sàn qua
  `computeFloor`).
- API: `/api/service-categories` (POST **tạo nhanh**, mã tự sinh NDV nếu bỏ trống; +`[id]` PATCH sửa/trạng
  thái) · `/api/services` GET (lọc `q`/`categoryId`/`status`/`technology`; kèm `floorPrice` cho `finance.read`,
  đếm CN/VT) · POST (nested materials, status→isActive) · `/api/services/[id]` GET (chi tiết + tên CN/protocol
  + `floorSummary`) · PATCH (thay toàn bộ materials trong transaction; audit `PRICE_CHANGE`; **KHÔNG đổi
  Booking/Session lịch sử** — mục 20).
- Giá vốn/giá sàn **mask theo `finance.read`**.

### UI — `/services`
- Danh sách: Mã/Tên(+đếm CN·VT)/Nhóm/Thời lượng/Giá chuẩn/**Giá vốn**/**Giá sàn** (2 cột sau chỉ `finance.read`)/
  Trạng thái. Tìm + **Bộ lọc** (nhóm/trạng thái/công nghệ). Bấm dòng → **modal chi tiết** (đủ cấu hình).
- **Form 5 khối** A. Thông tin cơ bản (Mã tự sinh · Tên · Nhóm search-select + **“+ Tạo nhóm mới”** inline →
  tự chọn nhóm vừa tạo · Mô tả · Trạng thái) · B. Thời gian & tài nguyên (thời lượng/thời gian máy/phòng +
  phòng/giường/máy: bắt buộc? + mặc định từ danh mục tài nguyên) · C. Chuyên môn (công nghệ **multi** + mặc
  định · protocol **multi** + mặc định · **nhân sự yêu cầu**: vai trò/số lượng/bắt buộc, thêm dòng) ·
  D. Vật tư định mức (thêm dòng: tên/SL/ĐVT/ghi chú/bắt buộc, gợi ý từ sản phẩm) · E. Giá & chi phí (giá chuẩn·
  giá vốn + **tóm tắt giá sàn** read-only + link **Xem/Thiết lập giá sàn**).
- Component nội bộ `SearchSelect`/`MultiPick` (không đụng component khác).

### Tích hợp (chỉ tối thiểu, không đổi engine khác)
- Lịch hẹn: chọn dịch vụ → tự lấy `durationMinutes` (đã có từ mục 2). Tài nguyên mặc định của dịch vụ là dữ
  liệu chuẩn bị (Booking chưa auto-điền để không ghi đè lựa chọn nhân viên — nợ kỹ thuật ghi rõ).
- Phác đồ/Session: dịch vụ mang sẵn công nghệ/protocol/vật tư định mức để **gợi ý** (không ép; dữ liệu buổi vẫn
  lưu riêng, đổi master không đổi lịch sử — chuẩn bị cho mục 4).

### Demo (seed:demo) — 3 dịch vụ đầy đủ cấu hình
RF nâng cơ mặt (DV-RF-01: RF · KTV bắt buộc · Máy RF #1/Phòng 2 · Gel dẫn RF · giá sàn 1.610.000) · Nâng cơ
HIFU (DV-HIFU-01: HIFU · KTV+Master bắt buộc+Tư vấn tùy chọn · Máy HIFU #1/Phòng 3 · Gel siêu âm) · Facial làm
sạch sâu (DV-FACIAL-01: Chăm sóc da mặt · KTV · KHÔNG bắt buộc máy · mặt nạ + gel rửa). Tất cả gắn protocol
DEMO.

### Nợ kỹ thuật (Dịch vụ)
- Tài nguyên mặc định của dịch vụ **chưa** tự điền vào form Lịch hẹn (tránh ghi đè; để phase sau).
- Chi phí dự kiến hiện là **snapshot ước tính** (giá vốn nhập tay) + giá sàn từ module Giá sàn; chưa tự tổng
  từ vật tư/nhân sự/máy (kiến trúc đã tách sẵn để tính tự động sau).
- Vật tư định mức link `spaProductId`/`usageMaterialId` là **soft ref** (chưa auto trừ tồn — tiêu hao chỉ khi
  ghi buổi, đúng nguyên tắc mục 10).

## Phác đồ 4 lớp (v0.13.0) — Phác đồ → Giai đoạn → Buổi dự kiến → Lần thực hiện

Nâng cấp **module Phác đồ** thể hiện rõ 4 lớp và tách **Kế hoạch (dự kiến) vs Thực tế** — không ghi đè dữ
liệu kế hoạch bằng thực tế. Chỉ đụng module Phác đồ + integration tối thiểu với Lịch hẹn/Lần thực hiện; KHÔNG
sửa Khách hàng/Dịch vụ/Báo giá/Hóa đơn/Giá sàn đã nghiệm thu. Migration **`J_treatment_plan`** (additive, 0
DROP; tổng **20 migration**). **158 test pass** (thêm `test/treatment-plan.test.ts` 16).

### Migration & schema (`J_treatment_plan`)
- Enum: `PlanStatus` +`PENDING_APPROVAL`/`APPROVED`; `SessionStatus` +`SKIPPED`; enum mới `StageStatus`
  (PENDING/IN_PROGRESS/COMPLETED/CANCELLED) + `FrequencyUnit` (DAY/WEEK/MONTH).
- `TreatmentPlan` +`plannedStartDate`/`plannedEndDate`/`designer`/`approver`/`approvedAt`.
- `TreatmentStage` +`status`/`plannedStartDate`/`plannedEndDate`/`plannedSessions`/`frequencyValue`/
  `frequencyUnit`/`note` (giai đoạn có ngày + tần suất + số buổi + tiến độ).
- `TreatmentSession` +`plannedServiceId`/`plannedTechnologyId`/`plannedProtocolId`/`plannedStaff`/`plannedDate`/
  `intervalDays` (KẾ HOẠCH buổi, snapshot không đổi) + `versionAtExecution` (ghim phiên bản lúc thực hiện).
  Cặp planned/actual cũ (`plannedParams`/`actualParams`, `plannedMaterials`/`actualMaterials`,
  `plannedCost`/`actualCost`, `scheduledAt`/`performedAt`) **giữ nguyên**; THỰC TẾ ghi vào `serviceId`/
  `technologyId`/`brandProtocolId`.
- Model mới `TreatmentPlanVersion` (`treatment_plan_versions`): `fromVersion`/`toVersion`/`reason` (bắt buộc)/
  `summary`/`note`/`createdBy` — lịch sử phiên bản, KHÔNG ghi đè (vẫn giữ `changeLog` Json để tương thích).

### Backend
- `src/lib/treatment-plan.ts`: `frequencyLabel`/`frequencyToDays`/`computeStageSessionDates` (tần suất theo
  ngày/tuần/tháng — KHÔNG hard-code tuần); `computePlanProgress` (giai đoạn hiện tại + tiến độ giai đoạn + tiến
  độ toàn phác đồ + buổi tiếp theo — tách rõ, không dùng "1/2 buổi" làm tên); `deriveSessionStatus` (derive
  trạng thái buổi từ Session+Booking: Chưa lên lịch/Đã lên lịch/Khách đã đến/Đang thực hiện/Hoàn thành/Dời
  lịch/Bỏ qua/Hủy); `comparePlannedActual` (bảng Kế hoạch vs Thực tế + đánh dấu khác biệt).
- Validation (`clinic-validation.ts`): mở rộng plan/stage/session; thêm `planVersionCreateSchema` (reason
  required), `stageCreateSchema`/`stageUpdateSchema`, `sessionToBookingSchema`. **Sửa `dateOpt` giữ `undefined`**
  (không gửi field → Prisma bỏ qua) — tránh bug PATCH một phần vô tình xóa cột ngày.
- API: `POST/PATCH /api/treatment-plans` (nhận dates/designer/approver + stage đầy đủ; PATCH tự set
  `approvedAt` khi APPROVED); **`POST /api/treatment-plans/[id]/version`** (lý do bắt buộc → bump version +
  đóng băng `versionAtExecution` cho buổi đã hoàn thành + ghi `TreatmentPlanVersion`); **`/api/treatment-stages`**
  (POST) + **`/api/treatment-stages/[id]`** (PATCH) — thêm/sửa giai đoạn (chưa có trước đây); `treatment-sessions`
  POST/PATCH nhận trường planned + ghim `versionAtExecution` khi COMPLETED. **`/api/bookings` POST nhận
  `sessionId`** (additive) → gắn ngược `TreatmentSession.bookingId` (tạo lịch hẹn từ buổi, không đổi hành vi
  Lịch hẹn khi vắng field).

### UI
- `/treatment-plans` (danh sách): thêm cột **Bắt đầu**/**Phụ trách** + **lọc trạng thái**; form tạo thêm ngày
  bắt đầu/kết thúc/người thiết kế.
- `/treatment-plans/[id]`: tái tổ chức thành **4 tab** — **Tổng quan** (KPI: version/trạng thái/ngày/tổng thời
  gian/giai đoạn hiện tại/tiến độ giai đoạn/tiến độ toàn phác đồ/tổng giá/buổi tiếp theo/người thiết kế·duyệt);
  **Kế hoạch theo giai đoạn** (card mỗi giai đoạn: ngày–tần suất–tiến độ + danh sách buổi với hành động theo
  trạng thái: **Tạo lịch hẹn**/**Ghi nhận**/**Xem kết quả**/**Chi tiết**; thêm/sửa giai đoạn); **Timeline**
  (thanh giai đoạn theo thời gian); **Phiên bản** (V1/V2 + lý do + tóm tắt + người tạo). **Modal chi tiết buổi**
  hiển thị **Kế hoạch vs Thực tế song song** (đánh dấu "khác KH") + liên kết lịch hẹn. **Giữ nguyên** 3 modal
  cũ (Thêm buổi/Ghi nhận buổi/Vật tư) + các widget con (chia sẻ media, tiêu hao vật tư, nhân sự buổi, đánh giá).
- **Tạo lịch hẹn từ buổi** → điều hướng `/bookings?new=1&...&sessionId=` → form Lịch hẹn đã nghiệm thu **prefill**
  khách/dịch vụ/phác đồ/giai đoạn/buổi (banner nhắc) → lưu xong gắn ngược buổi. Bọc `Suspense` cho `useSearchParams`.

### Nguyên tắc & nợ kỹ thuật (Phác đồ)
- **Kế hoạch ≠ Thực tế:** ghi nhận thực tế KHÔNG ghi đè trường planned (Prisma bỏ qua field không gửi). Buổi
  hoàn thành ghim `versionAtExecution` → tạo V2 không kéo buổi lịch sử sang V2 (mục 19).
- **1 buổi ↔ 1 booking** (gắn `bookingId`); đổi lịch giữ liên kết (module Lịch hẹn xử lý). Trạng thái buổi
  **derive** từ Booking/Session (không nhân đôi dữ liệu).
- Chưa: kéo–thả sắp xếp buổi trong tab giai đoạn (bỏ DnD cũ khi gom nhóm — sắp xếp theo `sessionNumber`); "Tổng
  giá dự kiến" nhập tay (chưa tự tổng từ buổi); clone cấu trúc khi tạo V2 làm thủ công (sửa giai đoạn/buổi tại
  chỗ, buổi lịch sử đã đóng băng). Booking prefill là điều hướng + query (không nhúng form Lịch hẹn vào màn phác đồ).

### Chỉnh trước nghiệm thu (4 điểm)
- **Bỏ `(x/y)` sau tên giai đoạn** ở thanh nhanh (đã có ô "Tiến độ giai đoạn" riêng ở Tổng quan).
- **Trạng thái giai đoạn tự suy `deriveStageStatus`**: đủ buổi hoàn thành → **Hoàn thành**; có buổi hoàn thành →
  **Đang thực hiện**; tôn trọng **Hủy** thủ công. UI derive tức thì; session PATCH còn **tự cập nhật** cột
  `stage.status` khi ghi nhận buổi (có test).
- **Cảnh báo/chặn ngày buổi ngoài khoảng giai đoạn** (`isSessionDateInStage`): banner vàng + checkbox "Vẫn lưu
  dù ngoài khoảng" — nút Lưu **khóa** cho tới khi xác nhận.
- **Buổi đã hoàn thành**: action đổi từ "Ghi nhận" → **Xem kết quả** (mở chi tiết) + **Sửa ghi nhận** (theo
  `treatment.write`); modal chi tiết cũng đổi nhãn "Ghi nhận lần thực hiện" → "Sửa ghi nhận".
- **Trạng thái PHÁC ĐỒ không mâu thuẫn buổi** (`PRE_EXECUTION_PLAN_STATUSES`, `isPlanStatusConflicting`):
  ghi nhận buổi khi phác đồ còn Bản nháp/Chờ duyệt/Đã duyệt → **tự nâng lên Đang thực hiện**; **chặn** đưa phác
  đồ về các trạng thái tiền-thực-hiện khi đã có buổi hoàn thành (server trả **409**; UI khóa các option đó
  trong dropdown). Có test.

### Demo (seed:demo) — TP-100001 "Phác đồ trẻ hóa 8 buổi" (Đỗ Thùy Linh), **V2**
4 giai đoạn: Chuẩn bị (2 buổi·7 ngày/lần·20–27/08) · Can thiệp (4 buổi·7 ngày/lần·03–24/09) · Phục hồi (1
buổi·sau 14 ngày·08/10) · Duy trì (1 buổi·sau 1 tháng·08/11). 8 buổi (3 hoàn thành → tiến độ 3/8). **Buổi 3
minh họa Kế hoạch≠Thực tế**: KH RF·Protocol GLOW·5 ml → TT HIFU·Protocol LIFT·7 ml. **Buổi 4** có lịch hẹn
BK-100020 (liên kết Buổi↔Booking). **Phiên bản V1→V2** (lý do "kéo dài phục hồi", buổi hoàn thành ghim V1).

## Ghi nhận lần thực hiện — Session (v0.14.0) — màn 7 khối A–G, hoàn thành/khóa/sửa-có-audit

Nâng cấp **module Session = Lần thực hiện thực tế** (khác Booking, khác Buổi dự kiến). Chỉ đụng Session +
integration tối thiểu (Phác đồ/Lịch hẹn/Vật tư/Before-After/Nhân sự/Hướng dẫn). KHÔNG sửa Khách hàng/Lịch
hẹn/Dịch vụ/Phác đồ đã nghiệm thu (chỉ đổi điều hướng nút ghi-nhận sang màn Session). Migration
**`K_session_execution`** (additive, 0 DROP; tổng **21 migration**). **161 test pass** (thêm `test/session.test.ts` 6).

### Migration & schema (`K_session_execution`)
`TreatmentSession` +`code` (unique, SS-xxxxxx) · B: `prevReaction`/`todayWish`/`contraindications`/`warnings`/
`currentMeds` · C: `actualStartAt`/`actualEndAt`/`treatmentArea` · F: `incident`/`handledAction`/`nextSuggestion`/
`followUpDate` · `editLog` Json (audit sửa sau hoàn thành). Cặp planned/actual + versionAtExecution (mục 4) giữ nguyên.

### RBAC
Thêm `TREATMENT_EDIT_COMPLETED` (`treatment.editCompleted`) — gán MANAGER + BOD; ADMIN auto qua `ALL_PERMISSIONS`.
SPECIALIST có `treatment.write` nhưng KHÔNG có editCompleted → ghi buổi được, KHÔNG sửa buổi đã hoàn thành.

### Backend (`src/app/api/treatment-sessions`)
- POST: **sinh mã** `SS-xxxxxx` (`sequentialCode`).
- PATCH: **validate hoàn thành** (mục 28) — chuyển COMPLETED phải có **dịch vụ thực tế** (`serviceId`), else 422;
  tự đóng `performedAt` + ghim `versionAtExecution`. **Khóa sau hoàn thành** (mục 29) — buổi đã COMPLETED chỉ sửa
  khi có `treatment.editCompleted` (else 403) **+ lý do bắt buộc** (else 422); ghi **diff** (field/before/after) vào
  `editLog` + `auditLog` `SESSION_EDIT_COMPLETED`. Giữ auto cập nhật trạng thái giai đoạn/phác đồ (mục 4).
- GET `[id]`: trả đủ context (plan code/name/version/status, stage, booking, service/technology/brandProtocol
  tên + `steps`/`contraindications` của protocol) cho màn Session; mask `plannedCost`/`actualCost` theo `finance.read`.
- Không thêm endpoint mới cho care/follow-up: dùng sẵn `/api/care-instructions` (lọc `serviceId`), `/api/care-instances`
  (snapshot title+content), `/api/tasks` (tạo việc follow-up). Timeline khách: buổi hoàn thành hiện **"Đã thực hiện [dịch vụ]"** (mục 31).

### UI — màn `/sessions/[id]` (7 khối A–G)
Header: mã Session · khách · trạng thái + nút theo trạng thái (**Bắt đầu thực hiện** → IN_PROGRESS · **Hoàn thành
buổi** → validate · **Sửa ghi nhận** nếu có quyền). **A** Thông tin buổi (khách/dịch vụ dự kiến/phác đồ v.version/
giai đoạn/buổi/booking/ngày/version thực hiện). **B** Trước khi thực hiện (+ **banner đỏ cảnh báo** chống chỉ định/
nguy cơ từ field hoặc từ Protocol; ảnh Before). **C** Thực tế (dịch vụ/CN/protocol thực tế + vùng + thông số thiết
bị + bước [nạp từ Protocol] + giờ bắt đầu/kết thúc + **Biểu mẫu chuyên môn động** gắn FormTemplate snapshot version
+ bảng **Kế hoạch vs Thực tế**). **D** Nhân sự (SessionStaff, phí snapshot, mask tài chính). **E** Vật tư dự kiến +
thực tế (SpaMaterialConsume — trừ tồn khi ghi nhận, KHÔNG trừ ở Booking; nguồn Kho vật tư sử dụng | Vật tư khách
hàng; chặn âm tồn ở server). **F** Sau khi thực hiện (tình trạng/sự cố/xử lý + ảnh After + chia sẻ khách + gợi ý
Hướng dẫn chăm sóc theo dịch vụ + tạo việc follow-up). **G** Đánh giá & Báo cáo (SessionReview — điểm khách + báo cáo
nội bộ KTV). **Chế độ chỉ-xem khi COMPLETED**; "Sửa ghi nhận" bật edit + ô lý do bắt buộc; **Lịch sử chỉnh sửa** hiển
thị `editLog`. Nút ghi-nhận/xem-kết-quả ở trang Phác đồ nay **điều hướng sang `/sessions/[id]`**.

### Demo (seed:demo) — 3 case + nhân sự + Before/After
- Case 1 (khớp KH): buổi 1 `SS-100001` RF đúng kế hoạch. Case 2 (khác KH): buổi 3 `SS-100003` — KH RF/GLOW/5ml → TT
  HIFU/LIFT/7ml (đủ B/C/F + bước + giờ). Case 3 (JetPeel): 1 lọ 100ml dùng qua 3 buổi (5+7+6) → **còn 82ml**, chỉ trừ
  khi Session ghi nhận (không trừ ở Booking).
- Buổi 3: **3 nhân sự** (KTV chính 250k + Master 500k + Hỗ trợ 100k, phí snapshot) · **Before/After 1 chia sẻ + 1
  nội bộ** · đánh giá 5/5 + báo cáo nội bộ KTV.

### Hoàn thiện 4 điểm cuối (chứng minh)
- **Vật tư thực tế** (mục 15,18): `MaterialUsage` +`remainingBefore`/`remainingAfter` (migration **`L_material_balance`**,
  additive; tổng **22 migration**) — `consumeFromContainer`/`consumeFromCustomerMaterial` ghi tồn trước/sau. Widget
  `SpaMaterialConsume` hiện bảng **Nguồn · Vật tư·Lọ-lô · Tồn trước · Dùng · Tồn sau · Chi phí · Thời điểm** (chi phí
  mask theo `finance.read`).
- **JetPeel nhiều Session** (mục 18): 1 lọ `JETPEEL-2026-01` dùng qua nhiều buổi với **số dư chạy tiếp**: buổi 1
  100→95, buổi 2 88→82 (giữa là buổi khách khác) — chỉ trừ khi Session ghi nhận. Test kiểm tồn trước/sau từng lần.
- **Before/After** (mục 21-22): cả 2 ảnh gắn Session; toggle **Khách thấy / Riêng tư** (mặc định riêng tư) trong khối F.
- **Lịch sử chỉnh sửa** (mục 29): sau khi "Sửa ghi nhận" (lý do bắt buộc), khối **Lịch sử chỉnh sửa** hiện ai/khi/lý do
  + diff từng field (trước→sau) từ `editLog`.

### Nợ kỹ thuật (Session)
- Trang Phác đồ vẫn còn định nghĩa modal ghi-nhận/chi-tiết cũ (không mở nữa — đã chuyển sang `/sessions/[id]`); có thể
  dọn ở phase sau.
- Chưa auto map Protocol/Công nghệ → FormTemplate mặc định (schema chưa có link) — nhân viên chọn mẫu thủ công, snapshot version tự động.
- Validate hoàn thành mới **chặn cứng** thiếu dịch vụ thực tế; các điều kiện khác (nhân sự chính, tình trạng sau) là
  khuyến nghị UI. `treatmentArea`/thông số nền chuyên môn dựa Biểu mẫu (không hard-code field theo từng công nghệ).

## Lõi tài chính Mục 6 (v0.15.0) — Báo giá → Hóa đơn → Thanh toán → **Cọc & Hủy phiếu thu** → Công nợ

Chuẩn hóa dòng tiền: **Báo giá (nhiều phương án) → khách chốt 1 → đông cứng snapshot → HÓA ĐƠN → thu
nhiều lần → CÔNG NỢ**. Chỉ đụng luồng tài chính + tích hợp tối thiểu Booking/Báo giá/Khách hàng; KHÔNG
sửa sâu Giá sàn/Marketing/Nhân sự/Kho/Session/CSKH/Portal. Migration **`M_finance`** (additive, 0 DROP;
tổng **23 migration**). **167 test pass** (thêm `test/finance-deposit.test.ts` 6).

### Nguyên tắc cứng (đúng bản mô tả mục 14–18)
- **Báo giá ≠ Hóa đơn.** Thanh toán KHÔNG dựa trực tiếp vào báo giá. **Công nợ tính TỪ HÓA ĐƠN**.
- **Đã trả của hóa đơn = phiếu thu CHƯA HỦY + cọc đã PHÂN BỔ** (`invoicePaidAmount`, `src/lib/invoice.ts`).
  KHÔNG đếm trùng: cọc chỉ cộng khi đã phân bổ đúng 1 lần; phiếu thu đã hủy không tính. Áp đồng bộ ở
  `/api/invoices` (list), `/api/invoices/[id]` (GET), `customerInvoiceFinancials`, `customerFinancials`.

### Migration & schema (`M_finance`)
- Enum `ProposalStatus` +`VIEWING`/`CONVERTED`/`CANCELLED`; enum mới `DepositStatus` (ACTIVE/ALLOCATED/
  REFUNDED/VOID).
- `Payment` +`code`(PT-xxxxxx unique)/`txnRef`/`voidedAt`/`voidReason`/`voidedBy` (hủy phiếu thu, không xóa).
- `Invoice` +`proposalOptionId` (truy vết phương án đã chốt) + quan hệ `deposits`.
- `TreatmentProposal` +`priceAdjustReason` (lý do điều chỉnh giá / bán dưới sàn khi chốt).
- Model mới `Deposit` (`deposits`): code DC-xxxxxx, customerId, bookingId?, invoiceId?, amount, method,
  txnRef, status, receivedBy/At, allocatedAt/By, refundedAt, void*. Quan hệ ngược `Customer.deposits`/
  `Booking.deposits` (additive, không thêm cột).

### Service — `src/lib/deposit.ts`
- `createDeposit` (ACTIVE — tiền thật đang giữ) · `allocateDeposit` (**khóa dòng `SELECT … FOR UPDATE`**;
  chặn: cọc không ACTIVE / hóa đơn đã hủy / khác khách / **cọc vượt công nợ còn lại** → chuyển ALLOCATED +
  gán invoiceId + tính lại trạng thái HĐ) · `voidPayment` (ghi vết + tính lại trạng thái HĐ) · `voidDeposit`
  (chỉ cọc ACTIVE; cọc đã phân bổ chặn) · `nextPaymentCode`/`nextDepositCode`. `FinanceError` mang mã HTTP.
- **Booking có cọc → tự tạo `Deposit` thật** (ACTIVE, gắn bookingId) khi người tạo có `deposit.write`
  (`/api/bookings` POST). `Booking.deposit` chỉ là con số tham chiếu — KHÔNG cộng vào công nợ (tránh đếm trùng).
- **Chốt báo giá (`/api/proposals/[id]/accept`):** giá chốt khác giá phương án → **bắt buộc `priceAdjustReason`**
  (422); giá dưới **tổng giá sàn** phương án (Σ giá sàn hạng mục DỊCH VỤ, `proposalOptionFloorTotal` trong
  `price-floor.ts`) → **409** kèm `details.priceFloor`; duyệt cần `pricefloor.override` + lý do (403/422 nếu
  thiếu). Tạo hóa đơn từ báo giá đã chốt → proposal chuyển **CONVERTED**.

### RBAC
`payment.void` (MANAGER/CASHIER — hủy phiếu thu) · `deposit.write` (MANAGER/RECEPTION/CASHIER — thu & phân bổ
cọc). Giá vốn/giá sàn vẫn mask theo `finance.read`.

### API
`/api/payments` POST (thêm `txnRef` + sinh `code`) · **`/api/payments/[id]/void`** (POST, `payment.void`,
audit `PAYMENT_VOID`) · **`/api/deposits`** (GET lọc khách/trạng thái; POST thu cọc) · **`/api/deposits/[id]/
allocate`** (POST, audit `DEPOSIT_ALLOCATED`) · **`/api/deposits/[id]/void`** (POST). `/api/customers/[id]`
kèm `invoices`/`deposits`. Validation: `paymentVoidSchema`, `depositCreate/Allocate/VoidSchema`,
`proposalAcceptSchema` +`priceAdjustReason`/`allowBelowFloor`.

### UI
- **Hóa đơn `/invoices/[id]`:** nút **Dùng cọc (n)** (modal chọn phiếu cọc ACTIVE → phân bổ, chặn vượt công
  nợ) · bảng **cọc đã phân bổ** · lịch sử thanh toán thêm cột **Mã/Trạng thái** + nút **Hủy phiếu thu** (modal
  lý do bắt buộc) — phiếu hủy gạch ngang + badge "Đã hủy". Nút Hủy hóa đơn khóa khi còn phiếu thu hợp lệ / cọc
  đã phân bổ. Nhãn "Từ báo giá PROP-xxxxxx".
- **Sổ thu `/payments`:** cột Mã/Trạng thái (Hợp lệ/Đã hủy) + txnRef; tổng đã thu chỉ tính phiếu hợp lệ.
- **Báo giá `/proposals/[id]`:** modal Chốt thêm ô **Lý do điều chỉnh giá** (hiện khi giá khác giá phương án)
  + xử lý **409 dưới giá sàn** (banner đỏ + "Duyệt bán dưới sàn & chốt" nếu có quyền). Trạng thái Việt hóa đủ
  8 giá trị; CONVERTED khóa sửa như ACCEPTED.
- **Hồ sơ khách → Hóa đơn & Thanh toán:** dòng **Đối soát** (Đã thanh toán = phiếu thu hợp lệ + cọc đã phân
  bổ; còn cọc đang giữ) + tab con **Tiền cọc** (trạng thái từng phiếu) + thanh toán hiển thị Hợp lệ/Đã hủy.
- Nhãn: `PROPOSAL_STATUS_LABEL` (Bản nháp/Đã gửi/Khách đang xem/Khách chốt/Khách từ chối/Hết hiệu lực/Đã
  chuyển hóa đơn/Hủy), `DEPOSIT_STATUS_LABEL` (Đang giữ/Đã phân bổ/Đã hoàn/Đã hủy) trong `clinic-labels.ts`.

### Demo (seed:demo) — KH-100004 Đỗ Thùy Linh
PROP-100001 (3 phương án) **CONVERTED** phương án Khuyến nghị 11.900.000 → **HD-000001** (PARTIAL,
`proposalOptionId`) → **PT-000001** 5.000.000 (CK #CK20260801) + **PT-000002** 3.000.000 (tiền mặt) =
**đã trả 8.000.000, còn 3.900.000**; **PT-000003** 500.000 **ĐÃ HỦY** (lý do "Thu nhầm hóa đơn khác", không
tính vào đã trả); **DC-000001** 1.000.000 cọc **ĐANG GIỮ** (có thể phân bổ, chưa trừ công nợ). Đối soát:
8.000.000 = phiếu thu hợp lệ 8.000.000 + cọc phân bổ 0.

### Nợ kỹ thuật (Mục 6)
- Chưa có UI thu cọc độc lập (ngoài Booking) & hoàn cọc (REFUND) — service `voidDeposit` có sẵn, thu cọc qua
  Booking hoặc `/api/deposits` POST. Gỡ phân bổ cọc (de-allocate) chưa mở ở UI.
- Giá sàn phương án tính theo hạng mục **DỊCH VỤ** (SERVICE có refId + khai báo giá sàn); hạng mục sản phẩm/
  công nghệ chưa cộng sàn.
- Booking auto-tạo Deposit chỉ khi người tạo có `deposit.write`; vai trò khác thì `Booking.deposit` là ghi chú.

## Giá sàn v2 Mục 7 (v0.16.0) — Cost breakdown theo dòng → Giá sàn (margin) → Version + duyệt dưới sàn

Nâng cấp Giá sàn từ 6 số phẳng → **bảng chi phí cấu thành theo DÒNG (6 nhóm)** → tổng giá vốn → giá sàn
theo biên (margin) → chiết khấu tối đa, có **VERSION (V1/V2)** + snapshot bất biến + duyệt bán dưới sàn có
audit. Chỉ đụng module Giá sàn + integration tối thiểu Dịch vụ/Báo giá. Migration **`N_price_floor`**
(additive, 0 DROP; tổng **24 migration**). **187 test pass** (thêm `test/price-floor-v2.test.ts` 15).

### Migration & schema (`N_price_floor`) — GIỮ model cũ `ServicePriceFloor` (fallback/tương thích Booking)
- Model mới `ServicePriceFloorVersion` (`service_price_floor_versions`): version, status (`FloorVersionStatus`
  DRAFT/PENDING_APPROVAL/APPROVED/ACTIVE/EXPIRED/CANCELLED), method (`FloorMethod` MARGIN/MARKUP/MANUAL),
  minMarginPercent, manualFloorPrice?, roundingUnit, durationMinutes; **snapshot tổng** material/staff/machine/
  room/operation/other/**totalCost/floorPrice/maxDiscount/maxDiscountPercent** + standardPriceSnapshot;
  effectiveFrom/To, changeReason, createdBy/approvedBy/approvedAt. `@@unique([serviceId, version])`.
- `PriceFloorCostLine` (`price_floor_cost_lines`): category (`CostCategory` MATERIAL/STAFF/MACHINE/ROOM/
  OPERATION/OTHER), name, quantity, unit, unitCost, calcType (`CostCalcType` FIXED/PER_MINUTE/PER_SESSION/
  PER_USE/PERCENT_DIRECT/PER_DURATION), calcValue, minutes, amount (snapshot), refId (soft), source, required.
- `BelowFloorApproval` (`below_floor_approvals`): context, serviceId?, floorVersionId?, proposalId?, standardPrice,
  **floorPrice (snapshot)**, actualPrice, belowAmount, belowPercent, reason, approvedBy, approvedAt.

### Lib (`src/lib/price-floor.ts` + `price-floor-service.ts`)
- `computeVersionCost(lines, minutes)` — 2 pha: chi phí trực tiếp → **vận hành % trên chi phí trực tiếp**;
  máy/phòng theo FIXED/PER_MINUTE/PER_SESSION/PER_USE. `computeFloorPrice` (MARGIN mặc định = **giá vốn /
  (1 − biên%)**, làm tròn LÊN theo roundingUnit). `maxDiscount(standard, floor)`. `activeFloorVersion` +
  `checkServicePriceFloor` **ưu tiên version ACTIVE** (fallback model cũ). `buildDefaultLinesFromService`
  (tự lấy vật tư từ định mức + đơn giá SpaProduct.cost, nhân sự từ staffRequirements + gợi ý fee vai trò).
- `price-floor-service.ts`: `createFloorVersion` (bỏ trống lines → auto), `updateFloorVersion` (chỉ DRAFT/
  PENDING), `recomputeVersion` (ghi amount + snapshot tổng), `transitionFloorVersion` (submit/approve/activate/
  cancel — activate **hết hạn version ACTIVE cũ**, cần `pricefloor.approve`).

### API
`/api/price-floors` GET (list enrich: version active + tổng/sàn/biên/CK tối đa/cảnh báo; filter q/nhóm/trạng
thái/hiệu lực; **mask cost/margin theo finance.read**) · `/api/price-floors/[serviceId]` (GET versions+lines;
POST tạo draft) · `/api/price-floor-versions/[id]` (GET/PATCH draft) · `/[id]/status` (submit/approve/activate/
cancel + audit). Chốt báo giá dưới sàn → tạo **BelowFloorApproval snapshot** + audit `BELOW_FLOOR_APPROVED`.

### RBAC (enforce backend)
`pricefloor.read` (xem giá sàn/cảnh báo — MANAGER/CASHIER/RECEPTION/BOD) · `pricefloor.write` (sửa cost + tạo
version — MANAGER/CASHIER) · `pricefloor.approve` (duyệt+áp dụng version — MANAGER/BOD) · `pricefloor.override`
(duyệt bán DƯỚI sàn — MANAGER/BOD). **Cost breakdown/biên/margin CHỈ `finance.read`** thấy (mask ở server).

### UI
`/price-floor` (list: Dịch vụ/Nhóm/Giá chuẩn/Tổng giá vốn/Giá sàn/Biên/Chiết khấu tối đa/Version/Hiệu lực/
Trạng thái + search + filter) → `/price-floor/[serviceId]` (cột trái danh sách version; cột phải **7 khối
A–F cost breakdown theo dòng + G tổng hợp/công thức/giá sàn/chiết khấu tối đa/cảnh báo dưới sàn**; tạo/sửa
draft, gửi duyệt/duyệt/áp dụng/hủy). Dịch vụ → link **Xem/Thiết lập giá sàn** tới đúng dịch vụ.

### Demo (seed:demo)
- **RF (DV-RF-01):** V1 (VT 250k+NS 400k+Máy 300k+VH 100k+Khác 50k = 1.100.000; biên 30% → **giá sàn
  1.572.000**) đã ÁP DỤNG rồi **V2** (gel tăng 250k→350k → 1.200.000 → **1.715.000**); V1 **EXPIRED**, V2 ACTIVE.
- **HIFU (DV-HIFU-01):** VT 160k (2 tuýp×80k) + KTV 250k + Master 500k + Máy 300k + Phòng 100k + Overhead
  **10% chi phí trực tiếp (131k)** = 1.441.000; biên 30% → **giá sàn 2.059.000**. ACTIVE.

### Nợ kỹ thuật (Giá sàn)
- Booking vẫn dùng `checkServicePriceFloor` (nay ưu tiên version) — chưa tạo BelowFloorApproval snapshot cho
  luồng Booking (mới có ở Báo giá). Chưa có màn danh sách BelowFloorApproval (đã lưu + audit).
- Máy/phòng theo per-minute cần nhập `minutes`/rate thủ công (mặc định lấy durationMinutes dịch vụ).
- Khấu hao thiết bị = phí máy/buổi đơn giản (chưa có asset depreciation engine — đúng phạm vi phase).

## Nhân sự master data Mục 8 (v0.17.0) — Đa vai trò · Phí theo vai trò (hiệu lực) · Năng lực · Lịch · Nghỉ phép

Nâng cấp Nhân sự từ danh mục tối giản → **master data đầy đủ** để Booking/Session/Giá sàn dùng đúng.
**NHÂN SỰ ≠ tài khoản đăng nhập (User/RBAC)** — không merge. Migration **`O_hr`** (additive, 0 DROP; tổng
**25 migration**). **200 test pass** (thêm `test/hr-master.test.ts` 10).

### Migration & schema (`O_hr`) — GIỮ `Employee.roles[]`/`defaultFee` cũ (tương thích)
- `Employee` +`dob`/`title`/`branch`/`startDate`/`status` (enum **EmployeeStatus** ACTIVE/ON_LEAVE/RESIGNED;
  `isActive` = status==ACTIVE giữ tương thích).
- `EmployeeRoleFee` (`employee_role_fees`): phí theo vai trò CÓ hiệu lực ngày (`effectiveFrom/To`+`isActive`)
  — đổi phí = TẠO BẢN MỚI, không sửa lịch sử.
- `EmployeeCompetence` (kind TECHNOLOGY/SERVICE/PROTOCOL/ROLE + refId soft), `EmployeeCertification`
  (issuedAt/expiresAt → cảnh báo hết hạn), `EmployeeSchedule` (recurring theo `dayOfWeek` 0–6 + giờ),
  `EmployeeLeave` (enum **LeaveType** ANNUAL/SICK/EMERGENCY/UNAVAILABLE/OTHER + from/to).

### Lib `src/lib/hr.ts`
`resolveRoleFee(empId, role, at)` (phí hiện hành theo ngày) · `currentRoleFees` · `employeeAvailability`
(active + trong ca `isWithinSchedule` + không nghỉ phép + không trùng booking → `available`) · `hasCompetence`
· `suggestEmployeesForBooking` (đang làm + đúng vai trò + đủ năng lực + rảnh) · `employeeKpi` (buổi/điểm KTV/
đánh giá/hài lòng/sự cố — read-only từ Session/Review). **isActive ≠ availability** (mục 11).

### API
`/api/employees` GET (enrich roleFees/competences/status + filter q/role/branch/status/technology; mask phí)
· POST (thông tin cơ bản) · `/api/employees/[id]` GET (roleFees/competences/certs/schedules/leaves + kpi) ·
PATCH (info/status; audit `EMPLOYEE_STATUS_CHANGED`). Sub-resource (POST + DELETE query): `[id]/role-fees`
(versioning + audit **STAFF_FEE_CHANGED cũ→mới**), `[id]/competences`, `[id]/certifications`, `[id]/schedules`,
`[id]/leaves`. `/api/employees/suggest` (gợi ý cho Booking).

### Integration (tối thiểu, không sửa cấu trúc mục cũ)
- **Lịch hẹn:** `/api/bookings` POST validate nhân sự đã chọn (so theo tên với danh mục): **RESIGNED → chặn
  cứng 409**; nghỉ phép/ngoài ca/trùng lịch → 409 (cần `allowConflict` để đặt đè). `/api/employees/suggest`
  gợi ý người phù hợp. (mục 10–11,16)
- **Session:** thêm nhân sự buổi → gợi ý **phí hiện hành theo vai trò** (`resolveRoleFee`); lưu = SNAPSHOT
  (`SessionStaff.fee`) — đổi phí master sau KHÔNG đổi buổi cũ (mục 13,24).
- **Giá sàn:** `buildDefaultLinesFromService` lấy phí nhân sự từ **EmployeeRoleFee hiện hành**; publish version
  vẫn snapshot cost (mục 14).

### RBAC (enforce backend) — mục 19
`staff.read` (gộp CLINIC_READ) · `staff.write` · `staff.role.manage` · `staff.schedule.manage` ·
`staff.fee.read` · `staff.fee.write`. Phí nhân sự CHỈ hiện với `staff.fee.read` HOẶC `finance.read` (mask ở
server, không chỉ ẩn UI). MANAGER đủ; RECEPTION có write/role/schedule nhưng KHÔNG thấy phí; SPECIALIST không
quản lý nhân sự.

### UI
`/employees` (list: Mã/Họ tên/Chức danh/Vai trò chip/Chuyên môn chính/Chi nhánh/Trạng thái + search + filter
vai trò/chi nhánh/trạng thái) · `/employees/[id]` (7 tab **A Thông tin · B Vai trò & Phí · C Năng lực · D
Chứng nhận · E Lịch làm việc · F Nghỉ phép · G Hoạt động & Đánh giá**; đổi trạng thái; thêm/bỏ vai trò-phí/
năng lực/chứng nhận/ca/nghỉ). Chứng nhận hết hạn hiện badge đỏ.

### Demo (seed:demo)
- **NV-000001 Phạm Chuyên Viên** (ACTIVE): KTV chính 250k + Hỗ trợ 100k; năng lực RF+HIFU; chứng nhận (1 còn
  hạn + 1 **hết hạn** → cảnh báo); lịch T2–T6 08:00–17:00; **nghỉ 20/08/2026 08:00–12:00**.
- **NV-000002 Trần Quản Lý**: Master **500k đến 31/08/2026, 600k từ 01/09** (hiệu lực ngày); Kiểm tra 200k;
  năng lực HIFU.
- **NV-000004 Đỗ Thu Ngân**: khai báo năng lực **chỉ RF (không HIFU)** → bị **loại** khỏi gợi ý Booking HIFU
  (demo lọc theo năng lực); nhân sự chưa khai năng lực (NV-000003) thì không bị chặn.
- **NV-000005 Ngô Nghỉ Việc**: RESIGNED (không được phân công mới; lịch sử giữ).

### Múi giờ (timezone) — `src/lib/timezone.ts` — CHUẨN: true-UTC + hiển thị Asia/Ho_Chi_Minh
Hệ thống vận hành **một múi giờ nghiệp vụ Asia/Ho_Chi_Minh (UTC+7, không DST)**. Mô hình **thống nhất ở
layer dùng chung** (không vá từng màn):
- **Lưu trữ = true-UTC** (instant thật). Thời gian người dùng nhập (giờ VN) được **chuyển sang UTC** trước khi
  lưu qua `parseVnLocal()` (datetime-local "08:00" VN → `01:00Z`); `now()` vốn là UTC.
- **Hiển thị = convert Asia/Ho_Chi_Minh** ở MỌI chỗ: `formatDate/formatDateTime` (`src/lib/utils.ts`) đặt
  `timeZone: "Asia/Ho_Chi_Minh"`; toàn bộ `toLocale*` ngày giờ trong UI (Lịch hẹn, Cổng khách, form-renderer,
  reschedule, print, import) đều gắn `timeZone` VN hoặc dùng `formatDateTime`/`formatVnTime`. → **cùng một
  record hiển thị GIỐNG NHAU ở mọi màn**, bất kể múi giờ trình duyệt/máy chủ.
- **Logic lịch** (availability, thứ/giờ/phút) qua `vnClock()` = convert UTC→VN (getUTC* + offset). Không dùng
  `getHours()` (phụ thuộc TZ tiến trình).
Ví dụ kiểm chứng: nghỉ phép 20/08 **08:00–12:00 VN** lưu DB `01:00Z–05:00Z`, hiển thị ở Hồ sơ nhân sự
= 08:00–12:00, availability Booking chặn 09:00 / cho 13:00. Test `test/hr-timezone.test.ts` (DB→API→UI→
availability cùng một record). Seed demo dùng helper `vnts()` để lưu giờ VN thành true-UTC.

### Nợ kỹ thuật (Nhân sự)
- Booking lưu nhân sự bằng **tên (String)** — validate/suggest so theo tên; chưa đổi sang FK employeeId (giữ
  tương thích mục Lịch hẹn đã nghiệm thu). Gợi ý slot của Booking chưa nhúng suggestEmployees (mới có API).
- File chứng nhận: mới lưu `mediaId` (chưa gắn upload trong UI). KPI đọc theo tên performer/technicianName +
  SessionStaff.employeeId (chưa chuẩn hoá hoàn toàn về employeeId).
- **Timezone**: đã chuẩn hóa true-UTC + hiển thị Asia/Ho_Chi_Minh ở layer dùng chung (xem trên) — audit
  `createdAt=now()` cũng hiển thị đúng giờ VN. Nếu về sau hỗ trợ đa múi giờ (chi nhánh khác vùng) cần chuyển
  offset cố định +7 sang tz-per-branch — hiện ngoài phạm vi (VN một múi giờ).

## CSKH · Follow-up & Sinh nhật Mục 9 (v0.18.0) — Lần áp có snapshot · Chống trùng · Vòng đời task · RBAC tách

Hoàn thiện LOGIC NGHIỆP VỤ của module CSKH (giữ nguyên UI khung, chỉ bổ sung). Migration
**`P_care_process`** (additive, 0 DROP; tổng **26 migration**). **223 test pass** (thêm `test/followup.test.ts`
8 + `test/followup-http.test.ts` 5, thay cho 3 test cũ).

### Migration & schema (`P_care_process`)
- `FollowUpTemplate` +`version Int @default(1)` — **tăng khi sửa các bước** (metadata như tên/mô tả/kích hoạt
  KHÔNG bump).
- Enum mới `CareInstanceStatus` (ACTIVE/CANCELLED/COMPLETED). Model mới **`CareProcessInstance`**
  (`care_process_instances`, code CSI-xxxxxx): **một LẦN ÁP** quy trình cho khách — snapshot
  `templateCode/templateName/templateVersion/trigger` + `startDate` (anchor) + `appliedBy/At` +
  `cancelledAt/By/cancelReason`. Quan hệ `Customer.careProcessInstances`, `FollowUpTemplate.instances`,
  `Task.careInstance`.
- `Task` +`careProcessInstanceId`/`processStepId`/`processVersion`/`stepSnapshot(Json)` (SNAPSHOT bước lúc áp:
  dayOffset/channel/title/script/checklist) + vòng đời: `completedAt/By`/`completionNote`/`checklistState(Json)`/
  `actualChannel` · `reopenedAt/By`/`reopenReason` · `cancelledAt/By`/`cancelReason`.

### Service — `src/lib/followup.ts`
- `applyFollowUpTemplate` (viết lại): **(1) chống trùng** — nếu đã có instance **ACTIVE** cùng
  (khách, quy trình, **ngày mốc** theo lịch VN) và không `force` → ném `FollowUpDuplicateError` (409, kèm lần áp
  đang chạy). **(2)** tạo `CareProcessInstance` (snapshot version). **(3)** mỗi bước → 1 Task hạn =
  `startDate + dayOffset` + **stepSnapshot** + `processVersion` (đông cứng — sửa mẫu về sau KHÔNG đổi task đã
  áp). **(4)** ghi CrmActivity FOLLOW_UP. Trả `{instance, tasks}`.
- `cancelCareInstance` (khác "ngưng mẫu"): instance → CANCELLED (ai/khi/lý do) + **hủy task chưa xong**
  (OPEN/IN_PROGRESS → CANCELLED, KHÔNG hard-delete; task DONE giữ). `recomputeCareInstanceStatus` (mọi task
  kết thúc + có ≥1 DONE → COMPLETED).
- `upcomingBirthdays` (hardening): tính ngày/tháng sinh + "hôm nay" qua **`vnClock`** (lịch VN, không phụ thuộc
  TZ tiến trình); sinh nhật gần nhất theo năm nay/năm sau (KHÔNG dùng năm sinh tính khoảng cách), **xử lý wrap
  cuối năm**; tuổi từ DOB đầy đủ; thiếu DOB → loại. Trả thêm `assignedTo` + `nextBirthdayDate` (yyyy-MM-dd) để
  prefill.

### API
- `POST /api/followup-templates/[id]/apply`: quyền **`FOLLOWUP_APPLY`** (không dùng TASK_WRITE nữa); nhận
  `force`/`note`; 409 kèm `details.existing` khi trùng; audit `FOLLOWUP_APPLIED` (entityType CareProcessInstance).
- `PATCH /api/followup-templates/[id]`: **bump version** khi gửi `steps` (thay toàn bộ bước); audit kèm
  `versionFrom/To`.
- **`/api/care-process-instances`** (GET list + tiến độ done/cancelled/overdue), **`/[id]/cancel`** (POST,
  `FOLLOWUP_APPLY`, lý do bắt buộc, audit `CARE_INSTANCE_CANCELLED`).
- `GET /api/tasks`: **filter=today|upcoming|overdue|open|done|all** (quá hạn = chưa xong + dueDate < now, mốc
  ngày theo lịch VN) + `assignee`/`careInstanceId`; include `careInstance`.
- `PATCH /api/tasks/[id]`: **vòng đời có audit** — `action=start|complete|reopen|cancel|update`. complete ghi
  `completedAt/By`/`completionNote`/`checklistState`/`actualChannel` + audit `TASK_COMPLETED` + tự
  recompute instance; reopen/cancel **lý do bắt buộc** (422) + audit `TASK_REOPENED`/`TASK_CANCELLED`; update ghi
  **diff từng trường** (audit `TASK_UPDATED`). Không `action` → giữ PATCH cũ (tương thích). **KHÔNG hard-delete.**
- `src/lib/client.ts`: `apiFetch` ném `ApiError` mang `status`+`details` (để UI xử lý 409 chống trùng).

### RBAC (tách quyền — enforce backend, mục 9 group 8)
- **`FOLLOWUP_WRITE`** (tạo/sửa/ngưng MẪU quy trình): **chỉ MANAGER** (+ADMIN). RECEPTION & CUSTOMER_CARE
  KHÔNG còn quyền này → PATCH mẫu trả **403**.
- **`FOLLOWUP_APPLY`** (áp quy trình + hủy lần áp): **MANAGER + CUSTOMER_CARE**.
- **`TASK_WRITE`** (xử lý/hoàn thành task) giữ rộng: MANAGER/RECEPTION/CUSTOMER_CARE/SPECIALIST.

### UI
- `/followups`: nút **"Chúc mừng"** ở thẻ sinh nhật → mở modal **prefill** khách + **mốc = ngày sinh nhật sắp
  tới** + **phụ trách = CSKH của khách** (`assignedTo`); thành công báo "Đã tạo chăm sóc sinh nhật CSI-xxxxxx".
  Modal áp xử lý **409 chống trùng** (banner vàng + "Vẫn tạo lần áp mới (xác nhận)"). Bảng quy trình hiện **badge
  vX**. Modal sửa mẫu có **cảnh báo bump version + ngưng dùng**. `canApply` dùng `FOLLOWUP_APPLY`.
- `/tasks`: **bộ lọc** Hôm nay/Sắp tới/Quá hạn/Hoàn thành/Tất cả (kèm số đếm); cột **Nguồn** (badge CSI /
  Thủ công), **Kênh**, checklist/kịch bản; **"Quá hạn X ngày"**; thao tác theo trạng thái (Bắt đầu/Hoàn thành/
  Hủy/Mở lại). **Modal Hoàn thành** (tick checklist snapshot + kênh thực tế + kết quả). **Modal lý do** cho
  Mở lại/Hủy.

### Demo (seed:demo)
- 2 mẫu: `CS-000001` (3 bước +1/+3/+14, AFTER_SERVICE) · `CS-000002` (BIRTHDAY). 2 khách sinh nhật ≤30 ngày
  (KH-100002 20/08 · KH-100004 30/08 — từ ngày container 14/08).
- **`CSI-000001`** (áp CS-000001 cho KH-100004, mốc 05/08): buổi 1 (+1=06/08) **DONE** (kết quả + kênh ZALO +
  checklist tick), buổi 2 (+3=08/08) **quá hạn**, buổi 3 (+14=19/08) sắp tới → minh họa bộ lọc & snapshot.

### Nợ kỹ thuật (CSKH)
- Chống trùng theo **ngày mốc** (VN) của instance ACTIVE cùng quy trình; nếu muốn chặn theo cửa sổ N ngày cần
  mở rộng. Kích hoạt tự động quy trình khi hoàn thành buổi/dịch vụ vẫn **thủ công** (áp qua UI). Gửi tin thật
  (Zalo/SMS/Email) chưa tích hợp — tạo Task để nhân viên chủ động liên hệ. Chưa có màn danh sách lần áp
  (CareProcessInstance) riêng ngoài API + timeline khách.

## Ngôn ngữ giao diện — MẶC ĐỊNH TIẾNG VIỆT (bắt buộc)

Toàn bộ **giao diện người dùng** mặc định **Tiếng Việt (`vi-VN`)**. **Code/DB/API identifier giữ
tiếng Anh** (không dịch tên model/enum/biến). Áp dụng cho **toàn bộ UI hiện tại và mọi module mới**.

- **KHÔNG hiển thị giá trị enum tiếng Anh trực tiếp ra UI** — luôn qua map nhãn
  (`src/lib/clinic-labels.ts`, `src/lib/labels.ts`) hoặc **`statusLabel()`** (gộp mọi map + nhãn
  chung `COMMON_STATUS_LABEL`, lưới an toàn cho status từ nhiều thực thể như timeline khách).
- **Nhãn tập trung** ở các module labels (không rải chuỗi khó gom) — sidebar/tab/nút/trạng thái/
  placeholder/loại-trường form đã Việt hóa. Nút: Thêm mới/Lưu/Hủy/Duyệt/Từ chối/Hoàn thành…;
  trạng thái: Bản nháp/Chờ xử lý/Đang thực hiện/Hoàn thành/Đã hủy/Đã duyệt…
- **Định dạng vi-VN**: `formatNumber`, **`formatCurrency`** ("2.500.000 ₫"), `formatDate`
  (dd/MM/yyyy), **`formatDateTime`** (dd/MM/yyyy HH:mm) trong `src/lib/utils.ts`.
- **Giữ nguyên**: tên brand/sản phẩm/công nghệ/protocol do người dùng nhập, SKU, mã định danh,
  thuật ngữ chuyên môn (Protocol, DMK, Before/After, ROI, VIP…) — nhưng câu/label xung quanh tiếng Việt.
- **Kiến trúc i18n** (`src/lib/i18n.ts`): `DEFAULT_LOCALE=vi-VN`, hàm `t()`, chuẩn bị thêm English
  tương lai **không phải viết lại UI**; chưa bật language switcher trong phase này.
- **Thông báo lỗi**: hiển thị tiếng Việt dễ hiểu, **không** lộ raw DB/API error (server trả thông
  báo chung; chi tiết chỉ vào log đã redact).

## BUSINESS REDESIGN — Phase 1 · SOP chuẩn hóa của Dịch vụ (ServiceStep) (v0.21.0)

Chuẩn hóa mô hình **DỊCH VỤ → CÁC BƯỚC (SOP)** theo bản redesign (SERVICE → SERVICE STEPS → … → PROTOCOL
COMPOSE → BOOKING MULTI-SERVICE → ACTUAL SESSION). **Quyết định người dùng:** (a) **Coexistence** — giữ
protocol theo-bước cũ hợp lệ, CHỈ **THÊM** khả năng chuẩn hóa SOP ở Dịch vụ; (b) bắt đầu **P1 — Service
Steps trước**. Thuần **additive, 0 DROP**. Migration **`R_service_steps`** (0 lệnh phá hủy, 17 lệnh additive;
tổng **28 migration**). **288 test pass** (baseline 281 + `test/service-sop.test.ts` 7). tsc sạch · build OK.

### Migration & schema (`R_service_steps`)
- `Service` +`version Int @default(1)` (bump khi sửa SOP — bất biến cho buổi đã ghi nhận) + quan hệ `steps`.
- Enum mới `ServiceStepSelectMode` (SINGLE_SELECT/OPTIONAL).
- 4 model mới (đều `@@map` snake_case, FK cascade theo Service/Step):
  - **`ServiceStep`** (`service_steps`): `serviceId`, `sortOrder`, `name`, `description?`, `durationMinutes?`,
    `technique?`, `notes?`, `warnings?` (chống chỉ định), `isRequired`, `conditionText?` (điều kiện áp dụng).
  - **`ServiceStepProduct`** (`service_step_products`): sản phẩm/định mức của bước — `spaProductId?` (soft link
    catalog), `name`, `quantity Decimal(14,3)`, `unit`, `isRequired`, `notes?`, `sortOrder`.
  - **`ServiceStepTechnology`** (`service_step_technologies`): công nghệ áp dụng — `technologyId`,
    `suggestedParameters Json?`, `notes?`; `@@unique([serviceStepId, technologyId])`.
  - **`ServiceStepOption`** (`service_step_options`): phương án/biến thể (chọn 1 khi thực hiện) — `name`,
    `selectMode`, `isDefault`, `spaProductId?`, `quantity?`, `unit?`, `technique?`, `durationMinutes?`,
    `notes?`, `conditionText?`, `sortOrder`.
- Back-relations thêm vào `SpaProduct` (`stepProducts`/`stepOptions`) và `Technology` (`stepTechnologies`).

### Lib & validation
- **`src/lib/service-sop.ts`** (mới): `stepInclude`/`serviceStepsInclude` (đọc SOP theo `sortOrder`);
  `buildStepsCreate(steps)` (nested-create, tự gán `sortOrder` theo index); `sopTotalDuration`;
  **`sopSnapshot(service)`** (deep-clone bất biến version+bước+SP/CN/PA — cho Actual Session P4 & mục 9);
  `expectedMaterialCost(steps, costById)` (Σ qty×giá vốn cho SP có link catalog — nhạy cảm).
- **`src/lib/clinic-validation.ts`**: `stepProductSchema`/`stepTechnologySchema`/`stepOptionSchema`/
  `serviceStepSchema`/`serviceStepsSchema`; `quantity` **coerce > 0** (≤0 → 422), `unit` bắt buộc;
  `serviceCreateSchema` (và `serviceUpdateSchema` kế thừa qua `.partial()`) thêm `steps?`.

### API (additive — không đổi hành vi khi vắng `steps`)
- `POST /api/services`: nhận `steps` → nested-create SOP.
- `GET /api/services/[id]`: trả `steps` (đã include SP/CN/PA) + `sopDuration` + `sopMaterialCost`
  (**mask theo `finance.read`** — non-finance = null).
- `PATCH /api/services/[id]`: gửi `steps` → **thay toàn bộ SOP** (cascade xóa cũ) + **`version` +1** + audit
  **`SERVICE_SOP_CHANGED`** (`{version:{before,after}, stepCount:{before,after}}`). Không gửi `steps` → SOP
  giữ nguyên (không bump version).

### UI — `/services` form khối **D. Quy trình thực hiện (các bước)**
Trong `ServiceFormModal` (chèn giữa C Chuyên môn và E Vật tư định mức; đổi nhãn Vật tư→**E**, Giá→**F**):
`StepEditor` — thẻ mỗi bước (STT · tên · thời lượng · Bắt buộc · **↑/↓ đổi thứ tự** · xóa), kỹ thuật/điều
kiện/mô tả/**cảnh báo**, `StepProducts` (SP dropdown catalog + SL/ĐVT/BB), `StepTechs` (công nghệ + thông
số), `StepOptions` (phương án + **radio 1 mặc định**). Hiện **tổng thời lượng SOP**. Modal chi tiết dịch vụ
render read-only SOP (STT/thời lượng/thao tác/cảnh báo/SP/CN/PA + số bước + tổng thời lượng + **phiên bản v**).

### Demo (seed-demo.ts) — DV-DMK-ENZ "DMK Enzyme Treatment" (5 bước, 83′, version 1)
1 Làm sạch (SP DMK Cleanser 5ml) · 2 Detox-LED (công nghệ LED) · 3 Build (SP Mist 3ml) · 4 Đắp Enzyme
(**3 phương án**: Enzyme#1 / **Enzyme#2 mặc định** / Không đắp; **cảnh báo chống chỉ định**) · 5 Phục hồi.
Thêm brand DMK + công nghệ LED + 4 SpaProduct DMK. Guard `if (!svcDMK)` idempotent.

### Chứng minh (test/service-sop.test.ts, 7 test HTTP thật trên Postgres)
§25 create persistence (version 1, sortOrder 0..4, product link + quantity/unit, technology, 3 option 1
default, warnings) · §25 read (sopDuration=83) · §25 edit+reorder (version 1→2, sortOrder reindex,
`SERVICE_SOP_CHANGED` audit) · §9 snapshot bất biến (chụp v1 → sửa v2 → snapshot v1 KHÔNG đổi) · validation
qty>0 & unit bắt buộc → 422 · §19 finance mask (`sopMaterialCost` null non-finance / >0 finance) · RBAC
(create `service.write`→403, read `service.read`→403).

### Coexistence & nợ kỹ thuật (P1)
- **Không đụng** Protocol (bước cũ), Booking, Session, RBAC/finance đã nghiệm thu (Mục 15) — chỉ thêm bảng +
  cột `Service.version` + route additive. SOP để trống thì Dịch vụ hoạt động y như cũ (tương thích dữ liệu).
- **Chưa** làm: P2 Protocol compose nhiều Service (coexistence), P3 Booking multi-service (BookingItem),
  P4 Actual Session chọn phương án + snapshot SOP + trừ tồn theo phương án. `sopSnapshot` đã sẵn cho P4.
- `ServiceMaterialStandard` (khối E) **giữ nguyên** song song SOP; có thể hợp nhất "vật tư định mức" vào bước
  SOP ở phase sau nếu muốn một nguồn duy nhất.

## BUSINESS REDESIGN — Phase 2 · Protocol compose NHIỀU Service (ProtocolService) (v0.22.0)

Cho phép một **Protocol chuẩn compose NHIỀU Service** (mỗi Service giữ SOP riêng từ P1), trong khi Protocol
kiểu cũ theo `steps Json` VẪN chạy bình thường. **Quyết định giữ nguyên: COEXISTENCE** — không rewrite,
không convert hàng loạt, không DROP dữ liệu cũ. Thuần **additive, 0 DROP**. Migration **`S_protocol_services`**
(0 phá hủy, 7 additive; tổng **29 migration**). **296 test pass** (baseline 288 + `test/protocol-compose.test.ts`
8). tsc sạch · build OK.

### Audit trước khi code (kết luận)
- `BrandProtocol` = thư viện Protocol; **legacy steps** lưu ở `steps Json?` (`{items:[…]}`); version = integer +
  `changeLog Json`; công nghệ/sản phẩm qua join `BrandProtocolTechnology`/`BrandProtocolProduct`; được tham chiếu
  bởi `TreatmentSession.brandProtocolId` (+`plannedProtocolId` soft). **TreatmentPlan KHÔNG** tham chiếu protocol
  trực tiếp (chỉ qua session). Dữ liệu KHÔNG được làm mất: `steps`, `technologies`, `products`, version/changeLog,
  các field cấp-protocol (purpose/suitableFor/contraindications/pre-post-care/freq/count), quan hệ `sessions`.

### Quyết định kiến trúc
1. **Mode = enum tường minh** `ProtocolCompositionMode {LEGACY_STEPS, SERVICES}` (mặc định **LEGACY_STEPS** →
   mọi protocol cũ giữ nguyên hành vi). Ít ambiguity hơn suy-diễn theo "có/không có services". **MIXED KHÔNG
   thêm** (tránh nhập nhằng) — chưa cần.
2. **Version pinning (báo LIMITATION trung thực):** Service hiện chỉ có `version` integer, **CHƯA có bảng lịch
   sử SOP**. `ProtocolService.serviceVersionSnapshot` **ghi lại số version** lúc gắn/publish (để đối chiếu),
   nhưng **KHÔNG dựng lại được SOP cũ**. Mặc định protocol tham chiếu Service **LIVE** (SOP hiện hành). Snapshot
   SOP **bất biến** thực sự sẽ diễn ra ở **P4** (Plan/Session) qua `sopSnapshot()` (đã có từ P1). Không fake pinning.

### Migration & schema (`S_protocol_services`)
- Enum `ProtocolCompositionMode`; `BrandProtocol` +`compositionMode` (default LEGACY_STEPS) + quan hệ `services`.
- Model **`ProtocolService`** (`protocol_services`): `protocolId`, `serviceId`, `sortOrder`, `phase?`, `isRequired`,
  `conditionText?`, `notes?`, `durationOverride?`, `serviceVersionSnapshot?`, `recommendedVariants Json?`. FK
  protocol **Cascade**, FK service **Restrict** (Service không hard-delete). **KHÔNG** có cột steps/product/tech
  → không double-source. Back-relation `Service.protocolServices`.

### Backend
- `src/lib/protocol-compose.ts`: `protocolServiceInclude`/`protocolServicesInclude` (đọc kèm **preview SOP** của
  Service read-only), `buildProtocolServicesCreate(services, versionById)` (ghi serviceVersionSnapshot),
  `composeTotalDuration` (Σ durationOverride ?? Service.duration ?? Σ bước SOP).
- Validation: `protocolServiceSchema`/`protocolServicesSchema` + `compositionMode`/`services` thêm vào
  create/update protocol.
- API `POST /api/brand-protocols` + `PATCH /api/brand-protocols/[id]`: nhận `compositionMode` + `services`
  (thay TOÀN BỘ; xác thực Service tồn tại → **422** nếu thiếu; ghi version snapshot). GET trả `services` (+SOP
  preview) + `composeDuration`. Audit **`PROTOCOL_SERVICES_CHANGED`** (before/after gọn). Legacy `bumpVersion`/
  `status`/`steps` giữ nguyên.

### UI — `/protocols/[id]`
Selector **"Cách tổ chức nội dung"** (Theo bước cũ | Compose nhiều Dịch vụ). Khi SERVICES: card **"Compose từ
Dịch vụ (n) · ~tổng thời lượng′"** — thêm dịch vụ (dropdown active-only), **↑/↓ đổi thứ tự**, xóa, **Bắt buộc**,
ghi đè thời lượng, điều kiện, ghi chú; **expand xem SOP read-only** của Service (số bước/thời lượng/phương án/
cảnh báo). Hiển thị `vX (gắn vY)` khi version live khác snapshot. Card "Các bước thực hiện" (legacy) **ẩn** ở
mode SERVICES (dữ liệu vẫn giữ). Link ExternalLink → sửa SOP ở màn Dịch vụ (KHÔNG sửa SOP trực tiếp từ protocol).

### Demo (seed-demo.ts) — `PROTO-PIGMENT-COMBO` "Điều trị sắc tố kết hợp"
mode SERVICES, 3 dịch vụ: **DMK Enzyme Treatment** (bắt buộc, ĐK "chọn enzyme theo tình trạng da",
recommendedVariants Enzyme#2) → **Laser Pico** (`DV-PICO-01`, bắt buộc) → **Recovery** (`DV-RECOVERY-01`, tùy
chọn). Thêm công nghệ Laser Pico + 2 service mới. Guard idempotent `if (!protoCompose && svcDmk)`.

### Chứng minh (test/protocol-compose.test.ts, 8 test HTTP thật)
A legacy protocol vẫn chạy (mode LEGACY_STEPS, steps giữ, 0 ProtocolService) · B 1 Protocol→3 Service đúng
sortOrder + version snapshot + preview SOP 5 bước + composeDuration=128 · C reorder persistence · D+E optional +
override (durationOverride/recommendedVariants) KHÔNG clone SOP · **F Service source-of-truth** (sửa SOP Service
→ protocol phản chiếu live 4 bước; serviceVersionSnapshot giữ lúc gắn) · G versioning (đổi composition +
bumpVersion → v2 + audit PROTOCOL_SERVICES_CHANGED) · H RBAC (thiếu protocol.write→403, ẩn danh→401) · I
validation serviceId sai→422.

### Coexistence & KHÔNG mở rộng phase (đúng ranh giới)
- **KHÔNG đụng:** TreatmentPlan/Booking/Session business rule, RBAC/finance (Mục 15), Pricing/Costing, sidebar.
  RBAC dùng lại `protocol.write`/`protocol.approve` sẵn có. Không CONFLICT với baseline Mục 2–16 + P1.
- **Chưa làm (phase sau):** P3 Booking multi-service (BookingItem); P4 Actual Session chọn phương án + snapshot
  SOP + trừ tồn theo phương án. **TreatmentPlan tích hợp:** hiện Planned Session chọn 1 Protocol/1 Service như cũ
  — khi chọn protocol SERVICES (nhiều dịch vụ) hệ thống CHƯA tự tách thành nhiều buổi (mới phân tích, chưa đổi
  rule — thuộc phase Plan). `sopSnapshot`/`composeTotalDuration` đã sẵn cho các phase đó.

## BUSINESS REDESIGN — Phase 3 · Booking NHIỀU dịch vụ (BookingItem) (v0.23.0)

1 Booking (1 lần khách đến) chứa **NHIỀU dịch vụ tuần tự** (BookingItem), thay vì phải tạo nhiều lịch
riêng. Thuần **additive, 0 DROP**. Migration **`T_booking_items`** (0 phá hủy, 5 additive; tổng **30
migration**). **303 test pass** (baseline 296 + `test/booking-multiservice.test.ts` 7). tsc sạch · build OK.

### Audit trước khi code (kết luận)
`Booking` (bookings): `serviceId` **đã nullable**; tài nguyên/nhân sự (technician/master/assistants/room/
bed/machine) + giá/cọc ở **cấp Booking**; conflict engine `detectBookingConflicts` theo tài nguyên
Booking-level; 1-1 với `TreatmentSession`; soft ref planId/stageId/sessionNumber. → **Multi-service tuần
tự trong 1 lần đến dùng CHUNG tài nguyên** ⇒ KHÔNG cần đưa resource/staff xuống item ⇒ **KHÔNG CONFLICT**.

### Migration & schema (`T_booking_items`)
- `BookingItem` (`booking_items`): `bookingId`, `serviceId`, `sortOrder`, `durationSnapshot?`,
  `priceSnapshot?`, `plannedSessionId?` (soft), `note?`. FK booking **Cascade**, service **Restrict**.
- `Booking` +quan hệ `items`; **`Booking.serviceId` GIỮ NGUYÊN** = dịch vụ CHÍNH = item[0] (tương thích ngược).

### Backend — `src/lib/booking-items.ts`
- `snapshotBookingItems` (snapshot thời lượng/giá từ Service **tại thời điểm thêm** — đổi Service về sau
  KHÔNG đổi booking cũ) · `totalItemsDuration` (Σ, tuần tự) · `missingServiceIds` (→422) · `itemsForRead`
  (**dual-read**: booking cũ chưa có item → tổng hợp 1 item "ảo" từ serviceId, không ghi DB) ·
  `backfillBookingItems` (**idempotent**: legacy booking → 1 item, chạy lại không trùng).
- **`POST /api/bookings`**: nhận `items[]` → xác thực (422) + snapshot; `Booking.serviceId` = item đầu;
  `durationMinutes` = Σ item (trừ khi nhập tay). Conflict/giá/giá sàn/cọc vẫn theo **dịch vụ chính +
  tài nguyên Booking-level** (không đổi engine). Audit CREATE kèm items.
- **`PATCH /api/bookings/[id]`**: gửi `items` → **thay toàn bộ** (add/remove/reorder) trong transaction +
  tính lại serviceId/duration + audit **`BOOKING_ITEMS_CHANGED`**. Giữ khóa COMPLETED.
- **`GET /api/bookings/[id]`**: trả `items` (+dual-read) + `totalDuration`. **List** kèm `items` để lịch
  hiển thị "dịch vụ đầu + N" (vẫn **1 card/booking**).

### UI — `/bookings`
Form: **Dịch vụ chính** + khối **"Dịch vụ bổ sung trong lần đến này"** (thêm/xóa/**↑↓ đổi thứ tự** dịch vụ
+ tổng thời lượng ~N′ + ghi chú "tài nguyên/nhân sự dùng chung"). Lịch (List/chip): nhãn **"Dịch vụ đầu
+N dịch vụ"** (`bookingServiceLabel`). Chi tiết lịch: liệt kê **Dịch vụ (n) · tổng N′** + từng hạng mục
kèm thời lượng. Booking 1 dịch vụ / booking cũ hiển thị như trước (dual-read).

### Nguyên tắc P3 (đúng ranh giới)
- **Sequential only:** tổng thời lượng = Σ item (chưa hỗ trợ song song). Tài nguyên/nhân sự ở cấp Booking
  (1 lần đến dùng chung) — KHÔNG xuống item.
- **Snapshot bất biến:** durationSnapshot/priceSnapshot chốt lúc thêm; đổi Service sau KHÔNG đổi booking.
- **Giá/cọc/billing giữ nguyên:** Booking.price = giá dịch vụ chính; per-item chỉ snapshot (KHÔNG mở
  Pricing/Invoice/Deposit redesign). **Booking.serviceId KHÔNG bị DROP.**

### Demo (seed-demo.ts) — `BK-100030` (3 dịch vụ)
1 Booking · DMK Enzyme (83′) + Laser Pico (30′) + Recovery (20′, ghi chú tùy chọn) = **tổng 133′**, KTV
Phạm Chuyên Viên · Phòng 1 (dùng chung). Guard idempotent `if (svcDmk && !BK-100030)`.

### Chứng minh (test/booking-multiservice.test.ts, 7 test HTTP thật)
A legacy 1 dịch vụ (dual-read → 1 item ảo, totalDuration đúng) · B 1 Booking→3 item đúng sortOrder + DB +
serviceId=item đầu + duration=Σ + priceSnapshot · D+E reorder + add/remove (thay toàn bộ) · G đổi
Service.duration sau → durationSnapshot KHÔNG đổi · H RBAC (thiếu booking.write→403, ẩn danh→401) · I
list 1 booking = 1 card kèm items · J backfill idempotent (2 lần không trùng) + validation serviceId→422.

### Coexistence & CHƯA làm (đúng ranh giới)
- **KHÔNG đụng:** conflict engine, resource/staff model, RBAC/finance (Mục 15), Pricing/Invoice/Deposit,
  TreatmentPlan, Session, sidebar, nav. **KHÔNG auto-expand Protocol SERVICES → BookingItems** (P3 chỉ
  dịch vụ lẻ). Không CONFLICT với baseline Mục 2–16 + P1 + P2.
- **Chưa làm (P4):** Actual Session chọn phương án SOP + snapshot + trừ tồn theo phương án; song song
  (parallel) nhiều dịch vụ; tách buổi từ protocol nhiều dịch vụ (thuộc phase Plan).

## BUSINESS REDESIGN — Phase 4 · Actual Treatment Session (execution + snapshot + inventory) (v0.24.0)

Khi khách ĐẾN thực hiện: tạo/tiếp tục `TreatmentSession`, chọn **phương án thực tế**, **đông cứng
snapshot bất biến**, ghi **tiêu hao vật tư THỰC TẾ** (idempotent + reversal ledger). Giữ 1:1 Booking↔Session;
multi-service visit → 1 Session + N `SessionExecutionItem`. Thuần **additive**. Migration
**`U_session_execution`** (0 phá hủy; `ALTER planId DROP NOT NULL` là relax-constraint an toàn; tổng **31
migration**). tsc sạch · build OK.

### 4 quyết định người dùng đã chốt
1. **`TreatmentSession.planId` NULLABLE** (walk-in/dịch vụ lẻ không cần phác đồ; KHÔNG auto-tạo ad-hoc plan).
2. **ProtocolLoop classification DEFER** — repo chưa có `STANDARD/WITHIN_ALLOWED_VARIATION/OUTSIDE_STANDARD_
   REVIEW_REQUIRED`; **KHÔNG build policy**, chỉ để field `classification=null` trong snapshot (không tự tính).
3. **Inventory reversal/idempotency additive fix** — KHÔNG hard-delete: idempotencyKey (unique) + ledger
   REVERSAL/ADJUSTMENT + reversalOfUsageId + reversedAt/By/reason.
4. **KHÔNG thêm permission mới** (dùng lại treatment.write/editCompleted/material.write/finance.read).

### Migration & schema (`U_session_execution`)
- `TreatmentSession`: `planId String?` (nullable) + `executionFrozenAt DateTime?` + `executionSnapshot Json?`
  + quan hệ `executionItems`. Relation `plan TreatmentPlan?`.
- Model **`SessionExecutionItem`** (`session_execution_items`): sessionId, bookingItemId?(soft), serviceId,
  sortOrder, `selectedOptionSource` (enum **ExecutionOptionSource** SERVICE_SOP_OPTION/PROTOCOL_VARIANT/
  PRACTITIONER_ADHOC), selectedOptionId?, selectedOptionName?, sourceVersion?, `executionSnapshot Json?`
  (BẤT BIẾN), actualStartAt?/actualEndAt?, note?. FK session Cascade, service Restrict, bookingItem SetNull.
- `MaterialUsage` +`usageType` (enum **MaterialUsageType** CONSUMPTION/REVERSAL/ADJUSTMENT) +`idempotencyKey`
  (@unique) +`reversalOfUsageId` (self-rel) +`reversedAt/reversedBy/reversalReason`. Back-relations
  `Service.executionItems`, `BookingItem.executions`.

### Backend
- **`src/lib/session-execution.ts`**: `buildExecutionSnapshot` (reuse `sopSnapshot` P1 + phương án + qtyStd
  vs qtyActual; `classification=null`), `buildSessionSnapshot` (roll-up khi freeze), include helpers.
- **`spa-material-service.ts`**: `consumeFrom*` nhận `idempotencyKey` → **idempotent** (POST trùng key trả
  usage cũ, không trừ kho lần 2; race → unique-violation → trả bản đã có). `reverseUsage(id,{reason})` **viết
  lại KHÔNG phá hủy**: giữ CONSUMPTION gốc, tạo record REVERSAL (costAllocated âm để net), cộng tồn (FOR
  UPDATE), set `reversedAt` (chặn hoàn tác 2 lần), lý do bắt buộc.
- API: `POST/GET /api/session-executions` (+`[id]` PATCH metadata/DELETE — snapshot BẤT BIẾN, sửa completed
  cần editCompleted+lý do) · `/api/treatment-sessions` POST (walk-in: planId null + customerId/bookingId,
  KHÔNG auto-plan) · `[id]` PATCH freeze `executionSnapshot` khi COMPLETED (idempotent, KHÔNG auto-deduct) ·
  `/api/material-usages` POST (+idempotencyKey) · **`/api/material-usages/[id]/reverse`** POST.
- Audit: `SESSION_OPTION_SELECTED`, `SESSION_SNAPSHOT_FROZEN`, `SESSION_EXECUTION_CHANGED`, `SESSION_COMPLETED`,
  `MATERIAL_USAGE_POSTED`, `MATERIAL_USAGE_REVERSED`. Giá vốn/`costAllocated` mask theo `finance.read`.

### UI — `/sessions/[id]` khối C
`components/session-executions.tsx`: liệt kê **dịch vụ thực tế đã làm** (phương án + version snapshot + qty
**chuẩn nguồn → thực tế**) + form thêm (chọn dịch vụ → phương án SOP → qtyStd/qtyActual) → đông cứng snapshot.
Nhãn phân biệt **Đã đặt** (BookingItem) vs **Thực hiện thực tế**.

### Chứng minh (test/session-execution.test.ts, 10 test HTTP thật → 20 tiêu chí A–T)
A legacy read (không fabricate snapshot) · B walk-in planId null (không auto-plan) · C+D 1 Booking/3 item →
1 Session/3 exec, BookingItem KHÔNG mutate · E+F+G+H actual≠recommended + snapshot frozen + Service bump
v1→v2 KHÔNG đổi snapshot cũ + qtyStd≠qtyActual · J+K trừ theo actual + idempotency chống double-deduct ·
L+M reversal ledger (giữ bản gốc, có REVERSAL) + chặn hoàn tác 2 lần · N completion retry no double-effect +
freeze · O sửa completed cần lý do+audit · P+Q RBAC 401/403 · R finance mask · S plan session regression.

### Demo (seed-demo.ts) — `SS-100030` walk-in
Từ `BK-100030` (P3, 3 dịch vụ) → 1 TreatmentSession **planId NULL** (walk-in) + 3 `SessionExecutionItem`
đông cứng; item DMK chọn **Enzyme #1 thực tế (khác đề xuất #2)**, **qtyStd 5g → qtyActual 4g**.

### Coexistence & giới hạn (đúng ranh giới)
- **KHÔNG đụng:** Pricing/Invoice/Deposit/Booking.price semantics (per-item priceSnapshot vẫn chỉ là metadata),
  conflict engine/resource allocation, RBAC matrix/nav, Booking↔Session 1:1, không auto-expand Protocol→BookingItems,
  không rewrite legacy session. **KHÔNG CONFLICT mới** ngoài 4 đã quyết.
- **Giới hạn còn lại:** classification/policy engine (defer); ADJUSTMENT enum có sẵn nhưng chưa mở UI; snapshot
  media/chữ ký vẫn theo cơ chế cũ; song song nhiều dịch vụ chưa hỗ trợ (P3 sequential).

## BUSINESS REDESIGN — P1–P4 CLOSURE (nghiệm thu xuyên suốt) (v0.24.0)

Vòng CLOSURE end-to-end cho toàn bộ redesign (P1 Service SOP · P2 Protocol compose · P3 Booking
multi-service · P4 Actual Session). **Chỉ THÊM test** (`test/redesign-closure.test.ts`, 10 test) — KHÔNG
đổi business logic, KHÔNG mở feature/Pricing/Sidebar/ProtocolLoop. **323 test / 41 file PASS** (313 + 10).
tsc sạch · build OK · 31 migration up-to-date.

### Sơ đồ entity/relation cuối (P1–P4)
```
Service ─1:N→ ServiceStep ─1:N→ ServiceStepProduct / ServiceStepTechnology / ServiceStepOption   (P1 SOP)
Service.version (bump khi sửa SOP)
BrandProtocol (compositionMode: LEGACY_STEPS | SERVICES)
   ├ LEGACY_STEPS → steps Json  (giữ nguyên)
   └ SERVICES     → 1:N ProtocolService → Service (reference, KHÔNG clone SOP)   (P2)
Booking ─1:N→ BookingItem → Service   (P3; Booking.serviceId = item[0], resources ở Booking-level)
Booking ─1:1→ TreatmentSession (bookingId @unique; planId NULLABLE walk-in)
TreatmentSession ─1:N→ SessionExecutionItem → Service (+bookingItem soft, executionSnapshot BẤT BIẾN)  (P4)
TreatmentSession ─1:N→ MaterialUsage (CONSUMPTION append-only + REVERSAL ledger, idempotencyKey unique)
```

### Acceptance matrix (A–V) — evidence: test/redesign-closure.test.ts + các test P1–P4
A Service SOP · B Protocol compose · C Legacy protocol · D Booking multi-service · E Legacy booking dual-read ·
F Session multi-service (1:1) · G Walk-in (planId null) · H Plan-based regression · I Option selection ·
J Standard vs actual (5g/4g) · **K Snapshot immutable** (sửa Service name+SOP+option+product → executionSnapshot
byte-for-byte KHÔNG đổi, DB evidence) · L Inventory actual usage · M idempotency · N Reversal ledger (giữ gốc +
chặn 2 lần) · O Completion retry no double-effect · P Completed-session edit (lý do+audit+403) · Q RBAC ·
R Finance privacy (costAllocated=null non-finance) · S Audit trail (7 sự kiện + không log secret) ·
T DB invariants (0 orphan LEFT JOIN, unique Booking↔Session, reversal link, legacy tồn tại) · U UI workflow ·
V Full regression 323/41.

### Migration safety (P1–P4)
| Migration | Additive | Relax constraint | Destructive |
|---|---|---|---|
| R_service_steps | 17 | 0 | 0 |
| S_protocol_services | 7 | 0 | 0 |
| T_booking_items | 5 | 0 | 0 |
| U_session_execution | 18 | 1 (`planId DROP NOT NULL`) | 0 |

`planId DROP NOT NULL` = **relax constraint** (không mất dữ liệu), KHÔNG phải destructive. 0 DROP TABLE/COLUMN/
TRUNCATE/DELETE/reset trên cả 4 migration.

### Limitations (giữ nguyên — KHÔNG fix trong closure)
ProtocolLoop classification/policy DEFER · Service historical version table chưa có (serviceVersionSnapshot chỉ
marker; snapshot bất biến ở Session executionSnapshot) · multi-service **sequential only** · ADJUSTMENT enum
chưa mở UI · **regression suite dùng chung DB test — KHÔNG chạy song song** (2 run đồng thời gây race giả, chạy
đơn lẻ 323/41 sạch).

### Kết luận: ✅ **P1–P4 CLOSURE PASS**

## PRICING / COSTING — PH1: SERVICE COSTING FOUNDATION (v0.25.0)

Nền tảng **GIÁ VỐN dịch vụ độc lập, CÓ VERSION, TÁCH khỏi Giá sàn (Floor)**. PH1 CHỈ tính COST — **KHÔNG**
Floor/Recommended/PriceBook/BookingItem/Protocol-package/VAT. Thuần **additive, 0 DROP**. Migration
**`V_service_costing`** (2 enum + 1 bảng; 0 destructive; tổng **32 migration**). **336 test / 42 file PASS**
(baseline 323 + `test/service-costing.test.ts` 13). tsc sạch · lint 0 lỗi (chỉ warning cũ) · build OK.

### Migration & schema (`V_service_costing`)
- Enum `CostingStatus {DRAFT, PUBLISHED, SUPERSEDED}` · `CostAllocationType {MANUAL, FIXED_PER_SERVICE, PER_MINUTE}`.
- Model **`ServiceCostingVersion`** (`service_costing_versions`): `serviceId`+`version` (@@unique), `status`,
  `serviceVersionSnapshot`, `durationMinutes`; MATERIAL: `computedMaterialCost`/`materialOverride`/
  `materialOverrideReason`/`finalMaterialCost`; `laborCost`; manual `equipmentCost`/`facilityCost`/`otherCost`;
  overhead `overheadMethod`/`overheadValue`/`overheadCost`; tổng `directCost`/`totalEstimatedCost`;
  `sourceSnapshot Json` (evidence), `note`, `createdBy/At`, `publishedBy/At`, `supersedesId`. FK service **Cascade**.
- Service +relation `costingVersions` (KHÔNG đụng field cũ). **KHÔNG** đụng Floor v1/v2, PriceRule, Booking,
  Proposal, Invoice, ServiceMaterialStandard.

### Lib `src/lib/service-costing.ts` (reuse — KHÔNG clone business logic)
- **Vật tư**: `computeCostSources` dùng lại `expectedMaterialCost` (P1) = Σ `ServiceStepProduct.qty ×
  SpaProduct.cost` (SP có gắn Catalog). SP thiếu cost → **warning** (không cộng, không bịa). SOP không có SP → 0.
- **Nhân sự**: `resolveRoleFeeAverage(role, at)` = trung bình `EmployeeRoleFee` hiện hành của nhân sự ACTIVE
  (fallback `defaultFee`); staffRequirements × fee. Vai trò không có phí → **warning** (tính 0, cần khai báo).
- **Công thức (§10)**: `DirectCost = FinalMaterial + Labor + Equipment + Facility`;
  `TotalEstimatedCost = DirectCost + Overhead + Other` (`computeTotals`, unit-tested). Overhead
  `computeOverhead`: PER_MINUTE = value×minutes; MANUAL/FIXED = value.
- **Override vật tư**: `finalMaterialCost = materialOverride ?? computedMaterialCost`; override cần **lý do**
  (Zod refine → 422); KHÔNG sửa ngược ServiceStepProduct/SpaProduct.cost.
- **Version/publish**: `createCostingVersion` (DRAFT, tính từ LIVE) · `updateCostingVersion`/
  `recalculateCostingVersion` (chỉ DRAFT) · `publishCostingVersion` (DRAFT→PUBLISHED: đông cứng cột +
  `sourceSnapshot`; PUBLISHED cũ → SUPERSEDED, `supersedesId`). **Published bất biến** — sửa/recalc → 409.
- **Finance mask**: `maskCosting` che TẤT CẢ số cost + `sourceSnapshot` (chứa unitCost/fee) nếu không `finance.read`.

### API (`/api/service-costings`)
`GET ?serviceId=` (list, `pricefloor.read`, mask theo finance.read) · `POST` (tạo DRAFT, `pricefloor.write`,
trả `warnings`) · `GET/PATCH /[id]` (chi tiết + sửa DRAFT) · `POST /[id]/recalculate` · `POST /[id]/publish`.
Audit: **`SERVICE_COSTING_CREATED` / `_RECALCULATED` / `_OVERRIDE_CHANGED` / `_PUBLISHED`** (before/after, không
log secret). **RBAC reuse** `pricefloor.read`/`pricefloor.write` + `finance.read` — **KHÔNG thêm permission mới**.

### UI — trang nội bộ `/services/[id]/costing` (KHÔNG sửa sidebar/nav.ts)
Entry point: link **"Giá vốn dịch vụ (costing)"** trong modal chi tiết Dịch vụ (chỉ hiện với `finance.read`).
Cột trái danh sách version + trạng thái; cột phải **breakdown A–H** (A vật tư SOP · B nhân sự · C thiết bị ·
D cơ sở · trực tiếp · E overhead · F khác · **G tổng giá vốn** · H version/status/SOP-version/thời điểm) +
form tạo DRAFT (thiết bị/cơ sở/khác + overhead method/value + ghi đè vật tư có lý do) + Tính lại/Phát hành.
Thiếu `finance.read` → trang báo không đủ quyền (server đã mask, không dựa UI ẩn).

### Chứng minh (test/service-costing.test.ts, 13 test HTTP thật → tiêu chí A–T)
A create · **B** material từ SOP (5×100k+3×50k=650k) · **C** labor từ staffReq×roleFee (300k) · D manual
equip/facility/other · **E** overhead PER_MINUTE(1000×60=60k) & MANUAL=value · **F** total (direct 1.100k,
total 1.160k) · **G** override+lý do (final=override) · **H** override thiếu lý do→422 · **I** publish freeze +
sourceSnapshot đủ evidence · **J/K/L** đổi SpaProduct.cost / SOP quantity / EmployeeRoleFee sau publish →
v1 **BẤT BIẾN** (cột + snapshot) · **M** new draft/recalculate lấy nguồn MỚI · **N** published edit/recalc→409 ·
**O/P** finance thấy số / non-finance null (kể cả sourceSnapshot + list) · **Q** RBAC 401/403 · **R** audit 4
sự kiện không lộ secret · **S** legacy: KHÔNG ghi ngược expectedCost/floor/materialStandard · warnings SP thiếu
cost + vai trò chưa phí. **T** full regression 336/42 không regression.

### Demo (seed-demo.ts) — DMK Enzyme (DV-DMK-ENZ) costing v1 PUBLISHED
Vật tư SOP 680k (Cleanser 5×100k + Mist 3×60k) + Nhân sự KTV 200k + Thiết bị 100k + Cơ sở 50k + Overhead
PER_MINUTE 1.000₫×83′=83k = **Tổng giá vốn 1.113.000₫**. (DMK service thêm `staffRequirements` KTV — additive.)

### Coexistence & OUT OF SCOPE (đúng ranh giới PH1)
- **KHÔNG đụng**: Floor v1/`computeFloor` & v2/`ServicePriceFloorVersion` (giữ nguyên công thức + hành vi
  Booking/checkFloor), PriceRule/PriceBook, BookingItem.priceSnapshot, Proposal `acceptedSnapshot`, Invoice
  freeze, RBAC matrix/finance privacy (Mục 15), sidebar/nav, ProtocolLoop. **KHÔNG double-write** nguồn cũ.
- **Legacy** `Service.expectedCost` / `ServicePriceFloor` v1 / `ServicePriceFloorVersion` v2 / `PriceFloorCostLine`
  / `ServiceMaterialStandard` **giữ nguyên** — chỉ đánh dấu "nguồn trùng, deprecate ở phase sau" (audit §18 báo cáo).
- **Chưa làm (phase sau)**: chuẩn hóa/deprecate Floor v1↔v2, Floor tham chiếu Costing, RecommendedPrice
  (targetMargin), Package/Protocol pricing, VAT, engine khấu hao thiết bị/overhead đầy đủ, `CostAllocationProfile`
  (PH1 nhúng overhead method vào version — tối giản). `Service` chưa có **bảng lịch sử SOP** nên
  `serviceVersionSnapshot` chỉ là marker; bất biến thực nằm ở cột cost + `sourceSnapshot` của version PUBLISHED.

## PRICING / COSTING — PH2: FLOOR NORMALIZATION + COSTING REFERENCE (v0.26.0)

Chuẩn hóa Giá sàn theo **MARGIN** + cho Floor v2 **tham chiếu ServiceCostingVersion** (PH1). Tách rõ:
**Costing** = chi phí dự kiến · **FloorPrice** = giá bán thấp nhất được phép. **Owner đã phê duyệt** đổi
Floor formula/tham chiếu costing/deprecate v1 trong phạm vi PH2. Thuần **additive, 0 DROP**. Migration
**`W_floor_costing_link`** (1 enum + 2 cột nullable + FK SetNull; tổng **33 migration**). **348 test / 43 file
PASS** (336 + `test/floor-costing.test.ts` 12). tsc sạch · lint 0 lỗi · build OK.

### Migration & schema (`W_floor_costing_link`)
- Enum `FloorCostSource {COSTING_VERSION, LEGACY_LINES}`.
- `ServicePriceFloorVersion` +`serviceCostingVersionId String?` (FK → ServiceCostingVersion, **onDelete SetNull**)
  +`costSource FloorCostSource @default(LEGACY_LINES)`. Existing v2 rows backfill `LEGACY_LINES` (additive).
- Back-relation `ServiceCostingVersion.floorVersions`. **KHÔNG** đụng ServicePriceFloor v1, PriceFloorCostLine,
  PriceRule, Booking, Proposal, Invoice, permission matrix.

### Công thức chuẩn (OWNER DECISION) — MARGIN
`FloorPrice = TotalEstimatedCost / (1 − MinimumMarginRate)`, `0 ≤ rate < 1`. `computeFloorPrice` (mặc định
MARGIN) + **epsilon 1e-9 trước ceil** để bội số đúng không lệch (1.4M/0.7 = 2.000.000 chính xác, không thành
2.000.001). Legacy v1 giữ **MARKUP** cũ (`computeFloor` = total×(1+margin)) — **KHÔNG rewrite lịch sử**.

### Floor v2 tham chiếu Costing — `src/lib/price-floor-service.ts`
- **`createFloorVersionFromCosting`**: chỉ nhận Costing **PUBLISHED** (DRAFT → 422; không thuộc dịch vụ → 422;
  không tồn tại → 404). Snapshot `totalEstimatedCost` → `totalCost`; map 6 thành phần costing → 6 cột snapshot
  floor (MATERIAL=finalMaterial, STAFF=labor, MACHINE=equipment, ROOM=facility, OPERATION=overhead, OTHER=other);
  MARGIN; **KHÔNG cost lines editable** (không nhập lại 6 thành phần). Version DRAFT → dùng workflow
  submit/approve/activate hiện tại.
- **`recomputeVersion` guard**: version costing-backed KHÔNG tính lại từ lines (không có) — chỉ tính lại floor
  từ totalCost snapshot + biên. `updateFloorVersion` chặn sửa lines cho costing-backed (409). Legacy line-based
  v2 giữ nguyên hành vi.
- **Immutability**: đổi SpaProduct.cost / SOP / EmployeeRoleFee / publish Costing v2 sau → Floor cũ **bất biến**
  (totalCost + floorPrice snapshot). Muốn giá sàn mới → tạo Floor version mới tham chiếu Costing mới.

### `checkServicePriceFloor` — priority + provenance
Ưu tiên **version v2 ACTIVE** (costing-backed hay line-based đều là 1 version active duy nhất/dịch vụ) → fallback
**v1**. Trả `source`: **`V2_COSTING`** (active có serviceCostingVersionId) · **`LEGACY_V2`** (active line-based) ·
**`LEGACY_V1`** (fallback v1) · `null` (chưa khai). `serviceCostingVersionId` kèm theo. Không leak cost cho
non-finance (chỉ floorPrice guardrail như baseline).

### Below-floor / maxDiscount (giữ nguyên)
Proposal `proposalOptionFloorTotal` → `checkServicePriceFloor` (nay ưu tiên v2/costing) → below-floor cần
`pricefloor.override` + `BelowFloorApproval` (mục 6/26, **không đổi**). `maxDiscount` vẫn derived từ
`Service.standardPrice` − floorPrice (**KHÔNG đụng PriceRule/PriceBook**).

### API / UI
- API: `POST /api/price-floors/[serviceId]` — có `serviceCostingVersionId` → tạo từ Costing (PH2, khuyến nghị);
  bỏ trống → legacy line-based (tương thích). GET trả thêm `costSource`/`serviceCostingVersionId` (provenance,
  không nhạy cảm) + `publishedCostings[]` (totalEstimatedCost mask theo finance.read). Audit **`PRICE_FLOOR_CREATED`**
  + **`PRICE_FLOOR_COSTING_LINKED`** (create costing-based); **`PRICE_FLOOR_PUBLISHED`** + **`PRICE_FLOOR_SUPERSEDED`**
  (khi activate).
- UI `/price-floor/[serviceId]`: panel **"Tạo giá sàn từ Giá vốn (khuyến nghị)"** (chọn Costing PUBLISHED +
  biên → tạo); version costing-backed hiển thị breakdown **read-only snapshot** + link **"Xem Giá vốn"**
  (`/services/[id]/costing`), KHÔNG cho sửa cost lines. Reuse RBAC `pricefloor.read/write/approve/override` +
  `finance.read` (**KHÔNG thêm permission**).

### Chứng minh (test/floor-costing.test.ts, 12 test HTTP+lib → A–U)
A+B+C+H tạo từ Costing + MARGIN chuẩn (1.2M/0.7=1.714.286) + snapshot cost + 0 cost lines · B pure (1.4M/0.7=
2.0M exact) · D draft costing→422 · E missing→404 · **F+G** immutable (Costing đổi/thêm v2 → Floor cũ giữ,
Floor mới dùng Costing mới) · **K** checkServicePriceFloor source=V2_COSTING · **J** legacy line-based v2 =
LEGACY_LINES/LEGACY_V2 vẫn chạy · **I+L** chỉ v1 → LEGACY_V1 + v1 row bất biến (MARKUP không rewrite) · **M+N**
proposalOptionFloorTotal dùng floor mới (below-floor đúng) · edge margin âm/≥100/costing khác dịch vụ→422 ·
**P+Q** finance mask (non-finance totalCost/breakdown/publishedCostings=null) + RBAC 401/403 · **R** audit
CREATED/COSTING_LINKED/PUBLISHED. **S/N/O/U** (Booking/Proposal/Invoice/P1–P4) không regression qua full suite.

### Demo (seed-demo.ts) — DMK: Costing v1 → Floor từ Costing
Giá vốn DMK v1 1.113.000₫ → **Giá sàn DMK từ Costing** biên 30% = **1.590.000₫** (ACTIVE, `costSource=COSTING_VERSION`).

### Coexistence & OUT OF SCOPE (đúng ranh giới PH2)
- **KHÔNG đụng** (đã regression xanh): `Booking.price`/`BookingItem.priceSnapshot`/`resolvePrice`,
  `Service.standardPrice`/PriceRule/PriceBook/segment resolver, Proposal `acceptedSnapshot`, Invoice freeze,
  ROLE_PERMISSIONS/Mục 15. **KHÔNG historical rewrite**: v1/v2 cũ + maxDiscount + BelowFloorApproval + snapshot
  giữ nguyên; MARGIN mới chỉ áp version v2 tạo sau PH2.
- **Legacy v1**: KHÔNG DROP/DELETE; vẫn GET/validate qua fallback; UI không khuyến khích tạo mới v1 (đường tạo
  mới dùng Costing). **Legacy v2 line-based**: giữ nguyên, vẫn tạo/sửa được (tương thích test v2).
- **Chưa làm (phase sau)**: RecommendedPrice/targetMargin, Package/Protocol pricing, BookingItem snapshot fix
  (segment vs list — PH4), VAT, engine khấu hao/overhead. Floor override tường minh (calculated vs manual floor)
  chưa mở rộng — costing-backed dùng MARGIN thuần; MANUAL floor chỉ ở legacy path.

## PRICING / COSTING — PH3: RECOMMENDED PRICE / TARGET MARGIN (v0.27.0)

Lớp **GIÁ ĐỀ XUẤT** độc lập (decision-support): "với giá vốn + biên MỤC TIÊU, nên bán ở mức nào?". KHÁC
Floor (giá bán tối thiểu / minimum margin) và KHÁC PriceRule (giá bán thực tế theo segment). Thuần
**additive, 0 DROP**. Migration **`X_recommended_price`** (1 bảng; 0 destructive; tổng **34 migration**).
**360 test / 44 file PASS** (348 + `test/recommended-price.test.ts` 12). tsc sạch · lint 0 lỗi · build OK.

### Migration & schema (`X_recommended_price`)
- Model **`ServiceRecommendedPriceVersion`** (`service_recommended_price_versions`): `serviceId`+`version`
  (@@unique), `serviceCostingVersionId` (FK → ServiceCostingVersion, **onDelete Restrict**), `status`
  (**dùng lại enum `CostingStatus`** DRAFT/PUBLISHED/SUPERSEDED), `targetMarginPercent`, `costSnapshot`,
  `roundingUnit`, `calculatedRecommendedPrice`, `floorVersionId?`+`floorPriceSnapshot?` (evidence ràng buộc),
  `note`, `createdBy/At`, `publishedBy/At`, `supersedesId`. **KHÔNG** đụng Costing/Floor/PriceRule/Service.

### Công thức + ràng buộc — `src/lib/recommended-price.ts`
- **MARGIN mục tiêu**: `RecommendedPrice = TotalEstimatedCost / (1 − targetMargin%)` (dùng lại
  `computeFloorPrice` MARGIN + epsilon). `targetMargin`: 0 ≤ % < 100 (Zod max 99.99 → âm/≥100 = 422).
- **Nguồn**: chỉ `ServiceCostingVersion` **PUBLISHED** (DRAFT→422, sai dịch vụ→422, không có→404). KHÔNG dùng
  expectedCost / floor lines / expectedMaterialCost live / PriceRule.
- **Ràng buộc Floor (QUYẾT ĐỊNH: VALIDATION, không clamp — giữ đúng semantics biên mục tiêu):** khi có Floor
  ACTIVE → **§5** `targetMargin ≥ minMargin(floor)` (else 422) VÀ **§6** `recommended ≥ floorPrice` (else 422);
  snapshot `floorVersionId`+`floorPriceSnapshot`. Không có Floor → không ràng buộc.
- **Versioning**: DRAFT (sửa/tính lại) → PUBLISHED (đông cứng snapshot + re-validate Floor) → cũ SUPERSEDED.
  PUBLISHED bất biến (PATCH/recalculate → 409). `priceComparisonBand` (derived §13: BELOW_FLOOR /
  BETWEEN_FLOOR_AND_RECOMMENDED / AT_OR_ABOVE_RECOMMENDED — chỉ hiển thị, không policy/enum DB).

### Finance privacy (§15) + RBAC
- `maskCosting`-style: che **`targetMarginPercent` + `costSnapshot`** nếu không `finance.read`;
  `calculatedRecommendedPrice` giữ visibility như Floor (guardrail). Non-finance KHÔNG suy được cost (margin
  ẩn). Áp ở SERVER (list + detail).
- Reuse `pricefloor.read` (GET) + `pricefloor.write` (POST/PATCH/publish/recalculate) + `finance.read` —
  **KHÔNG thêm permission, KHÔNG sửa ROLE_PERMISSIONS**.

### API / UI
- API: `/api/recommended-prices` (GET?serviceId / POST) · `/[id]` (GET/PATCH) · `/[id]/recalculate` ·
  `/[id]/publish`. Audit **`RECOMMENDED_PRICE_CREATED`/`_RECALCULATED`/`_PUBLISHED`/`_SUPERSEDED`**.
- UI nội bộ `/services/[id]/recommended-price` (KHÔNG sửa sidebar/nav): so sánh **Costing / Floor ACTIVE /
  Recommended / Standard** + banner vị trí giá chuẩn (KHÔNG tự sửa standardPrice) + tạo/tính lại/phát hành +
  ràng buộc Floor hiển thị. Entry link trong modal Dịch vụ + màn Giá vốn. Thiếu `finance.read` → báo không đủ quyền.

### Chứng minh (test/recommended-price.test.ts, 12 test → A–V)
A+C+H tạo + MARGIN (1.2M/0.6=2.0M) + rounding · B costing PUBLISHED bắt buộc (DRAFT/sai dịch vụ→422) · D+E
margin âm/≥100→422 · **F+G** ràng buộc Floor (target<minMargin→422; target≥floor OK & recommended≥floor;
target=floorMargin → recommended=floorPrice) · I publish freeze · **J+K** immutable (đổi Product.cost /
publish Costing v2 → Recommended v1 KHÔNG đổi) · **L** new Recommended dùng Costing mới · M published edit→409 ·
**N+O+P** không double-write (Service.standardPrice / PriceRule count 0 / Floor row KHÔNG đổi) · **Q** finance
mask (targetMargin/costSnapshot null; giá đề xuất hiện) · **R** RBAC 401/403 · **S** audit 3 sự kiện. **T/U/V**
(Proposal/Booking/Invoice + PH1/PH2 + P1–P4) không regression qua full suite 360/44.

### Demo (seed-demo.ts) — DMK: Costing → Floor → Recommended → Standard
Giá vốn 1.113.000₫ → Giá sàn 1.590.000₫ (biên 30%) → **Giá đề xuất 1.855.000₫** (biên mục tiêu 40%,
PUBLISHED) · Giá chuẩn 2.500.000₫. Minh họa 4 mức giá tách bạch.

### Coexistence & OUT OF SCOPE (đúng ranh giới PH3)
- **KHÔNG double-write** (đã regression + test N/O/P): `Service.standardPrice`, PriceRule, Floor, Costing,
  Proposal `acceptedSnapshot`, Booking, Invoice. Recommended Price là domain riêng, chỉ đọc.
- **KHÔNG đụng** Mục 15 permission/finance privacy, sidebar/nav, ProtocolLoop.
- **Chưa làm (phase sau)**: auto-write Recommended → PriceRule; Package/Protocol pricing; BookingItem snapshot
  fix (segment vs list — PH4); Proposal/Invoice redesign; VAT; pricing-psychology rounding. Comparison band là
  derived display, không thành policy/permission.

## PRICING / COSTING — PH4: BOOKINGITEM PRICE SNAPSHOT CONSISTENCY (v0.28.0)

Sửa inconsistency đã audit (**owner-approved**): trước đây `Booking.price` = `resolvePrice(segment)` nhưng
`BookingItem.priceSnapshot` = `Service.standardPrice` (list) → multi-service lệch nguồn. PH4: **mỗi
BookingItem snapshot giá theo CÙNG bối cảnh segment khách** với Booking. Thuần **additive, 0 DROP**. Migration
**`Y_booking_item_price_source`** (3 cột nullable; tổng **35 migration**). **371 test / 45 file PASS** (360 +
`test/booking-item-pricing.test.ts` 11). tsc sạch · lint 0 lỗi · build OK.

### Migration & schema (`Y_booking_item_price_source`)
- `BookingItem` +`priceSource String?` (PRICE_RULE | STANDARD_FALLBACK | EXPLICIT) +`priceRuleId String?`
  +`priceTypeSnapshot String?` (STANDARD/BRANCH/MEMBER/VIP/CAMPAIGN/CUSTOM). Nullable → legacy null.
  `priceSnapshot` giữ nguyên cột (nay = giá bán resolve theo segment, bất biến). **KHÔNG** đụng model khác.

### Bối cảnh giá thống nhất — `src/lib/booking-items.ts`
- `BookingPricingContext {at, branch, customerGroup}` dùng CHUNG cho Booking.price và mọi BookingItem.
- **`snapshotBookingItems(items, ctx)`**: mỗi item — nếu input có `priceSnapshot` (client gửi lại giá item
  CŨ) → **GIỮ nguyên** (bất biến, priceSource=EXPLICIT); ngược lại `resolvePrice("SERVICE", serviceId,
  {at, branch, types: priceTypesForCustomer(group)})` → PRICE_RULE (+ruleId+priceType); không có rule →
  `Service.standardPrice` (STANDARD_FALLBACK). **Reuse resolver hiện có** (KHÔNG viết resolver thứ hai).
- **`bookingItemsTotal(items)`** = Σ priceSnapshot (derived §5) — GET trả `itemsTotal`. **KHÔNG** ghi đè Booking.price.

### Routes
- `POST /api/bookings`: fetch `customer.group` → `pricingCtx`; `snapshotBookingItems(items, ctx)`;
  **Booking.price cũng resolve theo cùng segment** (thêm `types`) → Booking.price = item[0] khớp nhau (§11).
  Booking.price GIỮ semantics = giá dịch vụ CHÍNH (KHÔNG phải tổng, §4). Audit **`BOOKING_ITEM_PRICE_SNAPSHOTTED`**
  (per-item priceSnapshot/priceType/priceSource/ruleId — **không log cost**).
- `PATCH /api/bookings/[id]`: replace-all items dùng ctx segment; item CŨ mang `priceSnapshot` (client gửi
  lại) → giữ; item MỚI/đổi service → resolve hiện tại. **Đổi customer KHÔNG auto-reprice** item cũ (preserve —
  option A an toàn §10/§26). Audit `BOOKING_ITEMS_CHANGED` kèm provenance.
- `GET /api/bookings/[id]`: trả `itemsTotal` (derived). Legacy dual-read (`itemsForRead`) giữ Booking.price,
  **KHÔNG re-resolve live** (§16/§M).

### Chứng minh (test/booking-item-pricing.test.ts, 11 test → A–W)
A khách thường → STANDARD rule (resolver, không lấy standardPrice khi có rule) · B VIP → VIP rule · **C+D+F**
1 Booking 3 dịch vụ VIP: mọi item cùng context VIP (2.1/1.5/0.5M), `itemsTotal`=Σ=4.1M, **Booking.price=item[0]
2.1M ≠ tổng** · E không rule → STANDARD_FALLBACK=standardPrice · **G+H+K** đổi PriceRule sau → item cũ BẤT
BIẾN, booking mới lấy giá mới, GET không re-resolve · **I** add item sau (item cũ gửi lại giá → giữ; item mới
resolve hiện tại) · **J** đổi service item → reprice · **L+M** legacy booking (không item) dual-read dùng
Booking.price không re-resolve, không ghi DB · **N** PriceRule precedence VIP>STANDARD không đổi · **P**
RecommendedPrice KHÔNG dùng làm fallback bán (item=standardPrice, không phải recommended) · **T+U** RBAC
401/403 + audit. **Q/R/S/V/W** (Proposal/Invoice/finance-privacy/PH1–PH3/P1–P4) không regression qua full suite.

### UI — `/bookings` (không sửa sidebar/nav)
Chi tiết lịch (multi-service): mỗi item hiện **tên + badge loại giá (VIP/MEMBER…) + giá snapshot** + dòng
**Tổng dịch vụ** (= Σ item). Booking.price vẫn là giá dịch vụ chính (legacy). Không hiển thị cost/margin.

### Demo (seed-demo.ts) — BK-100040 (khách VIP)
PriceRule VIP: DMK 2.100.000₫, Laser Pico 1.500.000₫. Khách `KH-100010` (VIP) → booking 2 dịch vụ: item DMK
2.1M + Laser 1.5M = **tổng 3.600.000₫** (item theo giá VIP); `Booking.price` = DMK 2.1M (dịch vụ chính).

### Coexistence & OUT OF SCOPE (đúng ranh giới PH4)
- **KHÔNG đụng** (đã regression): PriceRule model/precedence semantics (reuse resolver), PriceBook, Proposal
  `acceptedSnapshot`, Invoice freeze, Floor/Recommended, permission matrix/finance privacy (Mục 15), Booking
  resources/staff, sidebar/nav, ProtocolLoop. RecommendedPrice KHÔNG làm fallback bán.
- **Consequence được ghi rõ**: `Booking.price` nay resolve theo segment (thêm `types`) để nhất quán với item —
  chỉ đổi hành vi khi trước đây một rule segment bị áp sai cho khách không đủ điều kiện (correctness fix trong
  phạm vi thống nhất được duyệt). Semantics "Booking.price = giá dịch vụ chính, không phải tổng" GIỮ NGUYÊN.
- **Customer-change**: quyết định **preserve** (không auto-reprice item cũ); "reprice toàn bộ khi đổi khách/
  membership" là feature riêng — OUT OF SCOPE. **Chưa làm**: Package/Protocol pricing, Recommended→PriceRule,
  reprice action toàn booking, VAT.

## PRICING / COSTING — PH5: PROTOCOL / PACKAGE PRICING (v0.29.0)

Giá vốn / giá sàn / giá đề xuất cấp **GÓI** cho Protocol `compositionMode = SERVICES`. Package cost ≠ tổng
retail; package selling price ở PriceBook (PriceRule PACKAGE). Thuần **additive, 0 DROP**. Migration
**`Z_protocol_pricing`** (3 bảng; 0 destructive; tổng **36 migration**). **382 test / 46 file PASS** (371 +
`test/protocol-pricing.test.ts` 11). tsc sạch · lint 0 lỗi · build OK.

### Audit gap (đã xác nhận bằng code)
`PriceRule.targetType=PACKAGE` tồn tại nhưng `targetId` là **soft-string** (UI `/pricing` nhập tay — CHƯA link
Protocol). `ProposalItem BRAND_PROTOCOL` map `null` target → không auto giá. Chưa có floor/costing cấp gói.
**Quyết định (additive, không đổi schema PriceRule):** dùng `targetId = protocolId` cho PACKAGE rule.

### Migration & schema (`Z_protocol_pricing`) — dùng lại enum `CostingStatus`
- **`ProtocolCostingVersion`**: serviceCostTotal (Σ required), packageSpecificCost (+reason), totalEstimatedCost,
  sourceSnapshot (components[] có serviceCostingVersionId), version/status/publish.
- **`ProtocolFloorPriceVersion`**: FK costing, minMarginPercent, costSnapshot, floorPrice (MARGIN), version.
- **`ProtocolRecommendedPriceVersion`**: FK costing, targetMarginPercent, calculatedRecommendedPrice,
  floorVersionId?/floorPriceSnapshot? (ràng buộc). Cả 3 FK costing **onDelete Restrict**; @@unique[protocolId, version].

### Lib `src/lib/protocol-pricing.ts`
- **Component cost (§3,§4):** mỗi ProtocolService resolve **ServiceCostingVersion PUBLISHED** (activeCostingVersion,
  PH1). Required thiếu costing PUBLISHED → **422**. `serviceCostTotal = Σ required components`.
- **Optional (§16 owner decision):** base = **required only**; optional ghi trong snapshot `included:false`,
  KHÔNG cộng (warning). Chưa có package-variant model (báo limitation).
- **Package-specific (§5):** manual + lý do bắt buộc khi >0 + audit.
- **Total (§6):** `totalEstimatedCost = serviceCostTotal + packageSpecificCost`.
- **Floor (§8) / Recommended (§9):** MARGIN `cost/(1−margin%)` từ ProtocolCostingVersion PUBLISHED; recommended
  ràng buộc target ≥ floor minMargin + recommended ≥ floor (422). Versioning DRAFT→PUBLISHED→SUPERSEDED, bất biến.
- **Selling (§10,§11):** `resolvePackagePrice` = `resolvePrice("PACKAGE", protocolId, {types})` (reuse resolver).
  `packageRetailComparison` = Σ retail dịch vụ required vs giá gói (derived, không sửa PriceRule).
- Finance mask: cost/margin/sourceSnapshot/components che theo `finance.read`.

### Proposal integration (additive — §12,§13,§28)
- `resolveItemPricing`: **BRAND_PROTOCOL** → selling = PriceRule PACKAGE (targetId=protocolId), cost =
  ProtocolCostingVersion PUBLISHED total. KHÔNG fallback retail cho gói. (Trước null → nay resolve nếu có rule;
  không rule = giữ null → tương thích.)
- `proposalOptionFloorTotal`: thêm nhánh **BRAND_PROTOCOL** dùng ProtocolFloorPriceVersion PUBLISHED (inline,
  tránh vòng import). Below-floor gói đi qua BelowFloorApproval hiện có — **KHÔNG đổi acceptedSnapshot/Invoice**.

### API / UI
- API: `/api/protocol-costings` (GET/POST, [id] GET/PATCH, /publish, /recalculate) · `/api/protocol-floor-prices`
  (GET/POST, [id]/publish) · `/api/protocol-recommended-prices` (GET/POST, [id]/publish) ·
  `/api/protocol-pricing/[protocolId]` (tổng hợp cho UI). Audit `PROTOCOL_COSTING_*`/`PROTOCOL_FLOOR_*`/
  `PROTOCOL_RECOMMENDED_*`. Reuse `pricefloor.read/write` + `finance.read` — **KHÔNG thêm permission**.
- UI nội bộ `/protocols/[id]/pricing` (chỉ SERVICES + finance.read): so sánh **Giá vốn/Floor/Recommended/
  PriceBook + Σ retail + tiết kiệm** + tạo/phát hành 3 domain. Entry link header Protocol. Không sửa sidebar/nav.

### Chứng minh (test/protocol-pricing.test.ts, 11 test → A–X)
A+B+C+D+E costing (required 2.7M, optional bỏ, package-specific 0.1M, total 2.8M) · **F** required thiếu
ServiceCosting PUBLISHED→422 · **G+H** publish immutable (đổi ServiceCosting sau → package v1 KHÔNG đổi;
snapshot component) · **I** floor MARGIN 2.8M/0.7=4.0M · **J+K** recommended 2.8/0.6 + target<floorMargin→422 ·
**L+M** PriceRule PACKAGE STANDARD/VIP theo segment · **N** Σ retail ≠ package · **O+P** proposal BRAND_PROTOCOL
dùng package price + package floor below-floor · **S** legacy LEGACY_STEPS→422 (không ép) · **T+U** finance mask
+ RBAC 401/403 · **V** audit 6 sự kiện. **W/X** (PH1–PH4 + P1–P4) không regression qua full suite 382/46.

### Demo (seed-demo.ts) — PROTO-PIGMENT-COMBO
Required DMK (1.113M) + Laser Pico (0.9M) + package-specific 0.1M = **giá vốn gói 2.113.000₫** → **sàn
3.019.000₫** (30%) → **đề xuất 3.522.000₫** (40%). Recovery optional (không cộng). PriceBook gói: Standard
5.000.000₫ / VIP 4.700.000₫ (PriceRule PACKAGE, targetId=protocolId).

### Coexistence & OUT OF SCOPE (đúng ranh giới PH5)
- **KHÔNG đụng** (regression xanh): ServiceCosting/Floor/Recommended (PH1–PH3), PriceRule model/precedence
  semantics (reuse resolver), BookingItem snapshot (PH4), Proposal acceptedSnapshot / Invoice freeze, permission
  matrix (Mục 15), sidebar/nav, ProtocolLoop, Service SOP. **KHÔNG double-write**.
- **Chỉ SERVICES protocol**; LEGACY_STEPS giữ nguyên (422 khi tạo giá gói — không migrate/ép).
- **Chưa làm (phase sau)**: allocation package price → BookingItem (P5 KHÔNG auto chia); package-variant engine
  (optional-in-base) — base = required only; auto-write Recommended → PriceRule; VAT. Package-below-floor ở
  Booking chưa mở (mới ở Proposal). Service chưa có bảng lịch sử SOP → serviceVersionMarker chỉ đối chiếu.

## IA-PH1: SIDEBAR REGROUP + RENAME (v0.29.1) — nav-only, 0 backend

Sắp xếp lại sidebar theo **HÀNH TRÌNH KHÁCH HÀNG** (owner-approved). Thuần **regroup/reorder/rename trong
`src/lib/nav.ts`** — **KHÔNG đổi route, permission, ROLE_PERMISSIONS, backend, migration, entity**. **0 migration**.
**394 test / 47 file PASS** (382 + `test/nav-ia.test.ts` 12). tsc sạch · lint 0 lỗi · build OK.

### Nhóm target (8) — `NAV_GROUPS`
1. **Tổng quan** (/crm) · 2. **Khách hàng & Hành trình** (Khách hàng · Lịch hẹn · Kế hoạch điều trị · Thư viện
ảnh & Đánh giá · Báo giá · Hóa đơn · Thanh toán · CSKH & Follow-up · Công việc) · 3. **Thư viện chuyên môn**
(Dịch vụ · Protocol · Công nghệ · Thương hiệu · Sản phẩm · Biểu mẫu · Hướng dẫn chăm sóc) · 4. **Giá & Chính
sách** (Bảng giá · Giá sàn) · 5. **Marketing** · 6. **Kho & Vật tư** (4 mục) · 7. **Vận hành & Hệ thống**
(Nhân sự · Nhập khách hàng · Quản trị người dùng · Cài đặt) · 8. **Kho THNG** (giữ nguyên, env-gated).

### Thay đổi (LOW-RISK)
- **MOVE:** `Dịch vụ` (/services) → Thư viện chuyên môn (sibling Protocol) · `Bảng giá`+`Giá sàn` → Giá &
  Chính sách · `Marketing` → group riêng.
- **RENAME:** "Phác đồ" → **"Kế hoạch điều trị"** (/treatment-plans) · "Chăm sóc khách hàng" → **"CSKH &
  Follow-up"** (/followups) · "Hình ảnh & Đánh giá" → **"Thư viện ảnh & Đánh giá"** (/before-after). Protocol
  KHÔNG đổi tên.
- **GIỮ:** Công việc (/tasks) global; Thư viện ảnh & Đánh giá global; REMOVE 0 mục.
- **Bất biến (test byte-for-byte):** route (28 href spa) + permission từng item + warehouse env gating +
  active-route highlight detail (`/services/[id]/costing|recommended-price` → Dịch vụ; `/protocols/[id]/pricing`
  → Protocol). Sidebar vẫn permission-based (Mục 15).

### Chứng minh — `test/nav-ia.test.ts` (12) + `nav-rbac.test.ts` (10, cập nhật nhãn mới)
A thứ tự 8 nhóm · B+C Dịch vụ↔Protocol sibling · D+G+I nhãn rename · E Bảng giá/Giá sàn nhóm mới · F Marketing
group riêng · H Công việc global · **J permission byte-for-byte bất biến** · **K route (href) bất biến** · L
warehouse env gating · M unauthorized ẩn · N multi-role union · O active-route detail. Full regression 394/47.

### IA-PH3 (chưa làm — để phase sau)
Rà evidence "Thư viện ảnh & Đánh giá" (/before-after) vs tab Customer 360; hàng đợi Session toàn cục; gộp
Task/CSKH; menu giá GÓI (Protocol pricing) toàn cục; đổi tên route; đổi permission. Đều là MEDIUM/HIGH —
để phase riêng, KHÔNG làm trong IA-PH2.

## IA-PH2: NESTED BILLING + GLOBAL PRICING WORKSPACE (v0.29.2) — nav + read-mode, 0 backend logic

2 thay đổi MEDIUM (nav lồng cấp + trang workspace read-only). **0 migration · 0 DROP · KHÔNG đổi
ROLE_PERMISSIONS/permission matrix/business logic Pricing PH1–5/Invoice-Payment/Proposal semantics/Customer
360/warehouse.** **412 test / 48 file PASS** (394 + `test/nav-ph2.test.ts` 18). tsc sạch · lint 0 lỗi · build OK.

### A. Nested "Hóa đơn & Thanh toán" (nav lồng cấp)
- `nav.ts`: `NavItem` thêm `children?: NavItem[]` + `href` optional (parent CÓ children bỏ trống href, chỉ
  toggle). Trong "Khách hàng & Hành trình": 2 mục phẳng **Hóa đơn** (invoice.write) + **Thanh toán**
  (payment.write) → **1 parent nested "Hóa đơn & Thanh toán"** (icon Receipt, KHÔNG href, **KHÔNG khai
  permission mới**) chứa 2 child GIỮ NGUYÊN permission.
- **Visibility parent = có ÍT NHẤT 1 child hiện** theo quyền: `canSeeNavItem` (đệ quy children) +
  `visibleNavGroups`/`filterNavItem` (giữ children được phép; parent rỗng → ẩn). RECEPTION/CASHIER (có cả
  invoice.write+payment.write) thấy đủ 2 child; MARKETING/CSKH/Chuyên viên (0 quyền billing) → parent ẩn hẳn.
- `app-shell.tsx`: tách `NavLink` (leaf) + `NavParent` (nút toggle, chevron, **tự mở khi có child active**,
  children thụt lề + border-l). Logic active leaf giữ nguyên `pathname===href || startsWith(href+"/")`.

### B. Workspace giá toàn cục — "Giá & Chính sách" thêm 2 mục
- Nav thêm **"Giá vốn & biên"** (`/service-costings`) + **"Giá bán đề xuất"** (`/recommended-prices`), perm
  any-of `["pricefloor.read", "finance.read"]` (KHÔNG permission mới). Nhãn đúng **"Giá bán đề xuất"** (không
  phải "Giá đề xuất").
- **API read-mode TỔNG HỢP (additive):** `GET /api/service-costings` và `/api/recommended-prices` khi **VẮNG
  `serviceId`** trả danh sách **mỗi dịch vụ + version PUBLISHED/mới nhất** (compose/đọc dữ liệu sẵn có, KHÔNG
  thêm entity/logic). Có `serviceId` → giữ nguyên hành vi per-service (regression). Guard `PRICEFLOOR_READ`;
  **số cost/margin mask theo `finance.read` ở SERVER** (BLOCKER) — non-finance nhận `totalEstimatedCost`/
  `directCost`/`targetMarginPercent`/`costSnapshot` = null; trang không tự suy giá vốn.
- **Trang** `/service-costings` + `/recommended-prices` (read-only): bảng dịch vụ (mã/tên/giá chuẩn/giá vốn
  hoặc giá đề xuất phát hành/version/trạng thái) + tìm kiếm + link **Chi tiết** sang trang per-service đã có
  (`/services/[id]/costing` · `/services/[id]/recommended-price`) để tạo/sửa/phát hành. Thiếu `finance.read`
  → banner cảnh báo + số liệu ẩn.

### Active-route (quyết định ghi rõ — KHÔNG pathname hack)
`/services/[id]/costing` & `/recommended-price` **giữ Dịch vụ active** (logic prefix hiện có); mục workspace
mới `/service-costings` KHÔNG kích Dịch vụ (khác chuỗi tiền tố). **Limitation chấp nhận:** trang chi tiết giá
vốn mở từ workspace vẫn highlight "Dịch vụ" ở sidebar — không đổi để tránh churn/pathname đặc biệt.

### Chứng minh (test/nav-ph2.test.ts, 18 test → A–R)
NAV unit A–K: A parent nested (children Hóa đơn/Thanh toán, KHÔNG href) · B parent hiện khi ≥1 child · C ẩn
khi 0 child · D parent KHÔNG permission mới · E+F+G entry pricing + nhãn "Giá bán đề xuất" + perm any-of ·
H filter children · I active-route (Dịch vụ vs workspace) · J CASHIER 2 child / MARKETING ẩn · K children
giữ permission. HTTP L–R (Postgres thật): L aggregate finance có totalEstimatedCost · M compose khớp
per-service · N non-finance cost=null · O RBAC 401/403 · P recommended finance/mask · Q per-service GET
regression · R aggregate CHỈ đọc (count bất biến).

### Coexistence & CONFLICT
**KHÔNG CONFLICT.** Chỉ nav presentation + read-mode compose. KHÔNG đụng: backend business logic Pricing
PH1–PH5, Invoice/Payment/Proposal semantics, ROLE_PERMISSIONS/permission matrix (Mục 15), Customer 360 tabs,
warehouse, schema/migration. Package pricing (Protocol) **KHÔNG** có menu toàn cục (đúng ranh giới — để phase
sau). Deep-link mọi route cũ giữ nguyên.

## HR-PH1: EMPLOYEE FOUNDATION + BRANCH + HR PRIVACY/RBAC (v0.30.0)

Nền HR cho các phase Chấm công/Lương thưởng sau. **Thuần additive, 0 DROP.** Migration **`Za_hr_foundation`**
(sau `Z_protocol_pricing`; tên `Za_` sắp đúng thứ tự byte sau `Z_` — dành `Zb_`, `Zc_`… cho HR-PH2+; tổng
**37 migration**). **428 test / 49 file PASS** (412 + `test/hr-foundation.test.ts` 16). tsc sạch · lint 0 lỗi ·
build OK · fresh deploy 37 migration + seed + seed:demo sạch.

### Migration & schema (`Za_hr_foundation`)
- Enum `EmploymentType` (MONTHLY/DAILY/HOURLY/CONTRACT/OTHER) — **classification, KHÔNG phải cách tính lương**.
- Model **`Branch`** (`branches`): code @unique · name · timezone? · address? · isActive · note. Master chi nhánh
  ổn định (cho Chấm công/Lương sau này).
- `Employee` +`branchId String?` (FK Branch, onDelete SetNull) +`employmentType EmploymentType?` +`endDate DateTime?`
  +`userId String? @unique` (liên kết TÙY CHỌN 1-1 tới `User`). Quan hệ `branchRef`/`user`; **`Employee.branch`
  (String) legacy GIỮ NGUYÊN** (không đổi tên/không xóa). `User` +back-relation `employee Employee?`.
- **Backfill (trong migration, deterministic):** mỗi giá trị `Employee.branch` trimmed KHÁC NHAU (case-sensitive)
  → 1 Branch (`CN-000x` theo thứ tự) → gán `branchId` khớp CHÍNH XÁC tên. **KHÔNG merge tên khác hoa/thường**
  (tránh gộp nhầm 2 cơ sở); giá trị rỗng bỏ qua; không đoán. INSERT/UPDATE — 0 lệnh phá hủy.

### Nguyên tắc BẤT BIẾN (blocker)
- **Employee ≠ User** — `userId` chỉ là liên kết tùy chọn cho self-view; **KHÔNG merge, KHÔNG suy quyền RBAC**
  từ liên kết, KHÔNG tự tạo tài khoản.
- **`EmployeeRoleFee` GIỮ NGUYÊN ngữ nghĩa** = rate giá vốn nhân công (FIXED/buổi, versioned) cho Service
  Costing/Giá sàn. **KHÔNG** redefine thành lương/hoa hồng. PayrollRate/CommissionRule là entity của phase sau.
- **finance.read ≠ payroll** — namespace HR/lương TÁCH BIỆT (test chứng minh finance.read KHÔNG suy ra payroll.read).

### RBAC (owner phê duyệt — additive, namespace mới)
Hằng số RESERVED (feature ở HR-PH2+): `attendance.read/write` · `payroll.read/write/approve` ·
`compensationPolicy.read/write` · `commission.read`. **Mapping:** MANAGER (đủ, gồm approve) · BOD (READ-ONLY:
payroll/attendance/compensationPolicy/commission read) · ADMIN (qua ALL_PERMISSIONS). **Vai trò khác KHÔNG
nhận.** Quyền cũ (Mục 15) **bất biến** (`git diff` rbac chỉ THÊM). Self-view **không dùng permission** — là
ownership theo FK `userId`.

### Self-view foundation — `src/lib/hr-self.ts`
`resolveSelfEmployee`/`resolveSelfEmployeeId`/`isSelfEmployee` — ánh xạ user→employee **CHỈ theo FK userId**,
**KHÔNG fallback tên/email** (chống mạo nhận). Dùng cho HR-PH2+ (tự xem chấm công/KPI/lương của chính mình);
CHƯA có endpoint self trong PH1.

### API / UI
- `/api/employees` (GET filter `branchId`, kèm `branchName/employmentType/endDate/hasAccount`; POST/PATCH nhận
  `branchId`+`employmentType`+`endDate`, chặn branchId không tồn tại 422) · **`/api/employees/[id]/link-user`**
  (POST link/unlink 1-1: user tồn tại, 1 user↔1 employee, audit `EMPLOYEE_USER_LINKED/UNLINKED`) ·
  **`/api/branches`** (GET `staff.read`; POST `staff.write` — **tái dùng**, không thêm `branch.manage`) +
  `/[id]` (PATCH; soft qua isActive, KHÔNG hard-delete).
- Audit: `EMPLOYEE_UPDATED` giàu hơn (branchId/employmentType/endDate before→after), `BRANCH_CREATED/UPDATED`,
  `EMPLOYEE_USER_LINKED/UNLINKED`.
- UI `/employees/[id]` tab **Thông tin**: thêm Select Chi nhánh (từ Branch active) + Hình thức làm việc + Ngày
  kết thúc + dòng trạng thái **tài khoản liên kết** (read-only). Giữ 7 tab, KHÔNG lộ tab lương. `EmploymentType`
  nhãn ở `clinic-labels.ts`. **UX chọn/gắn tài khoản (user picker) DEFER** — PH1 chỉ nền API + hiển thị trạng thái.

### Privacy classes (tài liệu)
GENERAL STAFF (tên/chức danh/năng lực) · MANAGERIAL (chấm công/KPI — PH2+) · HR/PAYROLL PRIVATE (lương/hoa
hồng/payroll — PH5+, quyền `payroll.*`) · FINANCIAL COST PRIVATE (`EmployeeRoleFee`/giá vốn — `staff.fee.read`/
`finance.read`) · EMPLOYEE SELF (chỉ của mình, theo FK). **Không trộn mask.**

### CSV contract (định nghĩa, chưa build import)
`branches.csv` (code*, name*, timezone, address) · `employees.csv` (code, fullName*, branchCode→branchId,
employmentType, startDate, endDate) · `employee_roles.csv` · `employee_role_fees.csv` (versioned — import=tạo
bản mới). KHÔNG CSV cho attendance thực tế/payroll/contribution (migration-only).

### Chứng minh (test/hr-foundation.test.ts, 16 test A–T)
RBAC unit A (quyền cũ bất biến) · B (finance.read≠payroll.read) · C (staff.fee.read≠payroll.read) · mapping HR
(MANAGER đủ/BOD read-only/vai trò thấp KHÔNG nhận) · G+H · Self-view D (resolve theo FK) · E (A≠B) · F (chưa
link→null, không fallback tên/email) · Branch I (code unique 409) · J+K (branchId hợp lệ + legacy String giữ) ·
L+M (backfill deterministic, KHÔNG merge khác hoa/thường, rỗng bỏ qua) · N (inactive filter) · O (list không
regress + field HR mới) · link-user 1-1 (gắn/gỡ + chặn 1 user 2 employee 422) · Privacy P (không field
salary/payroll) · S (mask EmployeeRoleFee giữ) · T (ẩn danh 401) · Q (finance.read KHÔNG mở HR khi thiếu
staff.read → 403).

### Demo (seed:demo)
Branch `CN-0001` "CS1"; 5 nhân sự gán `branchId` + `employmentType=MONTHLY`; **NV-000004 (Đỗ Thu Ngân) liên kết
tài khoản `thungan@sophia.com.vn`** minh họa self-view.

### Deferred HR-PH2+ (KHÔNG làm ở PH1)
AttendanceRecord/WorkShift dated/LeaveRequest-approval/overtime · SessionStaffContribution · Commission/Incentive
· PayrollPeriod/PayrollEarningLine · KPI payroll rules · user-picker UX · CSV import thật · `Employee.branch`
String vẫn giữ (chưa chứng minh gỡ an toàn).

### CONFLICTS
**Không có.** Không redefine EmployeeRoleFee · không merge Employee/User · không đổi TreatmentSession
cardinality/Invoice-Payment semantics · không tái dùng finance.read cho lương · migration additive (0 DROP).
Thêm permission HR là **owner-approved additive**; quyền cũ Mục 15 bất biến.

## HR-PH2: DATED SHIFT + ATTENDANCE + LEAVE APPROVAL (v0.31.0)

Ca làm việc theo NGÀY + chấm công thực tế + nghỉ phép có duyệt. **Thuần additive, 0 DROP.** Migration
**`Zb_hr_attendance`** (sau `Za_hr_foundation`; tổng **38 migration**). **459 test / 50 file PASS** (428 +
`test/hr-attendance.test.ts` 31). tsc sạch · lint 0 lỗi · build OK · fresh deploy 38 migration + seed + seed:demo sạch.

### Migration & schema (`Zb_hr_attendance`)
- Enums: `WorkShiftStatus` (SCHEDULED/COMPLETED/CANCELLED) · `AttendanceStatus` (OPEN/COMPLETED/ADJUSTED/VOIDED)
  · `AttendanceSource` (APP/MANUAL/DEVICE — DEVICE defer) · `AdjustmentStatus` (REQUESTED/APPLIED/REJECTED) ·
  `LeaveStatus` (PENDING/APPROVED/REJECTED/CANCELLED).
- **`WorkShift`** (`work_shifts`): ca theo NGÀY (khác `EmployeeSchedule` mẫu tuần — GIỮ NGUYÊN). employeeId,
  branchId?, scheduleId?(nguồn mẫu), workDate `@db.Date`, scheduledStartAt/EndAt (instant, cross-midnight),
  breakMinutes, shiftLabel, source, status. **`EmployeeSchedule` +back-relation `workShifts`.**
- **`AttendanceRecord`** (`attendance_records`): chấm công THỰC TẾ (có thể KHÔNG có ca — workShiftId nullable).
  checkInAt/checkOutAt (instant), breakMinutesActual, workedMinutes/scheduledMinutes/overtimeMinutes/lateMinutes/
  earlyLeaveMinutes, source, status, void*(reason/by/at). KHÔNG hard-delete.
- **`AttendanceAdjustment`** (`attendance_adjustments`): APPEND-ONLY before/after snapshot + reason + requestedBy/
  changedBy/approvedBy + status.
- **`EmployeeLeave` mở rộng additive:** +status(`@default(APPROVED)` → record cũ = APPROVED, tránh false-absent)
  +isPaid(`@default(true)`) +requestedBy/At +approvedBy/At +rejectionReason +note +updatedAt. **Dữ liệu cũ giữ.**
- **2 partial unique index** (raw SQL, additive): (1) `attendance_records(employeeId) WHERE status='OPEN'` →
  1 OPEN/nhân sự, check-in trùng = 409 (chống đua); (2) `work_shifts(employeeId,workDate,scheduleId) WHERE
  scheduleId IS NOT NULL` → sinh ca IDEMPOTENT (ca tạo tay scheduleId null không bị ràng buộc).

### Lib
- **`src/lib/attendance.ts`** (thuần): `computeAttendance` (worked/scheduled/late/early/**overtime CANDIDATE**),
  `computeScheduledMinutes`, `buildShiftInstants` (cross-midnight = +1 ngày, dùng instant KHÔNG trừ HH:mm thô),
  `generateShiftsFromSchedule` (recurring→dated, idempotent qua createMany skipDuplicates), `deriveFlags`
  (ON_TIME/LATE/EARLY_LEAVE/ABSENT/LEAVE/OPEN_ATTENDANCE/OVERTIME_CANDIDATE — display, KHÔNG quy tiền),
  `hasApprovedLeaveAt`.
- **`src/lib/attendance-service.ts`**: `checkIn` (self FK / quản lý hộ; source APP/MANUAL; scheduled+late tính
  ngay; P2002→409), `checkOut` (khóa `FOR UPDATE`, chống double-checkout; out<in→422; tính worked/OT/early),
  `manualRecord` (quản lý bù công), `adjustAttendance` (nhân viên ĐỀ NGHỊ→REQUESTED không đổi record; quản lý
  ÁP DỤNG→APPLIED + ADJUSTED; reason bắt buộc), `voidAttendance` (VOID giữ vết), `createLeaveRequest`/`decideLeave`/
  `cancelLeave` (lifecycle, không hard-delete).

### Múi giờ (tái dùng layer chung)
Instant true-UTC; dựng giờ ca từ HH:mm qua `parseVnLocal` (Asia/Ho_Chi_Minh +7 cố định). Thời lượng = hiệu
instant → độc lập TZ (cross-midnight đúng). `Branch.timezone` lưu sẵn cho đa-tz phase sau; PH2 vận hành **MỘT
múi giờ VN** (ghi rõ giới hạn — khớp mục 9/21).

### API (server-side authz)
`/api/work-shifts` (+`generate` idempotent, +`[id]` PATCH hủy=CANCELLED) · `/api/attendance` (org list
attendance.read) · `check-in`/`check-out` (self hoặc quản lý) · `manual` (attendance.write) · `me` (self,
ownership FK) · `[id]/adjustments` (GET/POST) · `[id]/void` · `/api/leave-requests` (+`[id]` GET/PATCH-cancel,
`[id]/approve`, `[id]/reject`). Existing `/api/employees/[id]/leaves` DELETE **thêm guard**: từ chối xóa cứng đơn
đã qua workflow (`requestedAt` set) → hủy qua leave-requests.

### RBAC (tái dùng PH1 — KHÔNG thêm permission)
`attendance.read` (org list/xem) · `attendance.write` (tạo ca/sinh ca/chấm tay/điều chỉnh/void/duyệt nghỉ).
**Self = ownership FK userId** (KHÔNG dùng permission; không fallback tên/email). `finance.read`/`staff.read`
đơn lẻ KHÔNG mở chấm công (test). Payroll reserved (PH1) bất biến.

### UI
Sidebar **Vận hành & Hệ thống → "Chấm công"** (`/attendance`, gate `attendance.read`). 4 tab: **Hôm nay** (thẻ
self check-in/out nếu tài khoản liên kết nhân sự) · **Ca làm việc** (list + sinh ca từ mẫu + hủy ca) · **Chấm
công** (list + chấm tay + void, cột Công/Trễ/OT*/Cờ) · **Nghỉ phép** (list + tạo/duyệt/từ chối). Nhãn ở
`clinic-labels.ts`. **Self-service check-in cho nhân viên KHÔNG có `attendance.read` = DEFER** (cần cơ chế
self-nav ngoài permission-gating — IA change; API + test đã đủ).

### Chứng minh (test/hr-attendance.test.ts, 31 test → A–AL)
Calc unit M/N/O/P/Q/R (worked/late/early/OT/cross-midnight/timezone) · Sinh ca A–F (recurring→dated·idempotent·
không ghi đè·cross-midnight·branch·cancel giữ) · Chấm công G–X (self FK·unlinked 403·A≠B·dup 409·checkout đóng·
double checkout 409·adjustment before/after+audit·reason 422·void không hard-delete·nhân viên đề nghị KHÔNG tự
duyệt) · Nghỉ Y–AD (lifecycle·duyệt/từ chối audit·paid/unpaid·approved tránh false-absent·dữ liệu cũ giữ·cancel
giữ) · RBAC AE–AL (self chỉ của mình·attendance.read workspace·attendance.write cho sửa/duyệt·finance/staff.read
KHÔNG mở·payroll reserved bất biến).

### Nguyên tắc & nợ kỹ thuật
- **Booking ≠ chấm công · WorkShift ≠ EmployeeSchedule · overtime CANDIDATE ≠ OT trả lương** (OT duyệt/tính
  tiền ở HR-PH6). Chuẩn bị cross-check Session (HR-PH3) qua timestamp/branch/workDate — CHƯA implement.
- **Chưa làm (HR-PH3+):** SessionStaffContribution · Commission/Incentive · Payroll · KPI payroll · DEVICE chấm
  công · self-service UI cho nhân viên không quyền · branch-scoped RBAC (mới lưu branchId, quyền hiện org-wide) ·
  đa-tz theo chi nhánh · CSV import ca/nghỉ (mới định nghĩa contract).

### CONFLICTS
**Không có.** Không destructive `EmployeeSchedule` · không xóa leave cũ · không dùng EmployeeRoleFee cho payroll
· không đổi finance.read · không merge Employee/User · không hard-delete chấm công. Additive 0 DROP.

## HR-PH3: SESSION STAFF CONTRIBUTION LEDGER (v0.32.0)

Sổ đóng góp nhân sự THỰC TẾ theo buổi (bằng chứng công việc, bất biến). **Thuần additive, 0 DROP.** Migration
**`Zc_hr_session_contribution`** (tổng **39 migration**). **483 test / 51 file PASS** (459 +
`test/hr-session-contribution.test.ts` 24). tsc sạch · lint 0 lỗi · build OK · fresh deploy 39 migration + seed + seed:demo sạch.

### Nguyên tắc
`SessionStaff` (gán/tóm tắt) GIỮ NGUYÊN; `SessionStaffContribution` là **bằng chứng công việc thực tế** (source
of truth cho performed work). **KHÔNG tiền lương/hoa hồng** (HR-PH5+); `weight` = trọng số vận hành, KHÔNG chia
tiền. `EmployeeRoleFee` bất biến. Contribution đông cứng theo buổi; sửa qua **REVERSAL** (mẫu MaterialUsage);
**KHÔNG hard-delete**. Đóng góp **KHÔNG** suy từ Booking (Booking=ý định · Session=thực tế).

### Migration & schema (`Zc_hr_session_contribution`)
- `StaffContributionType` (`staff_contribution_types`): **config/reference table** (code @unique/name/category/
  defaultWeight/sortOrder/isActive) — KHÔNG hard-code enum vai trò. Seed 8 code (ASSESSMENT/CONSULTATION/
  PRIMARY_OPERATOR/ASSISTANT/MASTER_SUPERVISION/TECHNOLOGY_OPERATOR/RECOVERY/OTHER), additive.
- `SessionStaffContribution` (`session_staff_contributions`): treatmentSessionId · **sessionExecutionItemId?**
  (cấp dịch vụ item; null=cấp buổi) · **serviceStepKey?** (bước/phase snapshot) · serviceIdSnapshot/
  serviceNameSnapshot (đông cứng Service) · employeeId (Restrict) · **employeeNameSnapshot/employeeRoleSnapshot**
  (bất biến) · contributionTypeId?+**contributionTypeCode** (snapshot) · startedAt/endedAt/**actualMinutes** ·
  **weight**/quantity · branchId? · source(AttendanceSource) · **entryKind** (CONTRIBUTION/REVERSAL) · **status**
  (DRAFT/ACTIVE/REVERSED) · crossCheckFlags Json · **idempotencyKey @unique** · reversalOfId/reversedAt/By/Reason.
- Back-relation: TreatmentSession/SessionExecutionItem/Employee/Branch. Enums `ContributionStatus`,
  `ContributionEntryKind`.

### 3 cấp đóng góp
Cấp BUỔI (sessionExecutionItemId null — vd CONSULTANT cả buổi) · cấp DỊCH VỤ ITEM (KTV thực hiện DMK) · cấp
BƯỚC/PHASE (serviceStepKey, vd Master làm phase LASER). sessionExecutionItemId nullable; bước dùng key snapshot
(SOP đổi vẫn hiểu). Nhiều nhân sự/1 item + weight (chưa ép tổng=1).

### Snapshot bất biến (mục 6–7)
Mỗi đóng góp chụp: tên NV + role-in-session + tên/id Service tại thời điểm. **Đổi tên NV/Service về sau KHÔNG
đổi lịch sử** (test F/G). Dùng lại freeze buổi (`executionFrozenAt`) — khi buổi COMPLETED, DRAFT→ACTIVE
(`freezeSessionContributions` gọi trong session PATCH). Không dựng hệ thống lịch sử Service cạnh tranh.

### Thời gian (mục 8)
start+end → `actualMinutes` = hiệu instant (cross-midnight OK, không âm — test W). Chỉ có minutes → cho nhập
tay (MANUAL). Không âm (422).

### Đối chiếu chấm công (HR-PH2) — CẢNH BÁO, không chặn
`crossCheckContribution` → cờ: `NO_ATTENDANCE`/`ON_APPROVED_LEAVE`/`BRANCH_MISMATCH`/`OVERLAP_CONTRIBUTION`/
`TWO_BRANCHES_SAME_TIME` (WARNING) · `NO_SHIFT` (INFO). **Không auto-sửa chấm công, không chặn lâm sàng.** Lưu
`crossCheckFlags` lúc tạo. Lỗi cứng chỉ: end<start.

### Freeze / reversal (mục 12–13)
DRAFT (trước freeze) sửa được (PATCH); ACTIVE/REVERSED → chặn PATCH (409), sửa qua **reverse** (compensating:
giữ gốc → REVERSED + tạo bút toán REVERSAL net về 0 [minutes/weight âm], trỏ `reversalOfId`). Chặn hoàn tác 2
lần (409). Correction = reversal + line mới. `idempotencyKey` chống double-tap.

### RBAC (tái dùng — KHÔNG thêm permission)
Tạo/hoàn tác = `treatment.write`; buổi đã freeze cần thêm `treatment.editCompleted` (như sửa buổi hoàn thành).
GET org = `treatment.read`; **self-view** (nhân viên liên kết) chỉ đóng góp CỦA MÌNH (ownership FK userId).
`finance.read` KHÔNG cấp quyền ghi; `payroll.*` KHÔNG cần cho nhập lâm sàng. Loại đóng góp đọc = mọi phiên.

### API / UI
`/api/session-staff-contributions` (GET filter session/item/employee/status/type; POST) · `/[id]` (GET/PATCH
draft) · `/[id]/reverse` (POST) · `/api/staff-contribution-types` (GET, lazy-seed). UI: màn buổi
`/sessions/[id]` khối D thêm **"Đóng góp thực tế"** (`components/session-contributions.tsx`: thêm/hoàn tác, cờ
cảnh báo, phút/trọng số) · Hồ sơ nhân sự tab **H. Đóng góp chuyên môn** (read-only, snapshot). KHÔNG đổi sidebar/nav.

### Audit (append-only)
`SESSION_STAFF_CONTRIBUTION_CREATED` · `_UPDATED_DRAFT` · `_REVERSED` (kèm actor/employee/session/reason/flags).

### KPI-readiness (mục 23) — chưa tính tiền
Có đủ nền suy (HR-PH4): số Service/buổi/phút/loại/branch/role theo nhân sự qua GET filter — KHÔNG tính lương.

### Legacy SessionStaff
KHÔNG bịa đóng góp từ SessionStaff cũ. Buổi cũ có SessionStaff nhưng KHÔNG có contribution → lịch sử đóng góp
rỗng (không backfill phút/weight giả). Ledger là nguồn sự thật cho công việc; SessionStaff giữ vai trò gán/tóm tắt.

### Chứng minh (test/hr-session-contribution.test.ts, 24 test → A–AM)
Basic A–I · Integrity J–Q (item sai buổi 422 · end<start 422 · NV lạ 422 · idempotent · nhiều dòng · RESIGNED
vẫn ghi) · Cross-check R–X (attendance/leave/shift/branch/overlap/two-branches/cross-midnight) · Freeze/reversal
Y–AE (DRAFT sửa · frozen 409 · reversal giữ gốc + chặn 2 lần + correction + audit + no hard-delete) · RBAC/self
AF–AM (403 thiếu quyền · editCompleted khi freeze · self chỉ của mình · self không sửa người khác · finance.read
không ghi · payroll không cần).

### Demo (seed:demo)
Buổi `SS-100001`: 2 đóng góp — Phạm Chuyên Viên (PRIMARY_OPERATOR, 45′, weight 0.7) + Trần Quản Lý
(MASTER_SUPERVISION, 15′, weight 0.3).

### Deferred HR-PH4+
KPI snapshot theo kỳ · Commission/Incentive (diễn giải weight→tiền) · Payroll · overlap thành lỗi cứng (hiện
cảnh báo) · "outside shift" chính xác (hiện NO_SHIFT=INFO khi không có ca) · self-service UI ghi đóng góp.

### CONFLICTS
**Không có.** Không thay thế SessionStaff · không đổi cardinality TreatmentSession · không suy từ Booking · không
dùng EmployeeRoleFee làm payroll · không rewrite buổi cũ · không hard-delete · không đổi finance.read. Additive 0 DROP.

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

## HR-PH4: KPI ENGINE + PERIOD SNAPSHOT (v0.33.0)

Đo lường **HIỆU SUẤT theo kỳ** từ FACT đáng tin, snapshot BẤT BIẾN khi khóa. **KPI = performance
measurement, KHÔNG tự động ảnh hưởng lương/thưởng** (no hidden coupling; tiền lương/hoa hồng/payroll để
HR-PH5+). Thuần **additive, 0 DROP**. Migration **`Zd_hr_kpi`** (tổng **40 migration**). **506 test / 52 file PASS** (483 + `test/hr-kpi.test.ts` 23). tsc sạch · lint 0 lỗi · build OK · fresh deploy 40 migration +
seed + seed:demo sạch (13 định nghĩa KPI, kỳ demo KP-000001 = 52 snapshot/4 nhân sự).

### Audit nguồn (§3–4) — chỉ dùng FACT đáng tin
- **VERIFIED:** `SessionStaffContribution` (hiệu lực NET = `entryKind=CONTRIBUTION AND status=ACTIVE` — loại
  bản REVERSED + dòng REVERSAL, không đếm đôi) · `AttendanceRecord` (status COMPLETED/ADJUSTED) ·
  `TreatmentSession` (incident/completed qua liên kết contribution) · `EmployeeLeave` (APPROVED).
- **Review identity (§4/§21):** `SessionReview` VẪN name-based (`technicianName`). **Thêm FK additive
  `SessionReview.employeeId?` (nullable, SetNull) — KHÔNG backfill/đoán.** Review write mới giải FK CHỈ khi
  khớp **CHÍNH XÁC 1 nhân sự ACTIVE** (deterministic). KPI review: khớp FK → **VERIFIED**; chỉ khớp tên &
  tên DUY NHẤT → **LEGACY_NAME_MATCH**; tên trùng/không khớp → **INSUFFICIENT** (KHÔNG quy nhầm).
- **SALES KPI: DEFER** (attribution `createdBy`/`receivedBy` là tên tự do — không đáng tin, HR-PH0). KHÔNG tính
  doanh thu nhân sự trong PH4.

### Migration & schema (`Zd_hr_kpi`)
- Enums: `KpiCategory` (PRODUCTIVITY/QUALITY/ATTENDANCE/CUSTOMER/SALES/OPERATIONAL) · `KpiCalculationType` ·
  `KpiSourceType` · `KpiDirection` · `KpiPeriodStatus` (DRAFT/CALCULATED/REVIEWED/LOCKED) · `KpiSourceQuality`
  (VERIFIED/PARTIAL/LEGACY_NAME_MATCH/INSUFFICIENT) · `KpiSnapshotStatus` (CURRENT/SUPERSEDED).
- **`KpiDefinition`** (MASTER config: code/name/category/unit/calculationType/sourceType/direction/isActive/
  sortOrder) · **`KpiPeriod`** (KP-xxxxxx, MONTHLY|CUSTOM, startDate/endDate `@db.Date`, branchId?, status +
  calculated/locked audit) · **`EmployeeKpiSnapshot`** (value/numerator/denominator/sourceCount/
  `calculationSnapshot Json` [bằng chứng tái lập]/`sourceQuality`/branchSnapshot/version/status; `@@unique
  [period,employee,def,version]`) · **`KpiTarget`** (scope COMPANY/BRANCH/ROLE/EMPLOYEE, TÁCH khỏi value,
  KHÔNG tạo thưởng). `SessionReview` +`employeeId?` FK. Back-relations Employee/Branch.

### Engine — `src/lib/kpi.ts` (deterministic, event-time)
- `KPI_DEFINITION_SEED` 13 KPI hỗ trợ; `ensureKpiDefinitions` (lazy upsert, giữ chỉnh sửa admin). Công thức
  theo `code` trong engine (deterministic); `calculationType` là metadata. Code chưa hỗ trợ → **bỏ qua**
  (không bịa số).
- **Công thức (§10):** sessions_contributed = distinct session (effective) · services_performed = distinct
  executionItem · treatment_minutes = Σ actualMinutes (effective) · worked/late/early/OT = Σ AttendanceRecord ·
  attendance_days = distinct workDate · approved_leave_days = Σ ngày nghỉ APPROVED · incident_count = distinct
  session có incident qua contribution · avg_technician/avg_satisfaction/review_count (chất lượng theo FK/tên).
- **Branch (§24)/Role (§25):** lọc theo **branch tại event-time** (contribution.branchId/attendance.branchId),
  KHÔNG dùng `Employee.branchId` hiện tại; role dùng `employeeRoleSnapshot` của contribution (không rewrite).
- **Reversal-aware (§11):** helper `effectiveContributionWhere()` → NET đúng, regression test D.
- **Tính lại/khóa (§12–13):** `calculatePeriod` supersede bản CURRENT (status→SUPERSEDED, version++) →
  append-only, idempotent (giá trị bằng nhau, đúng 1 CURRENT/(nv,def)). `lockPeriod` → snapshot BẤT BIẾN
  (recalc LOCKED → 409; đổi nguồn sau khóa KHÔNG đổi snapshot). Múi giờ VN (periodBounds qua parseVnLocal).

### API (reuse RBAC — KHÔNG thêm permission)
`/api/kpi-definitions` (+`[id]`) · `/api/kpi-periods` (+`[id]`, `[id]/calculate`, `[id]/recalculate`,
`[id]/lock`) · `/api/employee-kpi-snapshots` (+`[id]/evidence` drill-down) · `/api/kpi-targets`. Audit
`KPI_DEFINITION_*`/`KPI_PERIOD_CREATED|CALCULATED|RECALCULATED|LOCKED|UPDATED`/`KPI_TARGET_CREATED`.
- **RBAC (§19):** đọc org = `attendance.read` (MANAGER/BOD — managerial, KHÔNG dùng over-broad staff.read) ·
  quản lý (tạo def/period/calculate/lock/target) = `attendance.write` (MANAGER) · **self-view = ownership FK
  `Employee.userId`** (KHÔNG permission, KHÔNG fallback tên/email). `finance.read` đơn lẻ KHÔNG cấp quản lý
  KPI; `payroll.read` KHÔNG bắt buộc để xem KPI thường. **KPI value KHÔNG payroll-private** (§20 — không mask).

### UI
- **Hồ sơ nhân sự tab G** ("Hoạt động & Đánh giá"): giữ tổng quan legacy + thêm **panel KPI theo kỳ**
  (chọn kỳ → chỉ số/giá trị/đơn vị/**chất lượng nguồn**/drill-down bằng chứng).
- **Workspace `/performance`** (Vận hành & Hệ thống, `attendance.read`): chọn/tạo/tính/khóa kỳ · **xếp hạng
  theo 1 chỉ số so sánh được** (KHÔNG rank chéo vai trò không tương đương) · ma trận nhân sự×KPI · drill-down.
  Nav item "Hiệu suất (KPI)". KHÔNG hiển thị lương/thưởng.

### CSV (§26) — `docs/KPI_CSV.md`
`kpi_definitions.csv` + `kpi_targets.csv` (config/master). **KHÔNG** import giá trị snapshot (sinh từ engine).

### Chứng minh (test/hr-kpi.test.ts, 23 test → A–AF)
Contribution A–H (sessions/services/minutes · **D reversal NET** · E pre-lock recalc · F multi-staff · G branch
event-time · H role snapshot giữ) · Attendance I–O (worked/days/late/early/OT · **N nghỉ duyệt ≠ vắng thô** ·
O cross-midnight) · Review P–T (avg/count · **S LEGACY_NAME_MATCH** · **T tên trùng KHÔNG quy nhầm**) ·
Snapshot U–Z (calculate/CALCULATED · **V recalc idempotent+supersede** · **W LOCKED 409** · **X đổi nguồn sau
khóa bất biến** · Y calculationSnapshot tái lập + evidence · Z sourceCount) · RBAC/Self AA–AF (self chỉ của
mình · self KHÔNG xem người khác · manager org · **finance.read đơn lẻ→403** · payroll.read không bắt buộc ·
multi-role union). Full regression **506/52** không regression.

### Demo (seed:demo) — KP-000001 (08/2026)
52 snapshot/4 nhân sự. Contribution KPI VERIFIED (KTV 45′, Master 15′); review KPI LEGACY_NAME_MATCH (đánh giá
demo name-based, chưa có FK — minh họa chất lượng nguồn); approved_leave_days VERIFIED. DRAFT (khóa ở /performance).

### CONFLICTS: KHÔNG CÓ
Không tính tiền lương/hoa hồng/payroll · không dùng sales attribution tên tự do làm sự thật (defer) · không
rewrite KPI đã khóa (supersede/append-only) · không redefine `EmployeeRoleFee` (giữ costing-only) · KHÔNG dùng
`finance.read` làm quyền private lương/KPI · review FK additive nullable (không backfill/không destructive) ·
không hard-delete snapshot. Additive 0 DROP. Baseline HR-PH1/2/3 + EmployeeRoleFee + SessionStaff + freeze +
MaterialUsage reversal + Pricing/Costing + Booking + IA/RBAC (Mục 15) bất biến.

### Deferred HR-PH5+
Commission/incentive (diễn giải KPI→tiền) · PayrollPeriod/earning lines · sales attribution FK (SalesAttribution)
+ sales KPI · aggregate performance score (weighted, cần công thức tường minh) · KpiRule PUBLISHED chuyển snapshot
→ bonus (payroll-private) · KPI reopen workflow (hiện LOCKED = cuối) · review FK backfill có xác nhận · branch-scoped
RBAC (hiện org-wide) · self-service UI nhập/khiếu nại KPI.

## HR-PH5: COMPENSATION POLICY + SALES ATTRIBUTION + COMMISSION + INCENTIVE + KPI BONUS (v0.34.0)

Tạo **BẰNG CHỨNG thu nhập** (append-only ledger) từ FACT đáng tin — KHÔNG tính PayrollPeriod/payslip/thuế/
BHXH/thanh toán (HR-PH6+). Thuần **additive, 0 DROP**. Migration **`Ze_hr_compensation`** (7 model + enums;
tổng **41 migration**). **537 test / 53 file PASS** (506 + `test/hr-compensation.test.ts` 31). tsc sạch · lint
0 lỗi · build OK · fresh deploy 41 migration + seed + seed:demo sạch.

### 10 quyết định owner (đã duyệt) đã tuân thủ
HYBRID comp · sales commission = **TIỀN THỰC THU** · treatment incentive = fixed Service/Role + contribution
weight · multi-staff explicit role+weight · package HYBRID (fixed primary) · precedence Company→Branch→Role→
Employee · KPI performance-only trừ khi PUBLISHED rule · correction = reversal/append-only · self-view own only ·
**EmployeeRoleFee GIỮ costing-only**.

### Audit nguồn (đã xác nhận bằng code)
- **Tiền thực thu** = `Payment(voidedAt null) + Deposit(status ALLOCATED)` (khớp `invoicePaidAmount` hiện có).
- **Treatment incentive** = `SessionStaffContribution` HIỆU LỰC (`entryKind=CONTRIBUTION AND status=ACTIVE`).
- **KPI bonus** = `EmployeeKpiSnapshot` đã KHÓA + VERIFIED (mặc định).
- **KHÔNG có phân bổ doanh thu theo cấu phần gói** → `PERCENT_ALLOCATED_REVENUE` **DEFER** (báo limitation).

### Migration & schema (`Ze_hr_compensation`)
7 model: **`CompensationPolicy`** (scope COMPANY/BRANCH/ROLE/EMPLOYEE + currentVersionId) · **`CompensationPolicyVersion`**
(DRAFT→PUBLISHED→SUPERSEDED + sourceSnapshot bất biến) · **`CommissionRule`** (COLLECTED_CASH/targetType/rate/
attributionRole) · **`TreatmentIncentiveRule`** (service/category/contributionType/role · FIXED_PER_SERVICE/
FIXED_PER_CONTRIBUTION/PER_MINUTE · weightMode) · **`KpiBonusRule`** (kpiDef/comparator/threshold/tier/requireVerified)
· **`SalesAttribution`** (FK nhân sự tường minh · @@unique[employee,sourceType,sourceId,role]) · **`CompensationEvent`**
(append-only ledger · idempotencyKey @unique · reversalOfId · calculationSnapshot). 13 enum. Back-relation
Employee `salesAttributions`/`compensationEvents`.

### Engine — `src/lib/compensation.ts` (deterministic · idempotent · reversal-aware)
- **`publishPolicyVersion`** — §4 xung đột precedence (cùng scope key + PUBLISHED + khoảng hiệu lực GIAO NHAU →
  **409**, không tự chọn); đông cứng `sourceSnapshot`; supersede version cũ; set currentVersionId. **DRAFT không
  sinh tiền.**
- **`resolvePolicyForEmployee`** — precedence EMPLOYEE>ROLE>BRANCH>COMPANY (hiệu lực theo ngày); ambiguity cùng
  độ cụ thể → **409**.
- **`generateTreatmentIncentivesForSession`** — mỗi contribution ACTIVE → resolve policy + match rule (đặc thù
  service/category/type/role, priority; tie→409) → FIXED/PER_MINUTE (+minimumMinutes/maxAmount); weight CHỈ khi
  `APPLY_CONTRIBUTION_WEIGHT`; idempotent `TI:{contrib}:{rule}`. Contribution REVERSED → tự tạo **REVERSAL** (§Z).
- **`generateSalesCommissionForPayment/Deposit`** — nguồn tiền thực thu; attribution INVOICE→fallback CUSTOMER;
  rate%×basis×weight (+fixed); ngưỡng min/max; idempotent `SC:{src}:{id}:{emp}:{rule}`. **Void payment → reverse**.
- **`generateKpiBonusesForPeriod`** — kỳ LOCKED; snapshot VERIFIED (LEGACY/INSUFFICIENT loại nếu requireVerified);
  comparator/threshold/tier (bậc cao thắng); idempotent `KB:{snap}:{rule}`.
- **`reverseCompensationEvent`** — bút toán bù (amount âm net 0), giữ gốc→REVERSED, chặn 2 lần/không reverse
  REVERSAL, lý do bắt buộc. **KHÔNG hard-delete.**

### API (reuse RBAC — KHÔNG thêm permission)
`/api/compensation-policies`(+`[id]`) · `/api/compensation-policy-versions`(+`[id]/publish`) · `/api/commission-rules`
· `/api/treatment-incentive-rules` · `/api/kpi-bonus-rules` · `/api/sales-attributions`(+`[id]` void) ·
`/api/compensation-events`(self-scope) · `/api/compensation-events/[id]/reverse` · `/api/compensation/generate`
(action tường minh: incentive/commission/kpi). Audit `COMPENSATION_POLICY_*`/`SALES_ATTRIBUTION_*`/
`COMPENSATION_EVENT_CREATED|REVERSED`.
- **RBAC (§29):** đọc org = `compensationPolicy.read` HOẶC `commission.read` (MANAGER/BOD) · quản lý (policy/rule/
  attribution/generate/reverse) = `compensationPolicy.write` (MANAGER) · **self-view = FK `Employee.userId`**.
  **KHÔNG dùng `finance.read`**; `payroll.*` TÁCH BIỆT (payroll.read đơn lẻ KHÔNG mở compensation).

### UI
- Workspace **`/compensation`** (Vận hành & Hệ thống, `compensationPolicy.read`): 3 tab **Chính sách** (tạo/version/
  thêm rule/**Phát hành**) · **Attribution bán hàng** (gán FK theo nguồn) · **Sự kiện thu nhập** (sinh event tường
  minh · lọc · **Hoàn tác** · cột "Vì sao" giải thích). Nav item "Lương thưởng".
- **Hồ sơ nhân sự tab I** "Thu nhập (thưởng/hoa hồng)" — sự kiện của nhân sự (read-only) + tạm tính net. KHÔNG
  hiển thị bảng lương.

### Giải thích (explainability §26)
Mỗi event có `calculationSnapshot`: why + policy/version + rule + basis + rate/fixed + weight + nguồn id → tái
lập vì sao ra số tiền. Self-view + workspace hiển thị "Vì sao".

### CSV (§35) — `docs/COMPENSATION_CSV.md`
`compensation_policies`/`commission_rules`/`treatment_incentive_rules`/`kpi_bonus_rules`/`sales_attribution`
(config/master; attribution chỉ FK, KHÔNG backfill tên). **KHÔNG** import `compensation_events`.

### Chứng minh (test/hr-compensation.test.ts, 31 test → A–AS)
Policy A–G (publish bất biến · supersede · **E precedence Company→…→Employee** · **F xung đột 409** · **G DRAFT
không sinh tiền**) · Attribution H–M (FK tường minh · weight · **L legacy không tự attribute** · M sai→422) ·
Commission N–U (**N tiền thực thu×%** · O/P từng phần+bổ sung · **Q void→reversal net 0** · **R cọc ALLOCATED** ·
S idempotency · **T weight allocation** · U snapshot) · Incentive V–AC (fixed · per-minute · **X weight chỉ khi
policy** · Y multi-staff · **Z/AA contribution reversal→comp reversal + correction** · **AB/AC Booking &
EmployeeRoleFee KHÔNG dùng**) · Package AD–AF (**AD fixed không đổi theo chiết khấu gói** · **AE PERCENT_ALLOCATED
deferred** · AF item gói resolve đúng) · KPI AG–AL (**AG locked+VERIFIED** · **AH chưa khóa→409** · **AI
LEGACY loại** · AJ tier · AK idempotency · AL snapshot nguồn) · RBAC/Self AM–AS (self own · **AO finance/payroll
đơn lẻ→403** · AP read≠write · AQ commission.read · AR union). Full regression **537/53** không regression.

### Demo (seed:demo) — CP-000001 PUBLISHED
Chính sách công ty: incentive PRIMARY 150k + MASTER 50k, commission 3% CLOSER. Sinh: buổi SS-100001 → **thưởng
dịch vụ KTV 150k + Master 50k**; phiếu thu PT-000001 (5tr) → **hoa hồng 150k** (CLOSER nvKTV, attribution INVOICE).

### CONFLICTS: KHÔNG CÓ
Không redefine EmployeeRoleFee (costing-only) · không dùng attribution tên tự do làm sự thật · sales commission
= tiền thực thu (KHÔNG dùng giá báo giá/nghĩa vụ hóa đơn) · không hard-delete event (reversal) · không tính
PayrollPeriod · không đổi nghĩa Invoice/Payment · KHÔNG dùng `finance.read` cho privacy lương/hoa hồng · không
đổi KPI snapshot đã khóa. Additive 0 DROP. Baseline HR-PH1/2/3/4 + KPI lock + Costing/Pricing + Booking + IA/RBAC
(Mục 15) bất biến.

### Deferred HR-PH6+
PayrollPeriod/PayrollEmployeeSummary/payslip · thuế PIT/BHXH · thanh toán lương thật · accounting posting ·
allocation doanh thu gói → per-component (mở PERCENT_ALLOCATED_REVENUE) · loyalty/voucher/prepaid engine (mới
tách khái niệm) · attribution write points tự động ở workflow thương mại (hiện thủ công/API) · team bonus/
allowance/deduction rule families.

## HR-PH6: PAYROLL (Bảng lương) — CLOSURE chuỗi Nhân sự→Lương (v0.35.0)

Mảnh cuối HR: **GỘP `CompensationEvent` (HR-PH5) + lương cơ bản + phụ cấp → lương gộp → trừ khấu trừ (cấu
hình) → thực nhận**; phiếu lương BẤT BIẾN khi duyệt. **KHÔNG tính thuế PIT/BHXH luật định tự động** (chủ DN
tự khai qua `PayrollComponentRule`). Thuần **additive, 0 DROP**. Migration **`Zf_hr_payroll`** (4 model + 4
enum; tổng **42 migration**). **550 test / 54 file PASS** (537 + `test/hr-payroll.test.ts` 13). tsc sạch ·
lint 0 lỗi · build OK · fresh deploy 42 migration + seed + seed:demo sạch.

### Nguyên tắc cứng
- **KHÔNG hard-code PIT/BHXH** — dùng `PayrollComponentRule` (FIXED / % lương cơ bản / % lương gộp); hệ thống
  không bịa tỷ lệ luật định.
- **Thu nhập** = `CompensationEvent` status ELIGIBLE, eventType ≠ REVERSAL (bản đã REVERSED loại, dòng REVERSAL
  loại → net đúng, không tính lại tiền).
- **Lương cơ bản** (`EmployeeBaseSalary`, versioned) TÁCH khỏi `EmployeeRoleFee` (costing-only).
- Append-only + version (supersede khi tính lại); **DUYỆT → khóa bất biến**. Payroll RIÊNG TƯ (payroll.*  + self FK).

### Migration & schema (`Zf_hr_payroll`)
- Enum `PayrollPeriodStatus` (DRAFT/CALCULATED/APPROVED/PAID/LOCKED) · `PayrollComponentKind` (EARNING/DEDUCTION)
  · `PayrollCalcType` (FIXED/PERCENT_BASE/PERCENT_GROSS) · `PayrollLineStatus` (CURRENT/SUPERSEDED).
- **`EmployeeBaseSalary`** (lương cơ bản versioned hiệu lực ngày) · **`PayrollComponentRule`** (phụ cấp/khấu
  trừ cấu hình, scope COMPANY/ROLE/EMPLOYEE) · **`PayrollPeriod`** (PR-xxxxxx, lifecycle) · **`EmployeePayrollLine`**
  (phiếu lương: base/commission/incentive/bonus/allowance/gross/deduction/net + `breakdown` Json bằng chứng +
  version/status/lockedAt; `@@unique[period,employee,version]`). Back-relation Employee.

### Engine — `src/lib/payroll.ts`
`resolveBaseSalary` (hiệu lực ngày) · `resolveComponents` (COMPANY + ROLE khớp + EMPLOYEE khớp) ·
`earningsForPeriod` (net event) · `computePayrollLine` (gross = base + phụ cấp + commission/incentive/bonus;
deduction FIXED/%base/%gross; net = gross − deduction) · `calculatePayrollPeriod` (supersede CURRENT, version++,
idempotent; chặn khi APPROVED/PAID → 409) · `approvePayrollPeriod` (CALCULATED→APPROVED + khóa phiếu) ·
`markPayrollPaid` (APPROVED→PAID). Múi giờ VN (parseVnLocal).

### API / RBAC (reuse — KHÔNG thêm permission)
`/api/payroll-periods`(+`[id]`, `/calculate`, `/approve`, `/pay`) · `/api/employee-base-salaries` ·
`/api/payroll-component-rules` · `/api/employee-payroll-lines` (self-scope). Audit `PAYROLL_PERIOD_CREATED|
CALCULATED|APPROVED|PAID` · `PAYROLL_BASE_SALARY_SET` · `PAYROLL_COMPONENT_CREATED`.
- **RBAC:** đọc org = `payroll.read` (MANAGER/BOD) · tạo/tính/cấu hình = `payroll.write` (MANAGER) · duyệt/chi =
  `payroll.approve` (MANAGER) · **self-view phiếu lương = FK `Employee.userId`**. **`finance.read` KHÔNG cấp
  quyền payroll** (dữ liệu riêng tư tách biệt).

### UI
- Workspace **`/payroll`** (Vận hành & Hệ thống, `payroll.read`): tab **Kỳ lương** (tạo/tính/duyệt/chi + bảng
  phiếu + modal phiếu lương chi tiết) · tab **Cấu hình lương** (lương cơ bản versioned + phụ cấp/khấu trừ tự
  khai). Nav item "Bảng lương".
- **Hồ sơ nhân sự tab J** "Bảng lương" — phiếu lương của nhân sự (read-only, riêng tư; self hoặc payroll.read).

### CSV — `docs/PAYROLL_CSV.md`
`employee_base_salaries` + `payroll_component_rules` (config/master). **KHÔNG** import `employee_payroll_lines`.

### Chứng minh (test/hr-payroll.test.ts, 13 test → A–P)
Base salary A–B (versioned hiệu lực) · Earnings C–E (gộp commission/incentive/bonus · **E reversal loại net**) ·
Allowance/Deduction F–H (phụ cấp FIXED · **G khấu trừ %base+%gross tự khai** · H scope ROLE) · Lifecycle I–L
(CALCULATED · **J supersede idempotent 1 CURRENT** · **K duyệt bất biến + tính lại 409 + khóa phiếu** · L
PAID) · RBAC/Self M–P (self own · **O finance.read đơn lẻ→403** · P payroll.read xem / approve cần cho duyệt).
Full regression **550/54** không regression.

### Demo (seed:demo) — PR-000001 (08/2026)
4 phiếu. **Phạm Chuyên Viên**: base 10tr + phụ cấp 730k + thưởng dịch vụ 150k + hoa hồng 150k = gộp 11.03tr −
BHXH 10.5% (1.05tr) = **thực nhận 9.98tr**. **Trần Quản Lý**: base 15tr + 730k + thưởng 50k = 15.78tr − 1.575tr
= **14.205tr**. Minh họa gộp thu nhập HR-PH5 + khấu trừ khai tay (không hard-code luật).

### CONFLICTS: KHÔNG CÓ
Không hard-code thuế/BHXH · không dùng EmployeeRoleFee làm lương · không tính lại tiền event (chỉ gộp net) ·
không hard-delete phiếu (supersede + khóa khi duyệt) · không đổi Invoice/Payment/CompensationEvent · KHÔNG dùng
`finance.read` cho privacy lương. Additive 0 DROP. Baseline HR-PH1..5 + Costing/Pricing + KPI lock + Booking +
IA/RBAC (Mục 15) bất biến.

### Deferred (ngoài phạm vi HR — cần quyết định chủ DN / tích hợp riêng)
Payslip PDF/export · thanh toán lương thật (bank file) · hạch toán kế toán · engine thuế PIT lũy tiến/BHXH tự
động theo luật · bảng công chi tiết → lương theo giờ/ngày công · Loyalty/Voucher/Prepaid (domain mới).

## TRẠNG THÁI TỔNG — chuỗi HR hoàn tất (HR-PH1→PH6)
Nhân sự→Chấm công→Đóng góp→KPI→Lương thưởng→**Bảng lương** đã đóng trọn vòng. Nghiệp vụ lõi (Kho THNG 7 phase +
Spa 41 mục + HR PH1–6) hoàn tất. Còn lại: **Loyalty/Prepaid** (domain mới, cần owner spec) + **blocker hạ tầng
production** (DB provider/S3/Vercel/backup vận hành/Sentry — cần admin) + nợ kỹ thuật nhỏ lẻ (đã liệt kê từng phase).

## LOY-PH1: KHÁCH HÀNG THÂN THIẾT · HẠNG · VÍ TRẢ TRƯỚC · VOUCHER (v0.36.0)

Domain **mới, additive** — chương trình khách hàng thân thiết chạy SONG SONG, KHÔNG đổi ngữ nghĩa
Invoice/Payment/Deposit. Migration **`Zg_loyalty`** (7 model + 4 enum; tổng **43 migration**). tsc sạch ·
lint 0 lỗi · build OK · fresh deploy 43 migration + seed + seed:demo sạch. **test/loyalty.test.ts** (19, A–X).

### Quyết định thiết kế (owner-safe, tài liệu hóa)
Tách 4 khái niệm: (1) **ĐIỂM** tích lũy · (2) **HẠNG** thành viên · (3) **VÍ TRẢ TRƯỚC** (stored-value,
KHÁC Deposit gắn hóa đơn) · (4) **VOUCHER** (FIXED/PERCENT). KHÔNG trộn với "phương thức thanh toán".
- **Điểm TÍCH từ TIỀN THỰC THU** (Payment chưa hủy), tỷ lệ theo hạng (`pointsPerThousand`) hoặc mặc định
  (1 điểm/1.000₫). Idempotent theo paymentId.
- **ĐỔI điểm → cộng VÍ TRẢ TRƯỚC** (1 điểm = 1.000₫). Ledger APPEND-ONLY + `balanceAfter`; khóa dòng
  `FOR UPDATE` khi trừ (chống âm/đua). KHÔNG hard-delete.
- **Ví/voucher KHÔNG tự trừ vào Invoice** (giữ nguyên tài chính) — điểm tích hợp mỏng khi lập hóa đơn để
  owner quyết định hạch toán sau (báo limitation).

### Migration & schema (`Zg_loyalty`)
Enum `LoyaltyTxnType`(EARN/REDEEM/ADJUST/EXPIRE) · `PrepaidTxnType`(TOP_UP/REDEEM/REFUND/ADJUST) ·
`VoucherType`(FIXED/PERCENT) · `VoucherStatus`(ACTIVE/USED/EXPIRED/VOID). Model: **`MembershipTier`**
(ngưỡng chi tiêu + tỷ lệ tích + ưu đãi) · **`LoyaltyAccount`**(customer @unique: pointsBalance/tier/
lifetimeSpend) + **`LoyaltyTransaction`**(ledger) · **`PrepaidAccount`**(balance) + **`PrepaidTransaction`**
(ledger) · **`Voucher`**(code/type/value/maxDiscount/minSpend/maxRedemptions/expiry/status) +
**`VoucherRedemption`**(append-only, idempotent theo voucher+hóa đơn). Back-relation Customer.

### Engine — `src/lib/loyalty.ts`
`earnPointsForPayment` (idempotent, tỷ lệ theo hạng, cập nhật lifetime + recompute tier) · `adjustPoints` ·
`redeemPointsToPrepaid` (đổi điểm → ví, chặn thiếu điểm) · `topUpPrepaid`/`redeemPrepaid`/`refundPrepaid`
(FOR UPDATE, chặn âm) · `computeVoucherDiscount`/`validateVoucher` (FIXED/PERCENT + trần + minSpend +
expiry + lượt + gán khách) · `redeemVoucher` (khóa voucher, idempotent theo hóa đơn TRƯỚC validate, tăng
lượt → USED khi hết) · `loyaltySummary`. Audit `LOYALTY_POINTS_*`/`PREPAID_*`/`VOUCHER_*`.

### RBAC (thêm — owner-approved additive)
**`loyalty.read`** (gộp CLINIC_READ — mọi vai trò spa xem) · **`loyalty.write`** (MANAGER/RECEPTION/CASHIER
thao tác). ADMIN qua ALL_PERMISSIONS. **Cổng khách** xem điểm/ví/voucher CỦA MÌNH (whitelist trường, không
lộ nội bộ) qua `/api/portal/loyalty` (scope theo phiên portal).

### API / UI
API: `/api/membership-tiers` · `/api/loyalty/[customerId]` (summary) · `/api/loyalty/actions` (earn/
adjustPoints/redeemPoints/topup/redeemPrepaid/refundPrepaid) · `/api/vouchers`(+`[id]` void) ·
`/api/vouchers/validate` · `/api/vouchers/redeem` · `/api/portal/loyalty`. UI workspace **`/loyalty`**
(Khách hàng & Hành trình, `loyalty.read`): tab Thành viên (tra khách → điểm/ví/voucher + thao tác) · Hạng
thành viên · Voucher (tạo + kiểm tra). Nav item "Khách hàng thân thiết".

### CSV — `docs/LOYALTY_CSV.md`
`membership_tiers` + `vouchers` (config). KHÔNG import ledger (điểm/ví/lượt sinh từ engine).

### Chứng minh (test/loyalty.test.ts, 19 test → A–X)
Points A–F (tích từ tiền thực thu · **B idempotent** · **C void không tích** · **D hạng tự lên** · E đổi
điểm→ví · F chặn thiếu điểm + ledger balanceAfter) · Prepaid G–L (nạp/trừ · **I chặn âm** · **J đồng thời
FOR UPDATE** · **K không đụng Payment/Deposit** · L refund) · Voucher M–S (FIXED · **N PERCENT+trần** ·
O minSpend · P expiry · **Q+R lượt+USED+idempotent hóa đơn** · **S không tự trừ hóa đơn**) · RBAC/Portal
T–X (loyalty.write cần cho ghi · 403/401 · **khách xem điểm/ví của mình qua portal, whitelist**).

### Demo (seed:demo)
3 hạng (Thường/Bạc/VIP). KH-100004 tích **5000 điểm** (từ PT-000001 5tr) + nạp **ví 1.000.000₫**;
2 voucher (WELCOME100 giảm 100k, VIP20 giảm 20% trần 300k).

### CONFLICTS: KHÔNG CÓ
Ví trả trước KHÁC Deposit (không trộn) · điểm từ tiền thực thu (không dùng nghĩa vụ hóa đơn) · ví/voucher
KHÔNG tự trừ Invoice/Payment/Deposit (tài chính bất biến) · ledger append-only + FOR UPDATE (không âm/không
hard-delete). Additive 0 DROP. Thêm 2 permission loyalty.* (owner-approved). Baseline Mục 2–16 + HR-PH1..6
bất biến.

### Deferred (điểm tích hợp mỏng — owner quyết định)
Áp ví/voucher trực tiếp giảm hóa đơn khi lập (hạch toán) · điểm hết hạn tự động (EXPIRE cron) · ưu đãi hạng
tự áp vào giá bán · quy đổi điểm↔quà tặng vật lý · tích điểm tự động khi thu tiền (hiện thao tác tường minh).

## TRẠNG THÁI TỔNG (cập nhật) — nghiệp vụ hoàn tất
Kho THNG 7 phase + Spa 41 mục + HR-PH1..6 + **LOY-PH1 (khách hàng thân thiết)** đã xong. Còn lại **chỉ
blocker hạ tầng production** (DB provider/S3/Vercel/backup vận hành/Sentry — cần admin) + nợ kỹ thuật nhỏ
lẻ đã liệt kê từng phase. Không còn domain nghiệp vụ lớn nào chờ xây.

## DATA-IO: NHẬP / XUẤT CSV DÙNG CHUNG cho danh mục (v0.37.0)

Khung **nhập/xuất CSV dùng chung** để đổ dữ liệu danh mục/master nhanh (bulk) — theo yêu cầu "yêu cầu đều
có CSV nhập và xuất để có thể đổ dữ liệu được nhanh hơn". Thuần **additive, code-only — KHÔNG migration,
KHÔNG đổi schema** (tổng vẫn **43 migration**). tsc sạch · lint 0 lỗi · build OK. **test/data-io.test.ts**
(11 test A–L).

### Nguyên tắc AN TOÀN (blocker)
- **CHỈ danh mục/master** (upsert theo MÃ). **KHÔNG import dữ liệu giao dịch/sổ cái** (hóa đơn/thanh toán/
  buổi/ledger/compensation/payroll/loyalty ledger) — bảo toàn tính đúng tài chính + append-only đã nghiệm thu.
- **NHẬP = UPSERT theo khóa tự nhiên** (`code`/`sku`): mã đã có → **cập nhật**, mã mới → **thêm**; **KHÔNG
  xóa** bản ghi ngoài file (không hard-delete, không mất dữ liệu). Bỏ qua dòng lỗi (báo cáo lý do).
- **FK bằng MÃ** (không phải id): cột `categoryCode`/`brandCode`/`parentCode` → resolve sang `categoryId`/
  `brandId`/`parentId`. Mã sai → lỗi dòng (không tạo bừa). **XUẤT** cũng hiển thị FK bằng mã → **round-trip**.

### Engine — `src/lib/data-io.ts` (registry-based)
- **`parseCsv`/`toCsv`** tự viết (ngoặc kép, phẩy & xuống dòng trong ô, escape `""`). Xuất kèm **BOM** để
  Excel đọc UTF-8. Coerce kiểu: number/boolean/date (`yyyy-MM-dd`)/enum (allowlist)/list (`|` hoặc `,`).
- **`Dataset` registry** (12 thực thể): `{ key, label, group, model, naturalKey, readPerm, writePerm?,
  columns[], transform? }`. `transform` đồng bộ suy field (vd `status→isActive`). Không `writePerm` = chỉ XUẤT.
- API engine: `exportDataset` (findMany + prefetch id→code) · `templateCsv` (chỉ tiêu đề) · `previewImport`
  (dry-run: NEW/UPDATE/ERROR + counts `willCreate/willUpdate/willError`) · `commitImport` (upsert theo mã,
  bỏ dòng lỗi → `{total, created, updated, skippedError, errors[]}`) · `listDatasets(perms)` (lọc readPerm +
  cờ `canWrite`).

### 12 dataset + RBAC (tái dùng permission — KHÔNG thêm quyền mới)
`membership-tiers`·`vouchers` (loyalty.read/write) · `customers` (customer.read/write) · `service-categories`·
`services` (service.read/write; services FK `categoryCode`→category + `status→isActive`) · `spa-products`
(library.read/**catalog.write**; FK `brandCode`) · `technologies` (library.read/**technology.write**; FK
brand) · `brands` (library.read/**brand.write**) · `booking-resources` (booking.read/write; enum ROOM/BED/
MACHINE + self-ref `parentCode`) · `employees` (staff.read/write; `roles` list + `status→isActive`) ·
`kpi-definitions` (attendance.read/write) · `payroll-component-rules` (payroll.read/write). Đọc = readPerm,
ghi = writePerm; **enforce ở SERVER** từng route (thiếu đọc → 403, ẩn danh → 401, thiếu ghi → preview/import 403).

### API / UI
- API `/api/data-io` (GET listDatasets theo `session.permissions`) · `/api/data-io/[key]/export` (readPerm,
  CSV + BOM + content-disposition attachment) · `/[key]/template` (readPerm, header-only) · `/[key]/preview`
  (writePerm, dry-run, ≤5000 dòng) · `/[key]/import` (writePerm, commit + audit `DATA_IMPORTED`).
- UI **`/data-io`** (Vận hành & Hệ thống, hiện nếu có quyền ghi ≥1 danh mục): chọn loại dữ liệu (dropdown
  gom nhóm) → **Tải mẫu / Xuất CSV / Nhập** (dán hoặc tải file → **Xem trước** Thêm mới/Cập nhật/Lỗi từng
  dòng → **Nhập**). Chip cột (bắt buộc/kiểu/enum/mã-FK). Nav item "Nhập/Xuất dữ liệu (CSV)".
- Doc `docs/DATA_IO_CSV.md` (12 dataset, định dạng, quyền).

### Chứng minh (test/data-io.test.ts, 11 test → A–L, HTTP thật trên Postgres)
A liệt kê dataset theo quyền · B xuất CSV có tiêu đề+dữ liệu · C mẫu = 1 dòng tiêu đề · D preview phân loại
NEW/ERROR (thiếu cột bắt buộc) · E import tạo mới · **F+G upsert theo mã** (lần 2 → UPDATE, KHÔNG tạo trùng,
**KHÔNG xóa** bản ghi KEEP ngoài file) · H enum sai → lỗi · **I FK theo mã** (categoryCode→categoryId +
transform isActive; mã sai → lỗi) · **J round-trip** (xuất→xóa→nhập lại giữ nguyên; date+số parse đúng) ·
K chỉ-đọc xuất OK / nhập 403 (canWrite=false) · L không quyền đọc → 403, ẩn danh → 401.

### CONFLICTS: KHÔNG CÓ
Code-only additive (0 migration/0 schema change) · chỉ danh mục (không đụng giao dịch/sổ cái) · upsert theo
mã (không hard-delete) · tái dùng permission Mục 15 + LOY/HR (không thêm quyền) · audit `DATA_IMPORTED`.
Baseline toàn bộ (Mục 2–16 + HR-PH1..6 + LOY-PH1 + Pricing/Costing + IA/RBAC) bất biến.

### Nợ / phạm vi
Chỉ 12 danh mục "an toàn" (upsert theo mã) — thực thể giao dịch chỉ **xuất** qua báo cáo/CSV sẵn có, **không
nhập** qua DATA-IO (theo thiết kế). Có thể thêm dataset danh mục mới bằng cách khai thêm entry trong
`DATASETS` (không cần migration). `.xlsx` trực tiếp chưa (hiện CSV).

## Booking linh hoạt — không cần dịch vụ cố định + thời gian riêng từng dịch vụ (v0.37.1)

Theo yêu cầu: **booking chưa cần xác định dịch vụ cố định** — chỉ cần ghi thông tin + **thời gian đến**
và **thời gian dự kiến hoàn thành**; dịch vụ có thể **nhiều** và **mỗi dịch vụ có ô thời gian riêng bên
cạnh**. Thuần **additive, 0 DROP**. Migration **`Zh_booking_expected_end`** (1 ADD COLUMN nullable; tổng
**44 migration**). tsc sạch · lint 0 lỗi · build OK. **test/booking-flexible.test.ts** (6 test A–F).

### Migration & schema (`Zh_booking_expected_end`)
`Booking` +`expectedEndAt DateTime?` (thời gian dự kiến HOÀN THÀNH). `Booking.serviceId` **đã nullable từ
trước** (không đổi) → booking không dịch vụ vốn hợp lệ ở tầng DB. `BookingItem.durationSnapshot` (đã có từ
P3) = thời gian RIÊNG từng dịch vụ (không thêm cột).

### Backend
- Validation `bookingCreateSchema` +`expectedEndAt` (dateOpt); `bookingItemSchema.durationSnapshot` giữ nguyên.
- **POST/PATCH `/api/bookings`**: suy `durationMinutes` theo ưu tiên **durationMinutes thủ công > khoảng
  (đến→hoàn thành) > Σ item.durationSnapshot > thời lượng dịch vụ**. Lưu `expectedEndAt`. Conflict engine vẫn
  dùng `durationMinutes` (suy ra) → không đổi logic trùng lịch. Booking không dịch vụ: `serviceId=null`,
  duration = khoảng thời gian.
- Nhiều dịch vụ: `items[]` mỗi item mang `durationSnapshot` (phút riêng) → lưu đúng, KHÔNG ép lấy thời lượng
  chuẩn; `Booking.serviceId` = item đầu (tương thích ngược P3/P4; giá/segment/floor giữ nguyên).

### UI `/bookings` (form tạo lịch)
- Hàng đầu: **Thời gian đến \*** (scheduledAt) + **Dự kiến hoàn thành** (expectedEndAt) — nhắc rõ "chỉ cần 2
  mốc này là đủ; dịch vụ không bắt buộc".
- Khối **Dịch vụ (không bắt buộc)**: mỗi dòng = chọn dịch vụ + ô **phút** RIÊNG bên cạnh (bỏ trống → thời
  lượng chuẩn). Dịch vụ #1 = dịch vụ chính. `↑/↓` đổi thứ tự, xóa. Tổng ~N′.
- "Khung giờ (tự tính)" ưu tiên: dự kiến hoàn thành > thời lượng ghi đè > Σ phút dịch vụ > 60′. Chi tiết lịch
  ưu tiên hiển thị `expectedEndAt`; danh sách dịch vụ hiện phút riêng từng dịch vụ (đã có từ P3).

### Chứng minh (test/booking-flexible.test.ts, 6 test A–F, HTTP thật)
A tạo booking KHÔNG dịch vụ (đến 02:00 + hoàn thành 03:30 → serviceId null, duration=90, 0 item) · B
expectedEndAt lưu & đọc lại đúng · C durationMinutes thủ công thắng expectedEndAt · D nhiều dịch vụ mỗi cái
phút riêng (20+15 → tổng 35, KHÔNG phải 60+45) · E PATCH set expectedEndAt → duration tính lại (75) · F
booking-level duration không service/không end vẫn chạy (tương thích cũ).

### CONFLICTS: KHÔNG CÓ
Additive (1 cột nullable, 0 DROP) · serviceId đã nullable từ trước · conflict engine/giá/floor/P3-P4 items
bất biến · tái dùng permission booking.read/write (không thêm quyền). Full regression giữ xanh.

### DATA-IO nâng cấp (v0.37.2) — tiêu đề TIẾNG VIỆT + thêm mục nhập liệu
Theo yêu cầu: các mục có nhập liệu đều có Nhập/Xuất CSV; **tiêu đề cột bằng tiếng Việt** đúng tên trường
hiển thị trên phần mềm. Code-only additive (0 migration). **590 test** (data-io 11→15, thêm M–P).
- **Tiêu đề tiếng Việt:** `Col.header` đổi sang nhãn tiếng Việt (Mã / Tên / Giá chuẩn / Thời lượng (phút) /
  Đang dùng…); `Col.key` giữ tên field DB. Xuất/Mẫu in tiêu đề tiếng Việt; thông báo lỗi cũng dùng nhãn VN
  ("Thiếu Tên voucher", "Loại: phải thuộc [FIXED/PERCENT]", "Mã nhóm: mã … không tồn tại").
- **Nhập nhận CẢ tiêu đề tiếng Việt LẪN tên field tiếng Anh** (alias trong `buildRows`) → file cũ (header
  tiếng Anh) vẫn nhập được; round-trip xuất→nhập bằng tiêu đề tiếng Việt cũng đúng.
- **+3 mục nhập liệu** (tổng **15 dataset**): **Chi nhánh** (`branches`, staff.read/write) · **Hướng dẫn
  chăm sóc** (`care-instructions`, library.read/care.write) · **Chiến dịch marketing** (`marketing-campaigns`,
  marketing.read/write; KHÔNG xuất `cost` nhạy cảm). Tất cả upsert theo mã, FK bằng mã, không xóa.
- **Test M–P:** M tiêu đề VN + round-trip · N nhập chấp nhận VN/EN alias · O branches xuất+nhập · P
  care-instructions + marketing-campaigns nhập theo tiêu đề VN. Vẫn giữ nguyên tắc chỉ danh mục (không giao dịch).

### DATA-IO — Protocol dịch vụ theo BƯỚC (nested CSV) + seed 2 hệ thống DMK (v0.37.3)
Theo yêu cầu: protocol của dịch vụ cũng có CSV tuân thủ cấu trúc bảng trị liệu DMK (Bước · Tên trị liệu ·
Mục đích). Code-only additive (0 migration). **592 test** (data-io 15→17, thêm Q–R).
- **Dataset LỒNG (nested)** `protocol-steps` "Protocol dịch vụ (theo bước)": mỗi DÒNG CSV = 1 bước, gom
  theo **Mã protocol**. Cột (tiếng Việt): Mã protocol · Tên protocol · Bước · Tên trị liệu · Mục đích ·
  Thời lượng (phút). Lưu vào `BrandProtocol.steps = {items:[{group,name,purpose,durationMinutes?}]}`
  (LEGACY_STEPS). `Dataset.nested` → engine rẽ nhánh `exportProtocolSteps`/`previewProtocolSteps`/
  `commitProtocolSteps`. Nhập = upsert theo Mã protocol, **thay TOÀN BỘ bước** của protocol đó; tạo mới nếu
  chưa có. RBAC library.read (đọc) / protocol.write (ghi).
- **Seed 7 protocol DMK** (từ ảnh khách gửi): ACNE (9 bước) · AGING (10) · PIGMENT (18, 4 nhóm) · BIHAKU
  (lịch trình 7–14 ngày) · **SKIN-MATRIX** (ma trận chọn trị liệu theo tình trạng da: nhiều dầu/ít dầu, 8) ·
  **FINISH-DRY** (kết thúc trị liệu da khô ít dầu, 8) · **FINISH-ACNE** (kết thúc dịch vụ da dầu mụn, 6).
  Brand DMK, ACTIVE.
- **Test Q–R:** Q nhập nhiều dòng/1 protocol → gom steps.items đúng group/name/purpose · R xuất ra dòng/bước
  + nhập lại (round-trip) UPDATE thay toàn bộ bước. Tổng **16 dataset** (thêm protocol-steps).

### Thông tin chi tiết Sản phẩm spa (v0.37.5) — Thành phần/CCĐ/Tần suất/Dung tích + seed DMK
Theo yêu cầu: bổ sung thông tin sản phẩm theo tài liệu đào tạo DMK. Migration **`Zi_spa_product_info`**
(4 cột nullable, additive 0 DROP; tổng **45 migration**).
- `SpaProduct` +`ingredients` (Thành phần) +`contraindications` (Chống chỉ định) +`frequency` (Tần suất)
  +`volume` (Dung tích). Đã có sẵn `description/benefits/suitableFor/usage`. Validation + form Catalog
  (/catalog) + CSV dataset `spa-products` (thêm 7 cột thông tin, tiêu đề tiếng Việt) cập nhật theo.
- **Seed 8 sản phẩm DMK** đầy đủ thông tin (từ ảnh khách gửi): Sebum Soak · Epitoxyl · Prozyme · Cryo Pro-X ·
  Quick Peel · Pro Alpha #1 · Pro Alpha #2 · Super Bright — mỗi SP có thành phần/công dụng/chỉ định/CCĐ/
  cách dùng/tần suất/dung tích. Upsert theo SKU (update cả info khi chạy lại).
- Xác thực: tsc sạch · build OK · data-io 17 test PASS · seed:demo fresh tạo đủ 8 SP DMK có info.

### Bổ sung sản phẩm DMK đợt 2 (v0.37.6) — tổng 20 SP DMK có thông tin
Theo ảnh khách gửi đợt 2 — thêm **12 sản phẩm DMK** vào `dmkProducts` (seed-demo.ts), mỗi SP có công dụng/
chỉ định (+CCĐ/cách dùng/dung tích khi có): Alkaline Wash · Pore Reduction Plus · Melanotech Drops ·
Enbioment Serum · Beta Gel · FibroMax C · Herb & Mineral Mist (home-care) · Seba-E · Herbal Pigment Oil ·
Contra-Derm · Solar Damage · Actrol Powder. Loop seed thêm `type` (PROFESSIONAL/HOME_CARE/BOTH) theo từng SP
(mặc định PROFESSIONAL). **Code-only additive** (dùng lại migration `Zi_spa_product_info`, KHÔNG migration mới;
tổng vẫn **45 migration**). Xác thực: tsc sạch · build OK · seed:demo fresh = **20 SP DMK** có info · full
regression **592/57 PASS**.

### Protocol DMK đợt 3 (v0.37.7) — Alphazyme · Hydradermaze · Alkaline Wash · Desquamate
Theo ảnh đào tạo DMK khách gửi — thêm **4 protocol** (dạng "protocol riêng", `BrandProtocol.steps` LEGACY_STEPS,
group=bước/giai đoạn · name=thao tác/SP · purpose=chi tiết): `PROTO-DMK-ALPHAZYME` (Pro Alpha 1 + Prozyme, 9
bước) · `PROTO-DMK-HYDRADERMAZE` (Prozyme + Pro Alpha 1, 9) · `PROTO-DMK-ALKALINE-FACE` (quy trình điều trị vùng
Mặt: 8 bước + lưu ý thao tác theo tình trạng + chăm sóc sau 2-3 ngày & từ ngày thứ 3, **21 mục**) ·
`PROTO-DMK-DESQUAMATE` (điều trị da mẫn cảm/dày sừng bằng Enzyme #1 + ủ siêu dưỡng, **17 mục** — có định lượng
7 giọt/0.4ml/1ml…). Đồng thời **chuẩn hóa info** 5 SP theo đúng tài liệu (Pore Reduction Plus, Melanotech Drops,
Enbioment Serum, Beta Gel, Herb & Mineral Mist — công dụng/dung tích/định lượng khớp slide). Các protocol này
**xuất/nhập được qua CSV** dataset `protocol-steps` (nested) đã có. **Code-only additive** (KHÔNG migration mới;
tổng vẫn **45 migration**). Xác thực: tsc sạch · build OK · seed:demo fresh = **11 protocol DMK** · full
regression **592/57 PASS**.

### Sửa trình bày dữ liệu chi tiết sản phẩm DMK (v0.37.8) — canonical/alias · pro↔home · provenance
Theo yêu cầu "Product detail data correction" — dữ liệu sản phẩm KHÔNG trộn professional directions với
home-care guidance, KHÔNG dùng alias thay canonical, KHÔNG đặt sai field (contraindication/precaution), KHÔNG
biến package size thành dosage, badge KHÔNG làm hiểu sai taxonomy. **Code-only additive** (KHÔNG migration/schema/
RBAC — không mở Catalogue C2; tổng vẫn **45 migration**). **607 test / 58 file** (+15 `test/dmk-product-data.test.ts`).
- **Sửa seed data (nguồn sự thật)**: Actrol "Bột khóa viêm" (bỏ wording không nguồn) · Beta Gel → BOTH (có ngữ
  cảnh chuyên nghiệp/recovery, không home-only) · Pore Reduction canonical (bỏ "Plus" khỏi tên; alias phụ) ·
  Pro Alpha #1 thêm CĐ "Da quá nhiều dầu" + rõ 2 ml + warm occlusion 5-8′ · **Prozyme: heat/moisture KHÔNG phải
  contraindication** → CĐ page-backed "Da khô thiếu dầu", điều kiện nhiệt/ẩm chuyển vào directions; monograph
  15-25′ KHÔNG gộp Acne Body 5-15′ · Quick Peel giữ 3-5′ + CĐ "Da mỏng yếu, dễ đỏ" · Sebum Soak/Epitoxyl tách
  Chuyên nghiệp (`usage`) ↔ Tại nhà (`frequency`) · Melanotech/Enbioment → BOTH (có định lượng chuyên nghiệp).
- **Trình bày (evidence sheet)**: title = canonical name + dòng "Tên khác / Alias"; chip **"Ngữ cảnh sử dụng"**
  (Chuyên nghiệp / Tại nhà / Cả hai) tách khỏi Nhóm SP; **provenance badge** mỗi card (VERIFIED_PAGE /
  PARTNER_BRAND_SOURCE / PENDING_SOURCE…); "Dung tích (đóng gói)" KHÔNG phải dosage; field thiếu nguồn hiện
  "Chưa đủ nguồn xác minh" (không tự điền); HOLD (Cryo Pro-X 1–10, đặt tên Herb & Mineral/Mist/HMM) hiện cảnh
  báo nguồn thay vì tự chốt. Header: "Dữ liệu seed hiện tại — mỗi bản ghi có provenance riêng".
- **Giới hạn trung thực**: `SpaProduct` KHÔNG có cột provenance/alias/context — alias & provenance là lớp TRÌNH
  BÀY (gán theo cách sourcing), KHÔNG bịa cột DB. Data fix nằm ở field thật (name/category/type/contraindications/
  usage/frequency), khóa bằng `test/dmk-product-data.test.ts` (15). Không mở C2, không sửa Protocol/TrainingPath.

### Quy trình dịch vụ DMK theo bước — DV01–DV09 (v0.37.9)
Theo bảng đào tạo "Quy trình trị liệu" khách gửi — thêm **9 protocol dịch vụ** (dạng protocol riêng,
`BrandProtocol.steps` LEGACY_STEPS; group=bước/lựa chọn · name=thao tác · purpose=công dụng · durationMinutes=thời gian):
`PROTO-DMK-DV01` Detox giảm dầu mụn (8) · `DV02` Detox căng bóng sáng mịn (8) · `DV03` Peel chuyên sâu (10) ·
`DV04` Enzyme Therapy #1 (15) · `DV05` Enzyme siết cơ theo vùng — add-on (2) · `DV06` Enzyme siết cơ toàn diện — add-on (3) ·
`DV07` Peel + Enzyme Therapy (19) · `DV08` Tái cấu trúc peel đa tầng (17) · `DV09` Peel đa tầng + Enzyme Therapy (18).
Dùng khối tái sử dụng: chọn peel 5 chương trình (Desquamate/Pro Alpha #1/Bihaku/Prozyme/Quick Peel) hoặc 6 chương
trình (RVT/Hydradermaze/Alphazyme/Alkaline Wash/Rhinovac/Vitamin A Peel) + phục hồi hàng rào bảo vệ da (8 SP).
**Code-only additive** (KHÔNG migration; tổng vẫn **45 migration**). Xuất/nhập qua CSV `protocol-steps`. Xác thực:
tsc sạch · build OK · seed:demo fresh = **20 protocol DMK** · full regression **607/58 PASS**.

### Giá lẻ dịch vụ DMK (DV01–DV09) + giảm giá VIP (v0.38.0)
Theo "Bảng giá trị liệu DMK gợi ý cho đại lý" (PDF khách gửi) — tạo **9 dịch vụ** `DV-DMK-DV01..DV09`
(category "Trị liệu DMK", link `defaultProtocolId` sang PROTO-DMK-DVxx) với **giá lẻ** (cột GIÁ LẺ) và
**giảm giá VIP** = cột "3 buổi trở lên" (thấp hơn) qua **PriceRule priceType VIP** (dùng lại pricing resolver
PH2/PH4 sẵn có — khách thường lấy standardPrice, khách VIP lấy giá VIP). Bảng: DV01/02 lẻ 450k · VIP 360k ·
DV03 700k/560k · DV04 1.150k/950k · DV05 630k/500k · DV06 980k/780k · DV07 1.650k/1.350k · DV08 1.050k/850k ·
DV09 2.150k/1.750k. Upsert `update: { standardPrice }` → chạy lại cập nhật giá lẻ. **Code-only additive**
(KHÔNG migration; tổng vẫn **45 migration**). `test/dmk-pricing.test.ts` (11) khóa bảng giá + VIP<lẻ. Xác thực:
tsc sạch · build OK · full regression **618/59 PASS**.

### Fix Bảng giá — hiển thị TÊN thay vì id thô (v0.38.1)
Lỗi: 2 rule giá cũ (PH4 demo) tạo KHÔNG có `targetName` → Bảng giá hiển thị **id thô** (cmt066…) thay vì tên
dịch vụ (UI render `targetName ?? targetId`). Fix: `GET /api/price-rules` **enrich `targetName`** giải từ thực
thể đích (Service/Product/Technology/Package) khi thiếu — chỉ lúc đọc, KHÔNG ghi DB → sửa cả row cũ lẫn rule
tạo qua UI mà bỏ trống tên. Seed 2 rule demo bổ sung `targetName`. `test/price-rule-name.test.ts` (1 HTTP thật).
Code-only additive (0 migration). Xác thực: tsc sạch · build OK · full regression **619/60 PASS**.

### Giá vốn — nút "+" thêm chi phí phát sinh (v0.38.2)
Theo yêu cầu xem "phòng thiết lập giá" (màn Giá vốn `/services/[id]/costing`: chi phí gợi ý = vật tư SOP + nhân
sự phí vai trò) + **thêm nút "+" để add chi phí phát sinh**. Migration **`Zj_costing_extra_lines`** (1 cột JSON
nullable `ServiceCostingVersion.extraCostLines`, additive 0 DROP; tổng **46 migration**).
- **Mô hình:** "Chi phí khác (F)" giờ là **danh sách dòng** `[{name, amount}]` thêm bằng nút "+" (xóa từng dòng,
  hiện tổng). `otherCost = Σ dòng` (nếu có dòng), else số nhập tay cũ → **công thức TỔNG không đổi** (direct +
  overhead + other); version PUBLISHED cũ (không có dòng) bất biến. Lưu `extraCostLines` + vào `sourceSnapshot`.
- **Mask theo `finance.read`** (extraCostLines chứa số tiền → thêm vào COSTING_SENSITIVE_FIELDS).
- UI: form tạo bản nháp thay ô "Chi phí khác" đơn bằng khối "Chi phí khác / phát sinh" + **"+ Thêm chi phí phát
  sinh"** (tên + số tiền + xóa + tổng); breakdown F hiện các dòng con "↳ tên = tiền".
- `test/costing-extra-lines.test.ts` (3 HTTP thật): dòng gộp đúng vào tổng · publish bất biến + snapshot evidence
  · non-finance mask null. Code additive. Xác thực: tsc sạch · build OK · full regression **622/61 PASS**.

### Giá vốn — nút "+" thêm chi phí phát sinh (v0.38.2)
Theo yêu cầu xem "phòng thiết lập giá" (màn Giá vốn `/services/[id]/costing`: chi phí gợi ý = vật tư SOP + nhân
sự phí vai trò) + **thêm nút "+" để add chi phí phát sinh**. Migration **`Zj_costing_extra_lines`** (1 cột JSON
nullable `ServiceCostingVersion.extraCostLines`, additive 0 DROP; tổng **46 migration**).
- **Mô hình:** "Chi phí khác (F)" giờ là **danh sách dòng** `[{name, amount}]` thêm bằng nút "+" (xóa từng dòng,
  hiện tổng). `otherCost = Σ dòng` (nếu có dòng), else số nhập tay cũ → **công thức TỔNG không đổi** (direct +
  overhead + other); version PUBLISHED cũ (không có dòng) bất biến. Lưu `extraCostLines` + vào `sourceSnapshot`.
- **Mask theo `finance.read`** (extraCostLines chứa số tiền → thêm vào COSTING_SENSITIVE_FIELDS).
- UI: form tạo bản nháp thay ô "Chi phí khác" đơn bằng khối "Chi phí khác / phát sinh" + **"+ Thêm chi phí phát
  sinh"** (tên + số tiền + xóa + tổng); breakdown F hiện các dòng con "↳ tên = tiền".
- `test/costing-extra-lines.test.ts` (3 HTTP thật): dòng gộp đúng vào tổng · publish bất biến + snapshot evidence
  · non-finance mask null. Code additive. Xác thực: tsc sạch · build OK · full regression **622/61 PASS**.

### Giá điều chỉnh + % giảm tối đa (v0.38.3) — nhóm ①
Trên màn **Giá bán đề xuất** (`/services/[id]/recommended-price`): thêm khối **"Giá điều chỉnh & mức giảm"**:
ghi chú **"Giá có thể giảm tối đa X%"** = (giá chuẩn − giá sàn ACTIVE)/giá chuẩn; ô **Giá điều chỉnh** (nhập
tay) → hiện **% giảm so với giá chuẩn** + **cảnh báo đỏ nếu DƯỚI giá sàn** (phải duyệt), xanh nếu trong khung.
Công cụ tính nhanh client-side — KHÔNG tự sửa giá chuẩn/giá bán, KHÔNG schema/API/migration. Xác thực: tsc
sạch · build OK · full regression giữ nguyên.
