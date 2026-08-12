import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

/** Định dạng NGÀY GIỜ kiểu VN: dd/MM/yyyy HH:mm. */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
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

/** Định dạng ngày kiểu VN dd/MM/yyyy. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
