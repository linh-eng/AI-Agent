# Triển khai môi trường STAGING

> **Trạng thái:** Mã nguồn & cấu hình **ĐÃ SẴN SÀNG** cho staging. Việc **cấp phát hạ
> tầng** (DB provider, object storage bucket, domain, deploy) **CẦN người quản trị**
> thực hiện trên dashboard các provider — xem mục "Việc cần bạn tự làm". Không tuyên bố
> hạ tầng nào "đã bật" cho tới khi thực sự cấu hình.

Ba môi trường TÁCH BIỆT hoàn toàn (DB + bucket + secret + URL riêng):

| | development | staging | production (phase sau) |
|---|---|---|---|
| DB | Postgres local | Postgres staging riêng | Postgres prod riêng |
| Storage | `local` (FS) | `s3` bucket private staging | `s3` bucket private prod |
| Secret | dev | staging (riêng) | prod (riêng) |
| URL | localhost:3000 | `staging.<domain>` | `<domain>` |

**QUAN TRỌNG (serverless):** Trên Vercel/serverless, filesystem KHÔNG bền vững giữa các
request/instance. Vì vậy **staging & production BẮT BUỘC `STORAGE_DRIVER=s3`** — driver
`local` chỉ hợp lệ cho máy dev.

---

## 1. Biến môi trường (đặt trong dashboard provider, KHÔNG commit)

Danh sách đầy đủ + mô tả: xem `.env.example`. Bắt buộc cho staging:

```
NODE_ENV=production            # bật secure cookies
APP_ENV=staging
APP_URL=https://staging.<domain>
NEXT_PUBLIC_APP_URL=https://staging.<domain>
DATABASE_URL=postgresql://…@…/<db>?sslmode=require
AUTH_SECRET=<openssl rand -base64 48>          # RIÊNG staging
PORTAL_AUTH_SECRET=<openssl rand -base64 48>   # RIÊNG staging, khác AUTH_SECRET
STORAGE_DRIVER=s3
S3_BUCKET=<bucket-private-staging>
S3_REGION=<region|auto>
S3_ENDPOINT=<https://…r2.cloudflarestorage.com | trống nếu AWS>
S3_ACCESS_KEY_ID=<đặt trong secret manager>
S3_SECRET_ACCESS_KEY=<đặt trong secret manager>
S3_FORCE_PATH_STYLE=<true nếu R2/MinIO>
STORAGE_SIGNED_URL_TTL=300
LOG_LEVEL=info
SENTRY_DSN=<tùy chọn>
```

Sinh secret: `openssl rand -base64 48`. **Không** đặt secret vào Git; chỉ đặt trong
Environment Variables của Vercel (hoặc secret manager tương đương).

---

## 2. Tương thích kiến trúc (đã kiểm tra)

- **Next.js 14 App Router** — chạy tốt trên Vercel (serverless/edge). Không nâng Next 16
  trong phase này.
- **Prisma + PostgreSQL** — dùng **connection pooling** trên serverless (Neon pooled URL,
  Supabase pgBouncer, hoặc Prisma Accelerate/Data Proxy) để tránh cạn kết nối.
- **Object storage** — qua `StorageProvider` (S3/R2). Không có FS phụ thuộc khi dùng `s3`.
- **Background jobs** — hiện KHÔNG có worker nền bắt buộc. Việc dọn rác `auth_throttles`
  là cron tùy chọn (xem BACKUP/`.env.example`).
- **Rate limit** — lưu ở **DB** (bảng `auth_throttles`) → đúng trên nhiều instance/serverless
  (không dùng bộ nhớ tiến trình).

---

## 3. Quy trình deploy schema (nguồn chính thức = migration history)

```bash
# DB staging TRẮNG:
npm run prisma:migrate:deploy      # chạy toàn bộ 9 migration theo thứ tự
npm run prisma:migrate:status      # phải in "up to date"
npm run db:seed                    # nạp dữ liệu mẫu (KHÔNG dùng dữ liệu khách thật)

# DB đã chạy bằng db push từ trước (baselining, không mất dữ liệu):
npm run prisma:baseline            # đánh dấu 0_init đã áp
npm run prisma:migrate:deploy
```

