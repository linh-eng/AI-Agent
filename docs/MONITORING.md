# Monitoring & Error Tracking

> **Trạng thái:** Có sẵn **tầng logger có REDACT** (`src/lib/logger.ts`) ghi JSON ra
> stdout — đủ cho log drain của Vercel/Cloud. Tích hợp provider ngoài (Sentry) là **bước
> hạ tầng** cần đặt `SENTRY_DSN` + cài SDK; **CHƯA bật** cho tới khi cấu hình thật.

## Kiến trúc hiện tại

- **`src/lib/logger.ts`** — `logger.debug/info/warn/error(msg, context)`:
  - Ghi **JSON có timestamp + level** ra stdout/stderr (Vercel thu vào log drain).
  - **REDACT tự động**: che khóa nhạy cảm (`password`, `*secret*`, `token`, `cookie`,
    `*accesskey*`, `credential`, `database_url`, `auth_secret`…) và pattern trong value
    (JWT, `Bearer …`, `data:…;base64,…`, query của presigned/​signed URL).
  - Cấp độ theo `LOG_LEVEL` (debug|info|warn|error).
- **Đã gắn**: `handle()` (API) log mọi lỗi 500 có redact rồi trả thông báo chung tiếng
  Việt; biến động vật tư/khóa đăng nhập ghi qua `AuditLog`; chữ ký lỗi lưu → `logger.error`.

## Cần theo dõi (nên cấu hình alert)
Server errors (5xx) · thất bại xác thực (audit `LOGIN`, `LOGIN_THROTTLED`) · sự kiện
rate-limit · lỗi storage (put/get/signed URL) · lỗi DB/kết nối · lỗi migration khi deploy ·
lỗi API nghiêm trọng.

## KHÔNG được log
Mật khẩu · session token · `AUTH_SECRET`/`PORTAL_AUTH_SECRET` · `DATABASE_URL` ·
`S3_*` keys · signed URL đầy đủ (chỉ log host+path, bỏ query) · nội dung nhạy cảm của khách
(chữ ký/ảnh/giá vốn). Logger đã redact các mục này; **không** tự ý `console.log` object thô
chứa các trường trên — luôn qua `logger`.

## Việc cần bạn tự làm (bật provider ngoài)
1. Tạo project **Sentry** (hoặc Datadog/Logtail…). Lấy DSN.
2. Đặt `SENTRY_DSN` trong Environment Variables staging.
3. Cài SDK (`@sentry/nextjs`) + `sentry.client/server.config` **[bước hạ tầng, chưa làm]** —
   khi cài, gọi `Sentry.captureException` bên trong `logger.error` (đã có chỗ móc, hiện chỉ
   đặt cờ `MONITORING_ENABLED`). **KHÔNG** gửi context chưa redact.
4. Cấu hình **alert**: 5xx spike, login-throttle spike, storage/DB errors.
5. Trên Vercel: bật **Log Drains** để lưu log JSON dài hạn nếu cần.

> Trung thực: hiện log mới ra stdout + redact. Alerting/aggregation là việc phải cấu hình
> trên hạ tầng — chưa coi là "đã bật".
