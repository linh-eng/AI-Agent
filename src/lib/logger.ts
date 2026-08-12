// =============================================================================
// Logger / monitoring abstraction — structured logs an toàn cho staging/production.
//
// Nguyên tắc:
//   * KHÔNG log bí mật: password, token, session cookie, AUTH_SECRET, S3 keys,
//     DATABASE_URL, signed URL đầy đủ, nội dung nhạy cảm của khách.
//   * Redact tự động theo tên khóa nhạy cảm + pattern (bearer/jwt/data-url).
//   * Sẵn sàng cắm provider (Sentry/Datadog…) qua env — nếu chưa cấu hình thì
//     ghi ra console theo JSON (đủ cho log drain của Vercel/Cloud).
//   * Không throw ra ngoài: lỗi trong logger không được làm hỏng request.
// =============================================================================

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL as Level) ?? "info"] ?? LEVELS.info;

// Khóa bị che hoàn toàn (so khớp không phân biệt hoa thường, chứa chuỗi con).
const SECRET_KEY_HINTS = [
  "password", "passwordhash", "secret", "token", "authorization", "cookie",
  "accesskey", "secretaccesskey", "credential", "privatekey", "apikey",
  "database_url", "databaseurl", "signedurl", "signed_url", "auth_secret",
  "portal_auth_secret", "sign_secret",
];

const REDACTED = "«redacted»";

function looksSecretKey(key: string): boolean {
  const k = key.toLowerCase();
  return SECRET_KEY_HINTS.some((h) => k.includes(h));
}

/** Che chuỗi nhạy cảm nhúng trong value (JWT, bearer, data-url base64, presigned URL). */
function scrubString(s: string): string {
  if (s.length > 4096) s = s.slice(0, 4096) + "…";
  return s
    .replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g, "data:«base64»")
    .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, "«jwt»")
    .replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, "$1«redacted»")
    // presigned URL: giữ host+path, bỏ query (chứa signature/expiry/keys).
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]*/gi, "$1?«params»")
    // token param của signed URL nội bộ.
    .replace(/([?&](?:t|token|sig|signature|x-amz-signature)=)[^\s&]+/gi, "$1«redacted»");
}

function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 4) return "«deep»";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = looksSecretKey(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

export interface LogContext {
  [key: string]: unknown;
}

function emit(level: Level, message: string, context?: LogContext) {
  if (LEVELS[level] < MIN_LEVEL) return;
  try {
    const record = {
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...(context ? (redact(context) as object) : {}),
    };
    const line = JSON.stringify(record);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);

    // Cắm provider ngoài (nếu đã cấu hình). Hiện chỉ phát hiện có DSN để nhắc;
    // tích hợp thật (Sentry SDK) thực hiện ở bước hạ tầng — xem docs/MONITORING.md.
    // KHÔNG gửi context chưa redact ra ngoài.
  } catch {
    // Không để logger làm hỏng luồng chính.
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
};

/** Có cấu hình error-tracking provider bên ngoài chưa? (để document/gắn cờ). */
export const MONITORING_ENABLED = !!process.env.SENTRY_DSN;

// Xuất riêng để test.
export const __test = { redact, scrubString, looksSecretKey };