- **KHÔNG** dùng `prisma db push` làm chiến lược deploy.
- **KHÔNG** `prisma migrate reset` trên DB có dữ liệu (DROP toàn bộ).
- Tất cả 9 migration hiện tại **additive** (0 lệnh DROP).

---

## 4. Cookie / Session trên HTTPS

- Cookie staff `thng_session` (`AUTH_SECRET`) và portal `thng_portal` (`PORTAL_AUTH_SECRET`)
  — **HttpOnly**, **SameSite=Lax**, **Secure** khi `NODE_ENV=production`.
- Hai phiên cô lập (secret khác + scope khác); token chéo bị từ chối (có test).
- Vì `Secure` bật theo `NODE_ENV=production`, staging phải chạy **HTTPS** (Vercel tự cấp).

---

## 5. Việc cần BẠN tự làm (trên dashboard provider)

> Không gửi secret vào chat. Đặt trực tiếp trong dashboard/Environment Variables.

### 5.1. PostgreSQL staging (Neon / Supabase / RDS)
1. Tạo **project/instance Postgres RIÊNG cho staging** (không dùng chung prod).
2. Tạo database (vd `thng_staging`).
3. Lấy **connection string** (ưu tiên **pooled** cho serverless) → đặt `DATABASE_URL`
   (kèm `?sslmode=require`).
4. Bật **automatic backup / PITR** (xem `docs/BACKUP.md` mục 1) — Neon/Supabase/RDS đều có.

### 5.2. Object storage (Cloudflare R2 hoặc AWS S3)
1. Tạo **bucket PRIVATE** cho staging (KHÔNG bật public access / static hosting).
2. Bật **Versioning** (khôi phục xóa nhầm) + **lifecycle** giữ version theo retention.
3. (AWS) Bật **Block Public Access** ở mức bucket. (R2) không expose public domain.
4. Tạo **access key** giới hạn quyền chỉ bucket này → đặt `S3_*` trong secret manager.
5. Đặt `STORAGE_DRIVER=s3`. (R2: `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=true`, `S3_REGION=auto`.)

### 5.3. Deploy app (Vercel gợi ý)
1. Import repo, chọn branch staging.
2. Nhập toàn bộ Environment Variables mục 1 vào **Environment = Preview/Staging**.
3. Build command mặc định (`next build`); đảm bảo `prisma generate` chạy (đã có trong `build`).
4. Sau deploy đầu tiên: chạy `prisma migrate deploy` + `db:seed` trỏ tới `DATABASE_URL`
   staging (từ máy có quyền, hoặc một lần qua script deploy).

### 5.4. Domain staging
1. Thêm domain `staging.<domain>` vào project, trỏ **DNS CNAME** theo hướng dẫn provider.
2. Chờ cấp HTTPS. Cập nhật `APP_URL`/`NEXT_PUBLIC_APP_URL` = `https://staging.<domain>`.

### 5.5. Monitoring (tùy chọn nhưng khuyến nghị)
- Tạo project Sentry (hoặc tương đương), đặt `SENTRY_DSN`. Xem `docs/MONITORING.md`.

---

## 6. Kiểm thử sau khi staging chạy (smoke)
- Đăng nhập staff + portal (HTTPS).
- Xem 1 hồ sơ khách; upload 1 ảnh (S3) rồi xem qua signed URL.
- Bật/tắt `sharedWithCustomer`, kiểm tra portal phản ánh đúng.
- Tạo booking thử; kiểm tra giá snapshot; hoàn tác.
- Kiểm tra log không lộ secret (mục MONITORING).

---

## 7. KHÔNG làm trong phase này
Deploy production · trỏ domain production · import dữ liệu khách thật · mở portal công khai
cho khách thật · nâng Next.js 16 · xóa migration history · reset DB có dữ liệu · tạo public
bucket cho media khách.
