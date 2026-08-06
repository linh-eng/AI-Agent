"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { INBOUND_TYPE_LIST, INBOUND_TYPES, DOC_LABELS, type InboundTypeCode } from "@/lib/inbound";
import { DOC_STATUS_LABEL, DOC_STATUS_TONE } from "@/lib/labels";

interface Order {
  id: string;
  number: string;
  type: string;
  status: string;
  poNumber?: string | null;
  createdAt: string;
  supplier?: { code: string; name: string } | null;
  _count?: { lines: number };
}
interface Opt { id: string; code: string; name: string; sku?: string; trackingMode?: string }

interface LineForm {
  productId: string;
  supplierId: string;
  projectId: string;
  isCommercialStock: boolean;
  quantity: string;
  yearOfManufacture: string;
  originCountry: string;
}

const emptyLine: LineForm = {
  productId: "", supplierId: "", projectId: "", isCommercialStock: false,
  quantity: "1", yearOfManufacture: "", originCountry: "",
};

export default function InboundPage() {
  const router = useRouter();
  const canWrite = useCan(PERMISSIONS.INBOUND_WRITE);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<Opt[]>([]);
  const [suppliers, setSuppliers] = useState<Opt[]>([]);
  const [projects, setProjects] = useState<Opt[]>([]);

  const [type, setType] = useState<InboundTypeCode>("N1");
  const [header, setHeader] = useState({ supplierId: "", poNumber: "", invoiceNumber: "", note: "" });
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }]);

  const config = INBOUND_TYPES[type];

  async function load() {
    setLoading(true);
    try {
      setOrders(await apiFetch<Order[]>("/api/inbound"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function openModal() {
    setError(null);
    const [p, s, pr] = await Promise.all([
      apiFetch<Opt[]>("/api/products"),
      apiFetch<Opt[]>("/api/partners?type=SUPPLIER"),
      apiFetch<Opt[]>("/api/projects"),
    ]);
    setProducts(p);
    setSuppliers(s);
    setProjects(pr);
    setOpen(true);
  }

  function updateLine(i: number, patch: Partial<LineForm>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        type,
        supplierId: header.supplierId || null,
        poNumber: header.poNumber || null,
        invoiceNumber: header.invoiceNumber || null,
        note: header.note || null,
        lines: lines.map((l) => ({
          productId: l.productId,
          supplierId: l.supplierId || header.supplierId,
          projectId: l.projectId || null,
          isCommercialStock: l.isCommercialStock,
          quantity: Number(l.quantity),
          yearOfManufacture: l.yearOfManufacture ? Number(l.yearOfManufacture) : null,
          originCountry: l.originCountry || null,
        })),
      };
      const order = await apiFetch<{ id: string }>("/api/inbound", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOpen(false);
      setLines([{ ...emptyLine }]);
      setHeader({ supplierId: "", poNumber: "", invoiceNumber: "", note: "" });
      router.push(`/inbound/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Nhập kho"
        description="Tạo phiếu nhập theo mã loại nghiệp vụ (N1–N12); hệ thống bung checklist chứng từ và set kho đích."
        action={
          canWrite && (
            <Button onClick={openModal}>
              <Plus className="h-4 w-4" /> Tạo phiếu nhập
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Số phiếu</TH>
                <TH>Loại</TH>
                <TH>NCC</TH>
                <TH>PO</TH>
                <TH className="text-right">Số dòng</TH>
                <TH>Trạng thái</TH>
                <TH>Ngày tạo</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : orders.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có phiếu nhập</TD></TR>
              ) : (
                orders.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <Link href={`/inbound/${o.id}`} className="font-mono font-medium text-primary hover:underline">
                        {o.number}
                      </Link>
                    </TD>
                    <TD>
                      <span className="font-mono">{o.type}</span>{" "}
                      <span className="text-muted-foreground">{INBOUND_TYPES[o.type as InboundTypeCode]?.label}</span>
                    </TD>
                    <TD>{o.supplier?.name ?? "—"}</TD>
                    <TD>{o.poNumber ?? "—"}</TD>
                    <TD className="text-right">{o._count?.lines ?? 0}</TD>
                    <TD><Badge tone={DOC_STATUS_TONE[o.status]}>{DOC_STATUS_LABEL[o.status]}</Badge></TD>
                    <TD className="text-muted-foreground">{formatDate(o.createdAt)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo phiếu nhập" className="max-w-4xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Loại nghiệp vụ *</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as InboundTypeCode)}>
                {INBOUND_TYPE_LIST.map((t) => (
                  <option key={t.code} value={t.code}>{t.code} — {t.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>NCC {config.requiredDocs.includes("supplier") && "*"}</Label>
              <Select value={header.supplierId} onChange={(e) => setHeader({ ...header, supplierId: e.target.value })}>
                <option value="">— Chọn NCC —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Số PO {config.requiredDocs.includes("po") && "*"}</Label>
              <Input value={header.poNumber} onChange={(e) => setHeader({ ...header, poNumber: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Hóa đơn GTGT {config.requiredDocs.includes("invoice") && "*"}</Label>
              <Input value={header.invoiceNumber} onChange={(e) => setHeader({ ...header, invoiceNumber: e.target.value })} />
            </div>
          </div>

          {/* Checklist chứng từ + kho đích */}
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="mb-1">
              <span className="font-medium">Kho đích:</span>{" "}
              {config.destinationWarehouseCode ? (
                <Badge tone="default" className="font-mono">{config.destinationWarehouseCode}</Badge>
              ) : (
                <span className="text-muted-foreground">Theo phiếu chuyển kho</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="font-medium">Chứng từ bắt buộc:</span>
              {config.requiredDocs.length === 0 ? (
                <span className="text-muted-foreground">Không</span>
              ) : (
                config.requiredDocs.map((d) => <Badge key={d} tone="warning">{DOC_LABELS[d]}</Badge>)
              )}
            </div>
            {config.note && <p className="mt-1 text-xs text-muted-foreground">{config.note}</p>}
          </div>

          {/* Dòng hàng */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Danh sách hàng</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { ...emptyLine }])}>
                <Plus className="h-4 w-4" /> Thêm dòng
              </Button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <Label className="text-xs">Sản phẩm *</Label>
                  <Select value={l.productId} onChange={(e) => updateLine(i, { productId: e.target.value })} required>
                    <option value="">— Chọn —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name} [{p.trackingMode}]</option>)}
                  </Select>
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs">Dự án</Label>
                  <Select
                    value={l.projectId}
                    onChange={(e) => updateLine(i, { projectId: e.target.value, isCommercialStock: e.target.value ? false : l.isCommercialStock })}
                    disabled={l.isCommercialStock}
                  >
                    <option value="">— Chọn dự án —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
                  </Select>
                </div>
                <div className="flex items-end sm:col-span-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={l.isCommercialStock}
                      onChange={(e) => updateLine(i, { isCommercialStock: e.target.checked, projectId: e.target.checked ? "" : l.projectId })}
                    />
                    Hàng TM
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">SL *</Label>
                  <Input type="number" min="1" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} required />
                </div>
                <div className="flex items-end sm:col-span-1">
                  {lines.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Tạo phiếu"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
