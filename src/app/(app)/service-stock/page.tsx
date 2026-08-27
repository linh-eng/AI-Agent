"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";

interface Item {
  id: string;
  product: { id: string; sku: string; name: string; uom: string; category?: { name: string } | null };
  service?: { id: string; code: string; name: string } | null;
  openedDate: string;
  expiryDate?: string | null;
  initialQty: number;
  remainingQty: number;
  status: "IN_USE" | "EMPTY";
  openedBy: { name: string };
  updatedBy?: { name: string } | null;
}
interface Norm {
  productId: string;
  quantity: number;
  serviceCode: string;
  serviceName: string;
}

function daysToExpiry(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

// Trạng thái hiển thị: Đã hết / Hết HSD / Sắp hết HSD / Đang sử dụng.
function statusBadge(it: Item) {
  if (it.status === "EMPTY") return <Badge tone="muted">Đã hết</Badge>;
  const d = daysToExpiry(it.expiryDate);
  if (d != null && d < 0) return <Badge tone="danger">Hết HSD</Badge>;
  if (d != null && d <= 30) return <Badge tone="warning">Sắp hết HSD ({d} ngày)</Badge>;
  return <Badge tone="success">Đang sử dụng</Badge>;
}

export default function ServiceStockPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [norms, setNorms] = useState<Norm[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch<{ items: Item[]; norms: Norm[] }>("/api/service-stock");
      setItems(d.items);
      setNorms(d.norms);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const normsByProduct = new Map<string, Norm[]>();
  for (const n of norms) {
    const arr = normsByProduct.get(n.productId) ?? [];
    arr.push(n);
    normsByProduct.set(n.productId, arr);
  }

  const filtered = items.filter(
    (i) => i.product.name.toLowerCase().includes(q.toLowerCase()) || i.product.sku.toLowerCase().includes(q.toLowerCase())
  );
  const cols = 9;

  return (
    <div>
      <PageHeader
        title="Kho Dịch Vụ"
        description="Theo dõi hàng đã mở nắp dùng cho dịch vụ (liên kết theo mã hàng). Cột “Còn lại” = tồn thực tế của sản phẩm; HSD sau mở lấy theo sản phẩm/nhóm hàng. Tự cập nhật khi ghi nhận dịch vụ."
      />
      <div className="mb-4">
        <Input placeholder="Tìm theo tên / SKU…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Hàng hóa</TH>
                <TH>Mã liệu trình</TH>
                <TH>Ngày mở nắp</TH>
                <TH>Người mở / cập nhật</TH>
                <TH className="text-right">Còn lại</TH>
                <TH>HSD sau mở</TH>
                <TH>Định mức theo dịch vụ</TH>
                <TH>Trạng thái</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={cols} className="py-8 text-center text-muted-foreground">Đang tải…</TD>
                </TR>
              ) : filtered.length === 0 ? (
                <TR>
                  <TD colSpan={cols} className="py-8 text-center text-muted-foreground">
                    {items.length === 0 ? "Chưa có hàng mở nắp. Ghi nhận dịch vụ sẽ tự đưa hàng vào đây." : "Không tìm thấy"}
                  </TD>
                </TR>
              ) : (
                filtered.map((it) => {
                  const d = daysToExpiry(it.expiryDate);
                  const productNorms = normsByProduct.get(it.product.id) ?? [];
                  return (
                    <TR key={it.id}>
                      <TD className="font-mono text-xs">{it.product.sku}</TD>
                      <TD>
                        <div className="font-medium">{it.product.name}</div>
                        {it.product.category?.name && (
                          <div className="text-xs text-muted-foreground">{it.product.category.name}</div>
                        )}
                      </TD>
                      <TD>
                        {it.service ? (
                          <Link href={`/services?focus=${encodeURIComponent(it.service.code)}`} className="font-mono text-primary hover:underline" title={it.service.name}>
                            {it.service.code}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TD>
                      <TD>{formatDate(it.openedDate)}</TD>
                      <TD className="text-muted-foreground">
                        <div>{it.openedBy?.name ?? "—"}</div>
                        {it.updatedBy?.name && it.updatedBy.name !== it.openedBy?.name && (
                          <div className="text-xs">cập nhật: {it.updatedBy.name}</div>
                        )}
                      </TD>
                      <TD className="text-right">
                        <span className={it.remainingQty <= 0 ? "text-muted-foreground" : "font-medium"}>
                          {formatNumber(it.remainingQty)} {it.product.uom}
                        </span>
                      </TD>
                      <TD>
                        {it.expiryDate ? (
                          <div>
                            {formatDate(it.expiryDate)}
                            {d != null && (
                              <div className={`text-xs ${d < 0 ? "text-destructive" : d <= 30 ? "text-amber-600" : "text-muted-foreground"}`}>
                                {d < 0 ? `quá ${Math.abs(d)} ngày` : `còn ${d} ngày`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground" title="Nhóm chưa cấu hình PAO">—</span>
                        )}
                      </TD>
                      <TD>
                        {productNorms.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {productNorms.map((n, i) => (
                              <Badge key={i} tone="muted">
                                {n.serviceName}: {formatNumber(n.quantity)} {it.product.uom}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TD>
                      <TD>{statusBadge(it)}</TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
