# Chiến lược Sao lưu & Khôi phục (Backup & Recovery)

> **Trạng thái: TÀI LIỆU / KẾ HOẠCH — CHƯA vận hành.** Các lệnh dưới đây là quy trình
> đề xuất; phải được cấu hình + kiểm thử trên hạ tầng thật trước khi coi là "đã bật".

Hệ thống lưu **2 kho dữ liệu bền vững** cần sao lưu:

1. **PostgreSQL** — toàn bộ dữ liệu nghiệp vụ (khách hàng, booking, phác đồ, báo giá,
   thanh toán, tồn kho, audit log, metadata media…).
2. **Object storage / media** — blob ảnh trước/sau, tệp đính kèm, chữ ký (local FS
   `STORAGE_DIR` hoặc bucket S3 khi `STORAGE_DRIVER=s3`).

Hai kho này **liên kết chéo**: hàng `media_assets` trong DB trỏ tới `storageKey` trong
object storage. Khôi phục phải đảm bảo **cùng một mốc thời gian** để tránh mồ côi.

---

## 1. PostgreSQL

### Tần suất
- **Full logical backup** (`pg_dump`): hằng ngày.
- **PITR / WAL archiving** (khuyến nghị production): bật `archive_mode` + lưu WAL liên tục
  để khôi phục tới thời điểm bất kỳ (RPO ~ vài phút). Với dịch vụ managed (RDS/Cloud SQL)
  bật automated backups + PITR.

### Retention (đề xuất)
- Backup ngày: giữ **14 ngày**.
- Backup tuần (chủ nhật): giữ **8 tuần**.
- Backup tháng: giữ **12 tháng**.
- WAL: giữ đủ để PITR trong cửa sổ 14 ngày.

### Lệnh sao lưu (logical)
```bash
# Nén, an toàn, gồm cả schema + data
pg_dump --format=custom --no-owner --no-privileges \
  "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M).dump
# Đẩy lên nơi lưu trữ off-site (khác vùng), mã hóa at-rest.
```

### Khôi phục (restore)
```bash
# Tạo DB rỗng rồi restore
createdb thng_restore
pg_restore --no-owner --no-privileges --dbname=thng_restore backup_YYYYMMDD_HHMM.dump
# Kiểm tra migration khớp
DATABASE_URL=postgres://…/thng_restore npx prisma migrate status
```

> **KHÔNG** dùng `prisma migrate reset` trên DB có dữ liệu thật (DROP toàn bộ).

---

## 2. Object storage / media

### local driver (`STORAGE_DIR`)
- Sao lưu thư mục `STORAGE_DIR` bằng snapshot khối (LVM/EBS) hoặc `restic`/`rclone`
  đồng bộ sang off-site hằng ngày, mã hóa.
- **Không** khuyến nghị cho production đa-instance (không chia sẻ FS) — chuyển sang S3.

### S3 driver (khuyến nghị production)
- Bật **Versioning** trên bucket (khôi phục xóa nhầm/ghi đè).
- Bật **Object Lock / lifecycle** để giữ phiên bản cũ theo retention (vd 90 ngày).
- **Cross-region replication (CRR)** cho DR.
- Bucket **private** mặc định; chỉ truy cập qua signed URL của ứng dụng.

### Retention
- Giữ version media **90 ngày** (điều chỉnh theo yêu cầu pháp lý về hồ sơ khách).

---

## 3. Quy trình khôi phục production (tổng thể)

1. Khóa ghi (maintenance mode) nếu có thể.
2. Khôi phục **PostgreSQL** tới mốc T (PITR hoặc bản dump gần nhất).
3. Khôi phục **object storage** tới **cùng mốc T** (version phù hợp).
4. Chạy `npx prisma migrate status` — đảm bảo schema khớp mã nguồn đang deploy.
5. Chạy kiểm tra toàn vẹn: đối chiếu `media_assets.storageKey` ↔ blob tồn tại
   (script rà mồ côi 2 chiều).
6. Kiểm thử smoke: đăng nhập staff + portal, xem 1 hồ sơ khách, tải 1 media qua
   signed URL, tạo 1 booking thử (rồi hoàn tác).
7. Mở lại ghi.

### RPO/RTO mục tiêu (đề xuất)
- **RPO** ≤ 15 phút (với PITR/WAL); ≤ 24h nếu chỉ dùng dump ngày.
- **RTO** ≤ 2 giờ.

---

## 4. Kiểm thử khôi phục (bắt buộc trước khi coi là "đã bật")
- **Hằng quý**: thực hiện restore thử vào môi trường tách biệt và chạy smoke test.
- Ghi lại thời gian khôi phục thực tế để hiệu chỉnh RTO.
- Theo dõi cảnh báo job backup thất bại (alerting).

## 5. Việc còn phải làm (chưa triển khai)
- [ ] Cấu hình job `pg_dump`/PITR + off-site + mã hóa.
- [ ] Bật S3 versioning + CRR + lifecycle.
- [ ] Script rà mồ côi DB↔object storage.
- [ ] Lịch kiểm thử restore hằng quý + alerting.
