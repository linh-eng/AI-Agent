import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Warehouse, FolderKanban, Users, Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [warehouses, projectCount, partnerCount, productCount] = await Promise.all([
    prisma.warehouse.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { serials: true } } },
    }),
    prisma.project.count(),
    prisma.partner.count(),
    prisma.product.count(),
  ]);

  const stats = [
    { label: "Kho", value: warehouses.length, icon: Warehouse, href: "/warehouses" },
    { label: "Dự án", value: projectCount, icon: FolderKanban, href: "/projects" },
    { label: "NCC / Khách hàng", value: partnerCount, icon: Users, href: "/partners" },
    { label: "Sản phẩm", value: productCount, icon: Package, href: "/products" },
  ];

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description="Phase 1 — danh mục nền tảng: kho, dự án, đối tác, sản phẩm."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tồn theo kho</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Mã kho</TH>
                <TH>Tên kho</TH>
                <TH>Tính tồn khả dụng</TH>
                <TH className="text-right">Số serial</TH>
              </TR>
            </THead>
            <TBody>
              {warehouses.map((w) => (
                <TR key={w.id}>
                  <TD className="font-mono font-medium">{w.code}</TD>
                  <TD>{w.name}</TD>
                  <TD>
                    {w.countsAsAvailable ? (
                      <Badge tone="success">Có</Badge>
                    ) : (
                      <Badge tone="danger">Không</Badge>
                    )}
                  </TD>
                  <TD className="text-right font-medium">{w._count.serials}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
