"use client";
import * as React from "react";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusNextField } from "@/lib/form";

export interface ComboItem {
  value: string;
  label: string;
  /** Từ khóa phụ để tìm (vd SKU, mã) — gộp vào chuỗi tìm kiếm. */
  keywords?: string;
}

/**
 * Ô chọn có gõ chữ để lọc (thay cho <select> khi danh sách dài).
 * - Gõ từ khóa -> lọc theo label + keywords (không phân biệt hoa/thường, bỏ dấu).
 * - Chuột hoặc phím ↑/↓ + Enter để chọn; Esc để đóng.
 * - Enter khi đang mở sẽ chọn mục, KHÔNG lan ra form (không nhảy ô/submit).
 */
export function Combobox({
  items,
  value,
  onChange,
  placeholder = "— Chọn —",
  searchPlaceholder = "Gõ để tìm…",
  required,
  disabled,
  className,
  emptyText = "Không tìm thấy",
}: {
  items: ComboItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const selected = items.find((i) => i.value === value) ?? null;

  const filtered = React.useMemo(() => {
    const q = norm(query);
    if (!q) return items;
    return items.filter((i) => norm(`${i.label} ${i.keywords ?? ""}`).includes(q));
  }, [items, query]);

  // Đóng khi bấm ra ngoài.
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus ô tìm sau khi mở
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    // Sau khi chọn xong, tự chuyển sang ô kế tiếp cho mượt (giống Enter chuyển ô).
    if (triggerRef.current) focusNextField(triggerRef.current);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      // Không để Enter lan ra form (nhảy ô / submit).
      e.preventDefault();
      e.stopPropagation();
      if (filtered[active]) pick(filtered[active].value);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* Ô hidden để form vẫn kiểm tra required như <select> */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}
      <button
        ref={triggerRef}
        type="button"
        data-nav
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-1 text-left text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {selected && !required && (
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-card shadow-lg">
          <div className="border-b p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted-foreground">{emptyText}</li>
            ) : (
              filtered.map((it, i) => (
                <li key={it.value}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(it.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm",
                      i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                    )}
                  >
                    <span className="truncate">{it.label}</span>
                    {it.value === value && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Bỏ dấu tiếng Việt + hạ chữ thường để tìm gần đúng.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}
