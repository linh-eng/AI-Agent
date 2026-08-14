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

### Còn lại (phase sau)
Khách tự đánh giá qua **Cổng khách** (hiện nhân viên ghi hộ); nhãn/mốc thời gian trên ảnh; so sánh trượt
(slider) trước–sau; báo cáo hiệu suất KTV theo kỳ; gắn KTV được đánh giá từ danh sách nhân sự (hiện nhập tên).

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

### Còn lại (phase sau)
Import lịch sử giao dịch/phác đồ/ảnh (hiện chỉ hồ sơ khách); chế độ "cập nhật khách trùng" (hiện chỉ bỏ qua);
tải file Excel `.xlsx` trực tiếp (hiện CSV); lưu lịch sử các lần import.

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
