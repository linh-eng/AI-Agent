import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { VN_TZ } from "./timezone";

/** Ghép className có xử lý xung đột Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Định dạng số kiểu VN (dấu chấm ngăn nghìn). */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("vi-VN").format(value);
}

/** Định dạng TIỀN TỆ thống nhất toàn hệ thống: "2.500.000 ₫" (locale vi-VN). */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(n)} ₫`;
}

/**
 * Định dạng NGÀY GIỜ kiểu VN: dd/MM/yyyy HH:mm.
 * Thời gian lưu là true-UTC → convert sang Asia/Ho_Chi_Minh (chuẩn hiển thị nghiệp
 * vụ, xem `src/lib/timezone.ts`) → cùng record hiển thị GIỐNG NHAU ở mọi màn, bất
 * kể múi giờ trình duyệt/máy chủ.
 */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: VN_TZ,
  }).format(d);
}

/**
 * Nguồn hiển thị cho một media: nếu là URL/dataURL cũ thì giữ nguyên (tương thích
 * ngược); nếu là media asset id thì trỏ tới route riêng tư có kiểm quyền.
 */
export function mediaSrc(idOrUrl: string): string {
  if (/^(https?:|data:|blob:|\/api\/)/.test(idOrUrl)) return idOrUrl;
  return `/api/media/${idOrUrl}`;
}

/** Tính tuổi từ ngày sinh (năm tròn). Trả null nếu không có/không hợp lệ. */
export function computeAge(dob: Date | string | null | undefined, now?: Date): number | null {
  if (!dob) return null;
  const d = typeof dob === "string" ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;
  const ref = now ?? new Date();
  let age = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
  return age >= 0 && age < 200 ? age : null;
}

/** Định dạng ngày kiểu VN dd/MM/yyyy (convert Asia/Ho_Chi_Minh — xem `formatDateTime`). */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: VN_TZ,
  }).format(d);
}
