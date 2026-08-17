"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client";
import type { SessionPayload } from "@/lib/auth";
import { ROLE_LABELS, type RoleCode } from "@/lib/rbac";
import { SessionProvider } from "@/components/session-provider";
import { versionLabel } from "@/lib/version";
import { visibleNavGroups, type NavItem } from "@/lib/nav";

/** Active khi trùng href hoặc là tiền tố của route con (giữ nguyên logic cũ). */
function isActivePath(href: string | undefined, pathname: string): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

/** Một mục leaf. */
function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const active = isActivePath(item.href, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

/** Mục cha lồng cấp (IA-PH2) — toggle mở/đóng; tự mở khi có child đang active. */
function NavParent({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const children = item.children ?? [];
  const hasActiveChild = children.some((c) => isActivePath(c.href, pathname));
  const [open, setOpen] = useState(hasActiveChild);
  const Icon = item.icon;
  const expanded = open || hasActiveChild;
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded ? "rotate-180" : "")} />
      </button>
      {expanded && (
        <div className="ml-4 space-y-1 border-l pl-2">
          {children.map((c) => (
            <NavLink key={c.href} item={c} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({
  session,
  brand,
  children,
}: {
  session: SessionPayload;
  brand?: { name: string; logoDataUrl?: string };
  children: React.ReactNode;
}) {
  const brandName = brand?.name || process.env.NEXT_PUBLIC_BRAND_NAME || "Sophia Care";
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

  // Sidebar render theo QUYỀN của phiên (permission-based). Nhóm rỗng bị bỏ.
  const navGroups = visibleNavGroups(session.permissions, {
    hideWarehouse: process.env.NEXT_PUBLIC_HIDE_WAREHOUSE === "true",
  });

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
          {brand?.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoDataUrl} alt={brandName} className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
          )}
          <span className="font-semibold">{brandName}</span>
        </div>
        <nav className="max-h-[calc(100vh-3.5rem)] space-y-4 overflow-y-auto p-3">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </div>
              {group.items.map((item) =>
                item.children && item.children.length > 0 ? (
                  <NavParent key={item.label} item={item} pathname={pathname} onNavigate={() => setOpen(false)} />
                ) : (
                  <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setOpen(false)} />
                )
              )}
            </div>
          ))}
          {/* Phiên bản — tiện theo dõi khi cập nhật */}
          <div className="px-3 pt-2 text-center text-[11px] text-muted-foreground/60">
            {versionLabel()}
          </div>
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
