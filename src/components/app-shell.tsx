"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Warehouse,
  LayoutDashboard,
  FolderKanban,
  Users,
  Package,
  MapPin,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client";
import type { SessionPayload } from "@/lib/auth";
import { ROLE_LABELS, type RoleCode } from "@/lib/rbac";
import { SessionProvider } from "@/components/session-provider";

const NAV = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/warehouses", label: "Danh mục kho", icon: Warehouse },
  { href: "/bins", label: "Vị trí kệ", icon: MapPin },
  { href: "/projects", label: "Dự án", icon: FolderKanban },
  { href: "/partners", label: "NCC / Khách hàng", icon: Users },
  { href: "/products", label: "Sản phẩm", icon: Package },
];

export function AppShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const roleLabels = session.roles
    .map((r) => ROLE_LABELS[r as RoleCode] ?? r)
    .join(", ");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Warehouse className="h-4 w-4" />
          </div>
          <span className="font-semibold">THNG Kho</span>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          <button
            className="rounded-md p-2 hover:bg-accent lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="text-right">
              <div className="text-sm font-medium leading-tight">{session.name}</div>
              <div className="text-xs text-muted-foreground">{roleLabels}</div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <SessionProvider session={session}>{children}</SessionProvider>
        </main>
      </div>
    </div>
  );
}
