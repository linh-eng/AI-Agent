# HR-PH6 — Hợp đồng CSV cho Bảng lương (config/master only)

CSV chỉ dùng cho **cấu hình lương**. **KHÔNG** import phiếu lương
(`EmployeePayrollLine`) — phiếu sinh từ engine (gộp thu nhập + lương cơ bản +
phụ cấp − khấu trừ) để bảo toàn tính tái lập & bằng chứng.

## 1) `employee_base_salaries.csv` — lương cơ bản (versioned)

| Cột | Bắt buộc | Mô tả |
|---|---|---|
| `employeeId` | ✓ | FK nhân sự |
| `amount` | ✓ | Lương cơ bản |
| `effectiveFrom` | ✓ | Hiệu lực từ (yyyy-MM-dd) |
| `effectiveTo` |  | Hiệu lực đến (rỗng = vô hạn) |

> Đổi lương = thêm dòng mới (append-only), KHÔNG sửa dòng cũ.

## 2) `payroll_component_rules.csv` — phụ cấp / khấu trừ (chủ DN tự khai)

| Cột | Mô tả |
|---|---|
| `code` | mã khoản (duy nhất) |
| `name` | tên (vd "BHXH 10.5%", "Phụ cấp ăn trưa") |
| `kind` | EARNING (cộng) \| DEDUCTION (trừ) |
| `calcType` | FIXED \| PERCENT_BASE (% lương cơ bản) \| PERCENT_GROSS (% lương gộp) |
| `value` | số tiền (FIXED) hoặc phần trăm (PERCENT_*) |
| `scope` | COMPANY \| ROLE \| EMPLOYEE |
| `scopeRef` | roleCode / employeeId theo scope |

> ⚠️ Hệ thống **KHÔNG** áp tỷ lệ thuế PIT / BHXH mặc định. Chủ doanh nghiệp tự
> khai các khoản khấu trừ theo quy định pháp luật hiện hành tại bảng này.

## KHÔNG hỗ trợ CSV

- `employee_payroll_lines` (phiếu lương) — sinh từ engine.
- Thanh toán lương thật / hạch toán kế toán (ngoài phạm vi — cần tích hợp riêng).
