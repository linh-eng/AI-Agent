import { PortalHeader } from "@/components/portal-header";

// Layout CỔNG KHÁCH — tách biệt hoàn toàn với giao diện nhân viên.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <PortalHeader />
      <main className="mx-auto max-w-4xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
