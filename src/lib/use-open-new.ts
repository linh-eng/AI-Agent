"use client";
// Tự mở form "Tạo mới" khi URL có ?new=1 (deep-link từ nút "+" ở nơi khác).
// Đọc từ window.location (client-only) → KHÔNG cần Suspense như useSearchParams.
import { useEffect } from "react";

export function useOpenNew(open: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("new") === "1") open();
    } catch {
      /* no-op */
    }
    // chỉ chạy 1 lần khi vào trang (theo enabled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
