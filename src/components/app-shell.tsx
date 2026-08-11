"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Sparkles,
  LayoutDashboard,
  Gauge,
  PackagePlus,
  PackageMinus,
  ArrowLeftRight,
  ClipboardCheck,
  Bell,
  Package,
  Tags,
  Award,
  Truck,
  Warehouse,
  HeartPulse,
  ClipboardList,
  Cpu,
  Zap,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client";
import type { SessionPayload } from "@/lib/auth";
import { ROLE_LABELS, PERMISSIONS, type RoleCode } from "@/lib/rbac";
import { SessionProvider } from "@/components/session-provider";

const NAV = [
  {
    section: "Tổng quan",
    items: [{ href: "/dashboard", label: "Bảng điều khiển", icon: LayoutDashboard }],
  },
  {
    section: "Kho vận",
    items: [
      { href: "/inventory", label: "Tồn kho", icon: Gauge },
      { href: "/inbound", label: "Nhập kho", icon: PackagePlus },
      { href: "/outbound", label: "Xuất kho", icon: PackageMinus },
      { href: "/transfers", label: "Chuyển kho", icon: ArrowLeftRight },
      { href: "/stock-counts", label: "Kiểm kê", icon: ClipboardCheck },
      { href: "/alerts", label: "Cảnh báo", icon: Bell },
      { href: "/reports", label: "Báo cáo", icon: BarChart3 },
    ],
  },
  {
    section: "Dịch vụ & Thiết bị",
    items: [
      { href: "/services", label: "Liệu trình dịch vụ", icon: HeartPulse },
      { href: "/service-usage", label: "Ghi nhận dịch vụ", icon: ClipboardList },
      { href: "/assets", label: "Tài sản / Thiết bị", icon: Cpu },
      { href: "/handpieces", label: "Tay cầm / Shot", icon: Zap },
    ],
  },
  {
    section: "Danh mục",
    items: [
      { href: "/products", label: "Sản phẩm", icon: Package },
      { href: "/categories", label: "Nhóm hàng", icon: Tags },
      { href: "/brands", label: "Thương hiệu", icon: Award },
      { href: "/suppliers", label: "Nhà cung cấp", icon: Truck },
      { href: "/warehouses", label: "Kho", icon: Warehouse },
    ],
  },
  {
    section: "Hệ thống",
    items: [
      { href: "/users", label: "Người dùng", icon: Users, perm: PERMISSIONS.USER_MANAGE },
      { href: "/settings", label: "Cài đặt công ty", icon: Settings, perm: PERMISSIONS.SETTING_MANAGE },
    ],
  },
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
  const [company, setCompany] = useState<{ name: string; logo: string | null }>({
    name: "Sophia Wellness",
    logo: null,
  });

  useEffect(() => {
    apiFetch<any>("/api/settings")
      .then((s) => {
        setCompany({ name: s.name || "Sophia Wellness", logo: s.logo ?? null });
        // Lưu để phiếu in dùng lại (đọc đồng bộ khi mở cửa sổ in).
        try {
          localStorage.setItem("sophia_company", JSON.stringify(s));
        } catch {}
      })
      .catch(() => {});
  }, []);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const roleLabels = session.roles
    .map((r) => ROLE_LABELS[r as RoleCode] ?? r)
    .join(", ");

  const canSee = (perm?: string) => !perm || session.permissions.includes(perm);

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
          {company.logo ? (
            <div className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-xl border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={company.logo} alt="logo" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(204_90%_58%)] text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
          )}
          <div className="leading-tight">
            <div className="font-display text-[15px] font-semibold">{company.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Quản lý kho</div>
          </div>
        </div>
        <nav className="space-y-4 p-3">
          {NAV.map((group) => {
            const items = group.items.filter((it: any) => canSee(it.perm));
            if (items.length === 0) return null;
            return (
            <div key={group.section}>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.section}
              </div>
              <div className="space-y-1">
                {items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
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
              </div>
            </div>
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
