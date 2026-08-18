"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Wrench, TrendingDown, CreditCard, Paperclip, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { computeDepreciation } from "@/lib/depreciation";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { ASSET_STATUS_LABEL, ASSET_STATUS_TONE, MAINTENANCE_TYPE_LABEL, MAINTENANCE_TYPE_TONE } from "@/lib/labels";

interface Maint {
  id: string;
  type: string;
  description: string;
  cost?: number | null;
  vendor?: string | null;
  performedAt: string;
  note?: string | null;
  createdBy: { name: string };
}
interface Attach {
  id: string;
  kind: string;
  filename: string;
  mimeType: string;
  size: number;
  note?: string | null;
  createdAt: string;
  uploadedBy?: { name: string } | null;
}
interface Payment {
  id: string;
  amount: number;
  paidDate: string;
  method: string;
  bankInfo?: string | null;
  payerType: string;
  note?: string | null;
  createdBy: { name: string };
  attachments: Attach[];
}
interface Asset {
  id: string;
  code: string;
  product: { sku: string; name: string };
  serialNumber?: string | null;
  status: string;
  location?: string | null;
  warehouse?: { name: string } | null;
  supplier?: { name: string } | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  note?: string | null;
  contractValue?: number | null;
  managementType?: string | null;
  payments: Payment[];
  attachments: Attach[];
  cost?: number | null;
  salvageValue?: number | null;
  depreciationStart?: string | null;
  depreciationMonths?: number | null;
  depreciationMethod?: "STRAIGHT_LINE" | "DECLINING" | null;
  warrantyVendor?: string | null;
  warrantyMonths?: number | null;
  maintenanceCycleMonths?: number | null;
  maintenance: Maint[];
}

function daysBetween(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}
function addMonths(iso: string, n: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}
const DEP_METHOD_LABEL: Record<string, string> = {
  STRAIGHT_LINE: "Đường thẳng",
  DECLINING: "Số dư giảm dần",
};
const MANAGE_LABEL: Record<string, string> = { DEBT: "Theo công nợ", INVOICE: "Theo hóa đơn", CONTRACT: "Theo hợp đồng" };
const METHOD_LABEL: Record<string, string> = { CASH: "Tiền mặt", TRANSFER: "Chuyển khoản", OTHER: "Khác" };
const PAYER_LABEL: Record<string, string> = { COMPANY: "Qua công ty", PERSONAL_ADVANCE: "Cá nhân tạm ứng", OTHER: "Khác" };
const KIND_LABEL: Record<string, string> = { CONTRACT: "Hợp đồng", INVOICE: "Hóa đơn VAT", PAYMENT_ORDER: "Ủy nhiệm chi", OTHER: "Khác" };

// Đọc file -> data URI base64 (dùng lưu đính kèm trong DB).
function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Không đọc được file"));
    r.readAsDataURL(file);
  });
}
const MAX_FILE = 5 * 1024 * 1024;

