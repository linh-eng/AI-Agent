"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { PRESCRIPTION_STATUS_LABEL } from "@/lib/prescription";
import { printPrescription as doPrint } from "@/lib/print";

const TONE: Record<string, "muted" | "success" | "warning"> = { DRAFT: "warning", ISSUED: "success", CANCELLED: "muted" };

export default function PrescriptionDetail() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<any | null>(null);
  useEffect(() => { apiFetch<any>(`/api/prescriptions/${id}`).then(setP).catch(() => {}); }, [id]);

  return (
    <div>
      <PageHeader
        title={p ? `Toa ${p.code}` : "Toa"}
        description="Kê toa chăm sóc sau thực hiện — sản phẩm dùng tại nhà + lời dặn."
        action={p && <Button variant="outline" onClick={() => doPrint(p)}><Printer className="h-4 w-4" /> In toa</Button>}
      />
      <Link href="/prescriptions" className="mb-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Danh sách toa</Link>
      {!p ? <p className="text-muted-foreground">Đang tải...</p> : (
        <Card><CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TONE[p.status] ?? "muted"}>{PRESCRIPTION_STATUS_LABEL[p.status] ?? p.status}</Badge>
            <span className="text-sm text-muted-foreground">{formatDate(p.issuedAt || p.createdAt)}</span>
            {p.session?.code && <span className="text-sm text-muted-foreground">· Buổi {p.session.code}</span>}
          </div>
          <div className="text-sm">
            <div className="font-medium">{p.customer?.fullName} <span className="font-mono text-muted-foreground">{p.customer?.code}</span></div>
            {p.customer?.phone && <div className="text-muted-foreground">{p.customer.phone}</div>}
          </div>
          {p.diagnosis && <div className="text-sm"><span className="text-muted-foreground">Nhận định: </span>{p.diagnosis}</div>}
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Sản phẩm kê dùng tại nhà</div>
            <div className="overflow-x-auto"><Table>
              <THead><TR><TH>#</TH><TH>Sản phẩm</TH><TH className="text-right">SL</TH><TH>Cách dùng</TH><TH>Tần suất</TH><TH>Thời điểm</TH><TH>Thời gian</TH></TR></THead>
              <TBody>
                {(p.items ?? []).length === 0 ? <TR><TD colSpan={7} className="py-4 text-center text-muted-foreground">Không có sản phẩm</TD></TR> :
                  p.items.map((it: any, i: number) => (
                    <TR key={it.id}><TD>{i + 1}</TD><TD className="font-medium">{it.name}</TD>
                      <TD className="text-right">{it.quantity != null ? Number(it.quantity) : ""} {it.unit ?? ""}</TD>
                      <TD>{it.usage ?? "—"}</TD><TD>{it.frequency ?? "—"}</TD><TD>{it.timing ?? "—"}</TD>
                      <TD>{it.durationDays ? `${it.durationDays} ngày` : "—"}</TD></TR>
                  ))}
              </TBody>
            </Table></div>
          </div>
          {p.advice && <div className="text-sm"><span className="text-muted-foreground">Lời dặn: </span>{p.advice}</div>}
          {p.followUpDate && <div className="text-sm">Hẹn tái khám: <b>{formatDate(p.followUpDate)}</b></div>}
          {p.issuedBy && <div className="text-sm text-muted-foreground">Người kê: {p.issuedBy}</div>}
          {p.status === "CANCELLED" && p.cancelReason && <div className="text-sm text-destructive">Đã hủy: {p.cancelReason}</div>}
        </CardContent></Card>
      )}
    </div>
  );
}
