# HR-PH4 — Hợp đồng CSV cho KPI (config/master only)

CSV chỉ dùng cho **dữ liệu cấu hình/master** của KPI. **KHÔNG** import giá trị
snapshot KPI thực tế qua CSV trong vận hành thường (snapshot sinh từ FACT qua
engine tính toán — chỉ chế độ migration mới cân nhắc, phải nêu rõ).

## 1) `kpi_definitions.csv` — định nghĩa KPI (master)

| Cột | Bắt buộc | Mô tả |
|---|---|---|
| `code` | ✓ | Mã KPI duy nhất (vd `sessions_contributed`) |
| `name` | ✓ | Tên hiển thị (tiếng Việt) |
| `category` | ✓ | PRODUCTIVITY \| QUALITY \| ATTENDANCE \| CUSTOMER \| SALES \| OPERATIONAL |
| `unit` |  | Đơn vị (buổi/phút/điểm/%) |
| `calculationType` |  | COUNT_DISTINCT \| SUM \| AVERAGE \| RATIO \| COUNT (metadata mô tả) |
| `sourceType` |  | CONTRIBUTION \| ATTENDANCE \| SESSION \| REVIEW \| LEAVE \| MANUAL |
| `direction` |  | HIGHER_BETTER \| LOWER_BETTER \| NEUTRAL |
| `isActive` |  | true/false |
| `sortOrder` |  | số nguyên |

> Lưu ý: **công thức tính** theo `code` nằm trong engine (deterministic). Thêm
> `code` mới qua CSV mà engine chưa hỗ trợ công thức → định nghĩa tồn tại nhưng
> **không sinh snapshot** (không bịa số) cho tới khi engine bổ sung công thức.

## 2) `kpi_targets.csv` — mục tiêu KPI (tùy chọn)

| Cột | Bắt buộc | Mô tả |
|---|---|---|
| `kpiCode` hoặc `kpiDefinitionId` | ✓ | KPI áp mục tiêu |
| `scope` |  | COMPANY \| BRANCH \| ROLE \| EMPLOYEE (mặc định COMPANY) |
| `scopeRef` |  | branchId / role / employeeId theo scope |
| `targetValue` | ✓ | Giá trị mục tiêu |
| `effectiveFrom` / `effectiveTo` |  | Ngày hiệu lực |

> Target **TÁCH khỏi giá trị** và **KHÔNG tự tạo thưởng lương** (HR-PH5+).

## KHÔNG hỗ trợ CSV (vận hành thường)

- `employee_kpi_snapshots` — sinh từ engine (contribution/attendance/review),
  không nhập tay để bảo toàn tính tái lập/bằng chứng.
- Bất kỳ dữ liệu lương/hoa hồng/payroll (ngoài phạm vi HR-PH4).
