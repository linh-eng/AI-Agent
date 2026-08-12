// =============================================================================
// Tiện ích cho biểu mẫu nhập liệu.
// =============================================================================

/**
 * Nhấn Enter để nhảy sang ô nhập kế tiếp trong cùng form (thay vì submit sớm).
 * - Bỏ qua textarea (cho phép xuống dòng) và nút bấm.
 * - Ở ô cuối cùng: không chặn -> form submit như bình thường.
 * Gắn vào <form onKeyDown={focusNextOnEnter}>.
 *
 * Lưu ý: không can thiệp phím mũi tên — để giữ chỉnh sửa văn bản / tăng-giảm số
 * hoạt động bình thường trong ô.
 */
export function focusNextOnEnter(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter") return;
  const target = e.target as HTMLElement;
  const tag = target.tagName;
  if (tag !== "INPUT" && tag !== "SELECT") return; // textarea/nút: bỏ qua
  const type = (target as HTMLInputElement).type;
  if (type === "submit" || type === "button") return;

  const form = e.currentTarget;
  const fields = Array.from(
    form.querySelectorAll<HTMLElement>("input:not([type='hidden']), select, textarea")
  ).filter((el) => {
    const inp = el as HTMLInputElement;
    return !inp.disabled && !inp.readOnly && el.tabIndex !== -1 && el.offsetParent !== null;
  });

  const idx = fields.indexOf(target);
  if (idx === -1 || idx >= fields.length - 1) return; // ô cuối: để form tự submit

  e.preventDefault();
  const next = fields[idx + 1];
  next.focus();
  const nextInput = next as HTMLInputElement;
  if (typeof nextInput.select === "function" && nextInput.type !== "date") {
    try {
      nextInput.select();
    } catch {
      /* một số loại input không cho select() */
    }
  }
}
