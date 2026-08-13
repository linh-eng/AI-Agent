// =============================================================================
// Tiện ích cho biểu mẫu nhập liệu.
// =============================================================================

// Các ô được coi là "ô nhập" trong luồng Enter chuyển ô. Gồm cả nút Combobox
// (đánh dấu data-nav) để Enter cũng dừng ở ô chọn có gõ-tìm.
const FIELD_SELECTOR = "input:not([type='hidden']), select, textarea, button[data-nav]";

function formFields(form: HTMLFormElement): HTMLElement[] {
  return Array.from(form.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter((el) => {
    const inp = el as HTMLInputElement;
    return !inp.disabled && !inp.readOnly && el.tabIndex !== -1 && el.offsetParent !== null;
  });
}

/** Đưa con trỏ sang ô kế tiếp sau `from` trong cùng form. Trả về true nếu có. */
export function focusNextField(from: HTMLElement): boolean {
  const form = from.closest("form");
  if (!form) return false;
  const fields = formFields(form as HTMLFormElement);
  const idx = fields.indexOf(from);
  if (idx === -1 || idx >= fields.length - 1) return false;
  const next = fields[idx + 1];
  next.focus();
  const ni = next as HTMLInputElement;
  if (typeof ni.select === "function" && ni.type !== "date" && ni.type !== "number") {
    try {
      ni.select();
    } catch {
      /* một số loại input không cho select() */
    }
  }
  return true;
}

/**
 * Nhấn Enter để nhảy sang ô nhập kế tiếp trong cùng form (thay vì submit sớm).
 * - Bỏ qua textarea (cho phép xuống dòng) và nút bấm thường.
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

  const fields = formFields(e.currentTarget);
  const idx = fields.indexOf(target);
  if (idx === -1 || idx >= fields.length - 1) return; // ô cuối: để form tự submit

  e.preventDefault();
  focusNextField(target);
}
