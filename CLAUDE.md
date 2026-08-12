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
- **SIGNATURE** vẫn lưu dataURL base64 trong JSON phiếu (chưa đẩy blob sang storage).
- **Rate-limit** dùng DB (đúng đa-instance) nhưng chưa có dọn rác bản ghi hết hạn (khuyến nghị cron
  `DELETE FROM auth_throttles WHERE locked_until < now() AND updated_at < now() - interval '1 day'`).

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