export default function AssetDetailPage({ params }: { params: { id: string } }) {
  const canWrite = useCan(PERMISSIONS.ASSET_WRITE);
  const canManage = useCan(PERMISSIONS.ASSET_MANAGE);
  const [data, setData] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "MAINTENANCE", description: "", cost: "", vendor: "", performedAt: "", note: "" });

  // Thanh toán & công nợ
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", paidDate: "", method: "TRANSFER", bankInfo: "", payerType: "COMPANY", note: "" });
  const [payFile, setPayFile] = useState<File | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [upKind, setUpKind] = useState("CONTRACT");
  const [upBusy, setUpBusy] = useState(false);

  async function load() {
    setData(await apiFetch<Asset>(`/api/assets/${params.id}`));
  }
  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function uploadFile(file: File, kind: string, paymentId?: string) {
    if (file.size > MAX_FILE) throw new Error("File vượt quá 5MB.");
    const dataUri = await fileToDataUri(file);
    await apiFetch(`/api/assets/${params.id}/attachments`, {
      method: "POST",
      body: JSON.stringify({ kind, filename: file.name, mimeType: file.type || "application/octet-stream", data: dataUri, size: file.size, paymentId: paymentId ?? null }),
    });
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    setPayErr(null);
    if (!payForm.amount || Number(payForm.amount) <= 0) return setPayErr("Nhập số tiền > 0.");
    if (!payForm.paidDate) return setPayErr("Chọn ngày thanh toán.");
    if (payFile && payFile.size > MAX_FILE) return setPayErr("File ủy nhiệm chi vượt quá 5MB.");
    setPayBusy(true);
    try {
      const res = await apiFetch<{ id: string }>(`/api/assets/${params.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(payForm.amount),
          paidDate: payForm.paidDate,
          method: payForm.method,
          bankInfo: payForm.bankInfo || null,
          payerType: payForm.payerType,
          note: payForm.note || null,
        }),
      });
      if (payFile) await uploadFile(payFile, "PAYMENT_ORDER", res.id);
      setPayOpen(false);
      setPayForm({ amount: "", paidDate: "", method: "TRANSFER", bankInfo: "", payerType: "COMPANY", note: "" });
      setPayFile(null);
      load();
    } catch (err) {
      setPayErr(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setPayBusy(false);
    }
  }
  async function delPayment(pid: string) {
    if (!confirm("Xóa đợt thanh toán này?")) return;
    await apiFetch(`/api/assets/${params.id}/payments/${pid}`, { method: "DELETE" });
    load();
  }
  async function onUploadAsset(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUpBusy(true);
    try {
      await uploadFile(file, upKind);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải file");
    } finally {
      setUpBusy(false);
    }
  }
  async function delAttachment(aid: string) {
    if (!confirm("Xóa file đính kèm này?")) return;
    await apiFetch(`/api/assets/${params.id}/attachments/${aid}`, { method: "DELETE" });
    load();
  }

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/assets/${params.id}/maintenance`, {
        method: "POST",
        body: JSON.stringify({
          type: form.type,
          description: form.description,
          cost: form.cost ? Number(form.cost) : null,
          vendor: form.vendor || null,
          performedAt: form.performedAt,
          note: form.note || null,
        }),
      });
      setOpen(false);
      setForm({ type: "MAINTENANCE", description: "", cost: "", vendor: "", performedAt: "", note: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!data) return <p className="text-destructive">Không tìm thấy tài sản.</p>;

  return (
    <div>
      <PageHeader
        title={`${data.code} — ${data.product.name}`}
        description={`Serial: ${data.serialNumber ?? "—"}`}
        action={
          <div className="flex gap-2">
            {canWrite && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Ghi bảo trì
              </Button>
            )}
            <Link href="/assets">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Danh sách
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Trạng thái</div>
            <Badge tone={ASSET_STATUS_TONE[data.status] ?? "muted"}>{ASSET_STATUS_LABEL[data.status] ?? data.status}</Badge>
          </div>
          <Info label="Vị trí" value={data.location ?? data.warehouse?.name ?? "—"} />
          <Info label="Nhà cung cấp" value={data.supplier?.name ?? "—"} />
          <Info label="Ngày mua" value={data.purchaseDate ? formatDate(data.purchaseDate) : "—"} />
          <Info label="Bảo hành đến" value={data.warrantyUntil ? formatDate(data.warrantyUntil) : "—"} />
          {data.note && <Info label="Ghi chú" value={data.note} />}
        </CardContent>
      </Card>

      {/* (a) Khấu hao */}
      {(() => {
        if (!data.cost || !data.depreciationMonths || !data.depreciationStart) {
          return canWrite ? (
            <Card className="mb-4">
              <CardContent className="p-5 text-sm text-muted-foreground">
                Chưa cấu hình khấu hao. Bấm <b>Sửa</b> ở trang danh sách tài sản để nhập nguyên giá, ngày bắt
                đầu và thời gian khấu hao.
              </CardContent>
            </Card>
          ) : null;
        }
        const dep = computeDepreciation({
          cost: data.cost,
          salvage: data.salvageValue ?? 0,
          months: data.depreciationMonths,
          start: new Date(data.depreciationStart),
          method: data.depreciationMethod ?? "STRAIGHT_LINE",
        });
        if (!dep) return null;
        return (
          <>
            <div className="mb-2 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Khấu hao tài sản</h3>
              <Badge tone="muted">{DEP_METHOD_LABEL[data.depreciationMethod ?? "STRAIGHT_LINE"]}</Badge>
            </div>
            <Card className="mb-4">
              <CardContent className="p-5">
                <div className="grid gap-4 text-sm sm:grid-cols-4">
                  <Info label="Nguyên giá" value={`${formatNumber(data.cost)} đ`} />
                  <Info label="Bắt đầu khấu hao" value={formatDate(data.depreciationStart)} />
                  <Info label="Thời gian" value={`${data.depreciationMonths} tháng`} />
                  <Info label="Khấu hao / tháng" value={`${formatNumber(dep.monthly)} đ`} />
                  <Info label="Đã khấu hao (lũy kế)" value={`${formatNumber(dep.accumulated)} đ`} />
                  <Info label="Giá trị còn lại" value={`${formatNumber(dep.remaining)} đ`} />
                  <Info label="Khấu hao xong" value={formatDate(dep.endDate.toISOString())} />
                  <div>
                    <div className="text-xs text-muted-foreground">Tiến độ ({dep.percent}%)</div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${dep.percent}%` }} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Năm</TH>
                        <TH className="text-right">Khấu hao trong năm</TH>
                        <TH className="text-right">Lũy kế cuối năm</TH>
                        <TH className="text-right">Còn lại cuối năm</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {dep.yearly.map((y) => (
                        <TR key={y.year}>
                          <TD className="font-medium">{y.year}</TD>
                          <TD className="text-right">{formatNumber(y.depreciation)} đ</TD>
                          <TD className="text-right">{formatNumber(y.accumulated)} đ</TD>
                          <TD className="text-right">{formatNumber(y.remaining)} đ</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        );
      })()}

      {/* (b) Bảo hành & bảo trì định kỳ */}
      {(() => {
        const wDays = daysBetween(data.warrantyUntil);
        const lastMaint = data.maintenance[0]?.performedAt ?? null; // maintenance sắp xếp desc
        const baseForNext = lastMaint ?? data.purchaseDate ?? null;
        const nextMaint =
          data.maintenanceCycleMonths && baseForNext ? addMonths(baseForNext, data.maintenanceCycleMonths) : null;
        const nDays = daysBetween(nextMaint);
        return (
          <Card className="mb-4">
            <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-4">
              <Info label="Hãng / đơn vị bảo hành" value={data.warrantyVendor ?? "—"} />
              <div>
                <div className="text-xs text-muted-foreground">Bảo hành đến</div>
                <div className="font-medium">
                  {data.warrantyUntil ? formatDate(data.warrantyUntil) : "—"}
                  {wDays != null &&
                    (wDays < 0 ? (
                      <Badge tone="danger" className="ml-2">Hết BH</Badge>
                    ) : wDays <= 60 ? (
                      <Badge tone="warning" className="ml-2">Còn {wDays} ngày</Badge>
                    ) : null)}
                </div>
              </div>
              <Info
                label="Chu kỳ bảo trì"
                value={data.maintenanceCycleMonths ? `${data.maintenanceCycleMonths} tháng` : "—"}
              />
              <Info label="Bảo trì gần nhất" value={lastMaint ? formatDate(lastMaint) : "—"} />
              <div>
                <div className="text-xs text-muted-foreground">Bảo trì kế tiếp</div>
                <div className="font-medium">
                  {nextMaint ? formatDate(nextMaint) : "—"}
                  {nDays != null &&
                    (nDays < 0 ? (
                      <Badge tone="danger" className="ml-2">Quá hạn {Math.abs(nDays)} ngày</Badge>
                    ) : nDays <= 14 ? (
                      <Badge tone="warning" className="ml-2">Còn {nDays} ngày</Badge>
                    ) : null)}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* (c) Thanh toán & công nợ */}
      {(() => {
        const paid = data.payments.reduce((s, p) => s + p.amount, 0);
        const owed = (data.contractValue ?? 0) - paid;
        return (
          <>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Thanh toán &amp; công nợ</h3>
                {data.managementType && <Badge tone="muted">{MANAGE_LABEL[data.managementType]}</Badge>}
              </div>
              {canManage && (
                <Button size="sm" onClick={() => { setPayErr(null); setPayOpen(true); }}>
                  <Plus className="h-4 w-4" /> Thêm đợt thanh toán
                </Button>
              )}
            </div>
            <Card className="mb-4">
              <CardContent className="p-5">
                <div className="mb-4 grid gap-4 text-sm sm:grid-cols-4">
                  <Info label="Tổng giá trị hợp đồng" value={data.contractValue != null ? `${formatNumber(data.contractValue)} đ` : "—"} />
                  <Info label="Đã thanh toán" value={`${formatNumber(paid)} đ`} />
                  <div>
                    <div className="text-xs text-muted-foreground">Còn công nợ</div>
                    <div className={`font-semibold ${owed > 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {data.contractValue != null ? `${formatNumber(Math.max(0, owed))} đ` : "—"}
                    </div>
                  </div>
                  <Info label="Số đợt đã trả" value={String(data.payments.length)} />
                </div>

                {/* Đợt thanh toán */}
                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Ngày</TH>
                        <TH className="text-right">Số tiền</TH>
                        <TH>Phương thức</TH>
                        <TH>Ngân hàng</TH>
                        <TH>Hình thức chi trả</TH>
                        <TH>Chứng từ</TH>
                        <TH>Người ghi</TH>
                        {canManage && <TH></TH>}
                      </TR>
                    </THead>
                    <TBody>
                      {data.payments.length === 0 ? (
                        <TR>
                          <TD colSpan={canManage ? 8 : 7} className="py-6 text-center text-muted-foreground">Chưa có đợt thanh toán</TD>
                        </TR>
                      ) : (
                        data.payments.map((p) => (
                          <TR key={p.id}>
                            <TD>{formatDate(p.paidDate)}</TD>
                            <TD className="text-right font-medium">{formatNumber(p.amount)} đ</TD>
                            <TD>{METHOD_LABEL[p.method] ?? p.method}</TD>
                            <TD className="text-muted-foreground">{p.bankInfo ?? "—"}</TD>
                            <TD>{PAYER_LABEL[p.payerType] ?? p.payerType}</TD>
                            <TD>
                              {p.attachments.length === 0 ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {p.attachments.map((a) => (
                                    <a key={a.id} href={`/api/assets/${params.id}/attachments/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                      <Paperclip className="h-3 w-3" />{KIND_LABEL[a.kind] ?? a.filename}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </TD>
                            <TD className="text-muted-foreground">{p.createdBy.name}</TD>
                            {canManage && (
                              <TD className="text-right">
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => delPayment(p.id)} title="Xóa">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TD>
                            )}
                          </TR>
                        ))
                      )}
                    </TBody>
                  </Table>
                </div>

                {/* File cấp hợp đồng / hóa đơn */}
                <div className="mt-5 border-t pt-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Hồ sơ đính kèm (hợp đồng, hóa đơn…)</span>
                    {canManage && (
                      <>
                        <Select value={upKind} onChange={(e) => setUpKind(e.target.value)} className="h-8 w-40">
                          <option value="CONTRACT">Hợp đồng</option>
                          <option value="INVOICE">Hóa đơn VAT</option>
                          <option value="PAYMENT_ORDER">Ủy nhiệm chi</option>
                          <option value="OTHER">Khác</option>
                        </Select>
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent">
                          <Upload className="h-4 w-4" /> {upBusy ? "Đang tải…" : "Tải file (≤5MB)"}
                          <input type="file" className="hidden" onChange={onUploadAsset} disabled={upBusy} />
                        </label>
                      </>
                    )}
                  </div>
                  {data.attachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có hồ sơ đính kèm.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.attachments.map((a) => (
                        <div key={a.id} className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
                          <Badge tone="muted">{KIND_LABEL[a.kind] ?? "Khác"}</Badge>
                          <a href={`/api/assets/${params.id}/attachments/${a.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{a.filename}</a>
                          <span className="text-xs text-muted-foreground">({Math.round(a.size / 1024)} KB)</span>
                          {canManage && (
                            <button onClick={() => delAttachment(a.id)} className="text-destructive" title="Xóa">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        );
      })()}

      <div className="mb-2 flex items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Lịch sử bảo trì / sửa chữa</h3>
        <Badge tone="muted">{data.maintenance.length}</Badge>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Ngày</TH>
                <TH>Loại</TH>
                <TH>Nội dung</TH>
                <TH>Đơn vị</TH>
                <TH className="text-right">Chi phí</TH>
                <TH>Người ghi</TH>
              </TR>
            </THead>
            <TBody>
              {data.maintenance.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted-foreground">Chưa có bản ghi bảo trì</TD>
                </TR>
              ) : (
                data.maintenance.map((m) => (
                  <TR key={m.id}>
                    <TD>{formatDate(m.performedAt)}</TD>
                    <TD>
                      <Badge tone={MAINTENANCE_TYPE_TONE[m.type] ?? "default"}>
                        {MAINTENANCE_TYPE_LABEL[m.type] ?? m.type}
                      </Badge>
                    </TD>
                    <TD>
                      <div>{m.description}</div>
                      {m.note && <div className="text-xs text-muted-foreground">{m.note}</div>}
                    </TD>
                    <TD className="text-muted-foreground">{m.vendor ?? "—"}</TD>
                    <TD className="text-right">{m.cost != null ? `${formatNumber(m.cost)} đ` : "—"}</TD>
                    <TD className="text-muted-foreground">{m.createdBy.name}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Ghi nhận bảo trì / sửa chữa">
        <form onSubmit={addLog} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại *</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="MAINTENANCE">Bảo trì định kỳ</option>
                <option value="REPAIR">Sửa chữa</option>
                <option value="INSPECTION">Kiểm tra</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ngày thực hiện *</Label>
              <Input type="date" value={form.performedAt} onChange={(e) => setForm({ ...form, performedAt: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nội dung *</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Đơn vị / kỹ thuật</Label>
              <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Chi phí (đ)</Label>
              <Input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>

      {/* Thêm đợt thanh toán */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Thêm đợt thanh toán">
        <form onSubmit={addPayment} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Số tiền (đ) *</Label>
              <Input type="number" min="0" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Ngày thanh toán *</Label>
              <Input type="date" value={payForm.paidDate} onChange={(e) => setPayForm({ ...payForm, paidDate: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phương thức</Label>
              <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                <option value="TRANSFER">Chuyển khoản</option>
                <option value="CASH">Tiền mặt</option>
                <option value="OTHER">Khác</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hình thức chi trả</Label>
              <Select value={payForm.payerType} onChange={(e) => setPayForm({ ...payForm, payerType: e.target.value })}>
                <option value="COMPANY">Thanh toán qua công ty</option>
                <option value="PERSONAL_ADVANCE">Cá nhân tạm ứng</option>
                <option value="OTHER">Khác</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ngân hàng / số tài khoản</Label>
            <Input value={payForm.bankInfo} onChange={(e) => setPayForm({ ...payForm, bankInfo: e.target.value })} placeholder="VD: Vietcombank - 0123456789" />
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Ủy nhiệm chi / chứng từ (≤5MB)</Label>
            <input type="file" onChange={(e) => setPayFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm hover:file:bg-accent" />
          </div>
          {payErr && <p className="text-sm text-destructive">{payErr}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)} disabled={payBusy}>Hủy</Button>
            <Button type="submit" disabled={payBusy}>{payBusy ? "Đang lưu…" : "Lưu"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
