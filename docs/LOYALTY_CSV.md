# LOY-PH1 — Hợp đồng CSV cho Khách hàng thân thiết (config/master only)

CSV chỉ dùng cho **cấu hình**. **KHÔNG** import sổ điểm/sổ ví/lượt voucher
(sinh từ engine để bảo toàn tính toàn vẹn số dư + bằng chứng + idempotency).

## 1) `membership_tiers.csv`
| Cột | Mô tả |
|---|---|
| `code` / `name` | mã + tên hạng |
| `minLifetimeSpend` | ngưỡng tổng chi tiêu để đạt hạng |
| `pointsPerThousand` | số điểm tích / 1.000₫ tiền thực thu |
| `discountPercent` | ưu đãi mặc định của hạng (%) |

## 2) `vouchers.csv`
| Cột | Mô tả |
|---|---|
| `code` / `name` | mã + tên voucher |
| `type` | FIXED (số tiền) \| PERCENT (%) |
| `value` | số tiền hoặc phần trăm |
| `maxDiscount` | trần giảm (PERCENT) |
| `minSpend` | chi tiêu tối thiểu |
| `customerId` | gán riêng khách (rỗng = dùng chung) |
| `maxRedemptions` | số lượt tối đa |
| `expiresAt` | hạn dùng |

## KHÔNG hỗ trợ CSV
- `loyalty_transactions` / `prepaid_transactions` / `voucher_redemptions` (ledger — sinh từ engine).
- Điểm tích từ **tiền thực thu** (Payment chưa hủy); ví trả trước nạp qua thao tác có kiểm soát.
