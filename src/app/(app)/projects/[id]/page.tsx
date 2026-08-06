"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { SERIAL_STATUS_LABEL, SERIAL_STATUS_TONE } from "@/lib/labels";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiFetch(`/api/projects/${id}/inventory`).then(setData).catch(() => {});
  }, [id]);

  if (!data) return <p className="text-muted-foreground">Đang tải...</p>;
  const { project, summary, serials } = data;

  const stats = [
    { label: "Tổng serial", value: summary.total },
    { label: "Đã giao", value: summary.delivered },
    { label: "Còn tồn K-DA", value: summary.inProjectStock },
    { label: "Đang bảo hành", value: summary.inWarranty },
    { label: "Đã đổi/thay", value: summary.replaced },
  ];

  return (
    <div>
      <div className="mb-4">
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Danh sách dự án
        </Link>
      </div>
      <PageHeader
        title={`${project.code} — ${project.name}`}
        description={`Báo cáo hàng theo dự án${project.customer ? " · Khách: " + project.customer.name : ""}`}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}><CardContent className="p-5"><div className="text-2xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Serial</TH><TH>Sản phẩm</TH><TH>Kho</TH><TH>Trạng thái</TH><TH>Ngày</TH></TR></THead>
            <TBody>
              {serials.length === 0 ? (
                <TR><TD colSpan={5} className="py-8 text-center text-muted-foreground">Chưa có serial gắn dự án</TD></TR>
              ) : serials.map((s: any) => (
                <TR key={s.id}>
                  <TD className="font-mono font-medium">{s.serialNumber}</TD>
                  <TD>{s.product.name}</TD>
                  <TD><span className="font-mono">{s.warehouse.code}</span></TD>
                  <TD><Badge tone={SERIAL_STATUS_TONE[s.status]}>{SERIAL_STATUS_LABEL[s.status]}</Badge></TD>
                  <TD className="text-muted-foreground">{formatDate(s.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
