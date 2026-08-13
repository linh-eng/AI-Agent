"use client";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, LogOut } from "lucide-react";

export function PortalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/portal/login") return null;

  async function logout() {
    await fetch("/api/portal/logout", { method: "POST" }).catch(() => {});
    router.replace("/portal/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-semibold">Cổng khách hàng · {process.env.NEXT_PUBLIC_BRAND_NAME || "Sophia Care"}</span>
        </div>
        <button onClick={logout} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          <LogOut className="h-4 w-4" /> Đăng xuất
        </button>
      </div>
    </header>
  );
}
