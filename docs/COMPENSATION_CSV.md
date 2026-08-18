# HR-PH5 — Hợp đồng CSV cho Lương thưởng (config/master only)

CSV chỉ dùng cho **cấu hình chính sách/rule**. **KHÔNG** import giao dịch
`CompensationEvent` (event sinh từ engine deterministic từ FACT — để bảo toàn
tính tái lập, bằng chứng và idempotency).

## 1) `compensation_policies.csv`

| Cột | Bắt buộc | Mô tả |
|---|---|---|
| `code` | ✓ | Mã chính sách (CP-xxxxxx) |
| `name` | ✓ | Tên |
| `scopeType` | ✓ | COMPANY \| BRANCH \| ROLE \| EMPLOYEE |
| `branchId` / `roleCode` / `employeeId` |  | theo scopeType |

## 2) `commission_rules.csv`

| Cột | Mô tả |
|---|---|
| `policyCode`/`policyVersion` | chính sách + version DRAFT áp rule |
| `code` | mã rule |
| `basisType` | COLLECTED_CASH (mặc định) |
| `ratePercent` | % trên tiền thực thu |
| `attributionRole` | ORIGINATOR/BOOKER/CONSULTANT/CLOSER/ACCOUNT_OWNER/COLLECTOR (rỗng = mọi vai trò) |
| `thresholdMin`/`thresholdMax` | ngưỡng basis |
| `priority` | ưu tiên |

## 3) `treatment_incentive_rules.csv`

| Cột | Mô tả |
|---|---|
| `policyCode`/`policyVersion` | chính sách + version DRAFT |
| `code` | mã rule |
| `serviceId`/`serviceCategoryId` | phạm vi dịch vụ (rỗng = mọi dịch vụ) |
| `contributionTypeCode` | loại đóng góp (PRIMARY_OPERATOR…) |
| `employeeRoleCode` | vai trò-trong-buổi |
| `basisType` | FIXED_PER_SERVICE \| FIXED_PER_CONTRIBUTION \| PER_MINUTE |
| `fixedAmount`/`perMinuteAmount` | số tiền |
| `weightMode` | IGNORE_WEIGHT \| APPLY_CONTRIBUTION_WEIGHT |
| `minimumMinutes`/`maxAmount` | điều kiện/trần |

> `PERCENT_ALLOCATED_REVENUE` **hoãn** (chưa có phân bổ doanh thu theo cấu phần).

## 4) `kpi_bonus_rules.csv`

| Cột | Mô tả |
|---|---|
| `policyCode`/`policyVersion` | chính sách + version DRAFT |
| `code` | mã rule |
| `kpiCode`/`kpiDefinitionId` | KPI áp dụng |
| `comparator` | GTE/GT/LTE/LT/EQ |
| `threshold` | ngưỡng |
| `bonusType` | FIXED \| RATE |
| `fixedAmount`/`rate` | thưởng |
| `tier` | bậc (cao hơn thắng) |
| `requireVerified` | mặc định true — chỉ KPI VERIFIED được thưởng |

## 5) `sales_attribution.csv` (chỉ migration/admin bulk khi thật cần)

| Cột | Mô tả |
|---|---|
| `employeeId` | **FK nhân sự (KHÔNG dùng tên tự do)** |
| `sourceType`/`sourceId` | CUSTOMER/BOOKING/PROPOSAL/INVOICE/PAYMENT + id |
| `attributionRole` | vai trò thương mại |
| `weight` | trọng số chia |

> **KHÔNG** backfill attribution từ `createdBy`/`receivedBy` theo tên — dữ liệu
> legacy giữ nguyên chưa gán, trừ khi có migration tường minh được chủ sở hữu duyệt.

## KHÔNG hỗ trợ CSV

- `compensation_events` — sinh từ engine (contribution/payment/KPI snapshot).
- Bất kỳ dữ liệu bảng lương/payslip/thuế/BHXH (HR-PH6+).
