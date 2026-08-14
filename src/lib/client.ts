// Tiện ích gọi API phía client — ném lỗi kèm message tiếng Việt từ server.
// Lỗi ném ra mang thêm `status` (HTTP) và `details` (object gốc từ server) để UI
// xử lý các trường hợp đặc biệt (vd 409 chống trùng lần áp quy trình CSKH).
export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function isFieldErrors(details: unknown): boolean {
  // Chỉ coi là lỗi field (validation) khi mọi value là mảng chuỗi.
  if (!details || typeof details !== "object") return false;
  return Object.values(details as Record<string, unknown>).every((v) => Array.isArray(v));
}

export async function apiFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Chỉ nối chi tiết vào message khi là lỗi field dạng mảng (validation).
    const detail = isFieldErrors(json?.details)
      ? " — " +
        Object.entries(json.details)
          .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
          .join("; ")
      : "";
    throw new ApiError((json?.error ?? "Có lỗi xảy ra") + detail, res.status, json?.details);
  }
  return json.data as T;
}
