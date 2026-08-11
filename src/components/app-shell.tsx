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
  PackagePlus,
  ScanBarcode,
  Boxes,
  Wrench,
  Gauge,
  ClipboardList,
  PackageMinus,
  ShieldCheck,
  Hammer,
  BarChart3,
  Sparkles,
  CalendarDays,
  HeartPulse,
  ListTodo,
  Building2,
  Cpu,
  ScrollText,
  ShoppingBag,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client";
import type { SessionPayload } from "@/lib/auth";
import { ROLE_LABELS, type RoleCode } from "@/lib/rbac";
import { SessionProvider } from "@/components/session-provider";

const NAV_GROUPS = [
  {
    title: "Spa & CRM",
    items: [
      { href: "/crm", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/customers", label: "Khách hàng", icon: Users },
      { href: "/bookings", label: "Booking", icon: CalendarDays },
      { href: "/services", label: "Dịch vụ", icon: Sparkles },
      { href: "/treatment-plans", label: "Phác đồ", icon: HeartPulse },
      { href: "/tasks", label: "Công việc / Follow-up", icon: ListTodo },
    ],
  },
  {
    title: "Thư viện Spa",
    items: [
      { href: "/brands", label: "Brand", icon: Building2 },
      { href: "/technologies", label: "Công nghệ", icon: Cpu },
      { href: "/protocols", label: "Protocol", icon: ScrollText },
      { href: "/catalog", label: "Sản phẩm", icon: ShoppingBag },
      { href: "/form-templates", label: "Biểu mẫu", icon: FileText },
    ],
  },
  {
    title: "Kho THNG",
    items: [
      { href: "/dashboard", label: "Tổng quan kho", icon: Gauge },
      { href: "/inventory", label: "Tồn kho", icon: Boxes },
      { href: "/inbound", label: "Nhập kho", icon: PackagePlus },
      { href: "/outbound", label: "Xuất kho", icon: PackageMinus },
      { href: "/work-orders", label: "Lắp ráp", icon: Wrench },
      { href: "/warranty", label: "Bảo hành / RMA", icon: ShieldCheck },
      { href: "/disassembly", label: "Rã máy", icon: Hammer },
      { href: "/stock-counts", label: "Kiểm kê", icon: ClipboardList },
      { href: "/serials", label: "Serial", icon: ScanBarcode },
      { href: "/reports", label: "Báo cáo", icon: BarChart3 },
      { href: "/warehouses", label: "Danh mục kho", icon: Warehouse },
      { href: "/bins", label: "Vị trí kệ", icon: MapPin },
      { href: "/projects", label: "Dự án", icon: FolderKanban },
      { href: "/partners", label: "NCC / Đối tác", icon: Users },
      { href: "/products", label: "Sản phẩm", icon: Package },
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
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-semibold">THNG Suite</span>
        </div>
        <nav className="max-h-[calc(100vh-3.5rem)] space-y-4 overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </div>
              {group.items.map((item) => {
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
          ))}
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
