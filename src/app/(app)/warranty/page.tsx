"use client";
import { useEffect, useState } from "react";
import { statusLabel } from "@/lib/clinic-labels";
import { Plus, ShieldCheck, Truck, PackageX, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

export default function WarrantyPage() {
  const canWrite = useCan(PERMISSIONS.WARRANTY_WRITE);
  const [data, setData] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // modals
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [routeItem, setRouteItem] = useState<any>(null);
  const [returnItem, setReturnItem] = useState<any>(null);
  const [resolveItem, setResolveItem] = useState<any>(null);

  // forms
  const [intake, setIntake] = useState({ serialNumber: "", customerId: "", originalInvoiceNo: "", sealIntact: true, conditionNote: "" });
  const [routeForm, setRouteForm] = useState({ route: "TO_VENDOR", vendorId: "", carrier: "", trackingNumber: "", cause: "" });
  const [returnForm, setReturnForm] = useState({ result: "REPAIRED", replacementSerialNumber: "", endDate: "" });
  const [resolveForm, setResolveForm] = useState({ resolution: "RETURN_VENDOR", note: "" });

  async function load() {
    setData(await apiFetch("/api/warranty/dashboard"));
  }
  useEffect(() => {
    load();
    apiFetch<any[]>("/api/partners?type=SUPPLIER").then(setVendors).catch(() => {});
    apiFetch<any[]>("/api/partners?type=CUSTOMER").then(setCustomers).catch(() => {});
  }, []);

  async function run(fn: () => Promise<any>, okMsg: string, close: () => void) {
    setBusy(true); setError(null); setMsg(null);
    try { await fn(); setMsg(okMsg); close(); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setBusy(false); }
  }

  const createIntake = () => run(
    () => apiFetch("/api/warranty-intakes", { method: "POST", body: JSON.stringify({ ...intake, customerId: intake.customerId || null }) }),
    "Đã tiếp nhận máy bảo hành.", () => { setIntakeOpen(false); setIntake({ serialNumber: "", customerId: "", originalInvoiceNo: "", sealIntact: true, conditionNote: "" }); }
  );
  const doRoute = () => run(
    () => apiFetch(`/api/warranty-intakes/${routeItem.id}/route`, { method: "POST", body: JSON.stringify({ ...routeForm, vendorId: routeForm.vendorId || null }) }),
    "Đã phân luồng.", () => setRouteItem(null)
  );
  const doReturn = () => run(
    () => apiFetch(`/api/vendor-rma/${returnItem.id}/return`, { method: "POST", body: JSON.stringify({ result: returnForm.result, replacementSerialNumber: returnForm.replacementSerialNumber || null, warranty: returnForm.endDate ? { endDate: returnForm.endDate } : null }) }),
    "Đã cập nhật kết quả RMA.", () => setReturnItem(null)
  );
  const doResolve = () => run(
    () => apiFetch(`/api/damaged/${resolveItem.id}/resolve`, { method: "POST", body: JSON.stringify(resolveForm) }),
    "Đã chốt hướng xử lý.", () => setResolveItem(null)
  );

  if (!data) return <p className="text-muted-foreground">Đang tải...</p>;

  return (
    <div>
      <PageHeader
        title="Bảo hành & Dịch vụ"
        description="Tiếp nhận (N3) → phân luồng (hãng/sửa/hỏng) → theo dõi SLA → hãng trả về (N4)."
        action={canWrite && <Button onClick={() => setIntakeOpen(true)}><Plus className="h-4 w-4" /> Tiếp nhận bảo hành</Button>}
      />

      {msg && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Tiếp nhận đang mở */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Phiếu tiếp nhận chờ phân luồng ({data.intakes.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Số phiếu</TH><TH>Serial</TH><TH>Tình trạng</TH><TH>Ngày</TH><TH></TH></TR></THead>
            <TBody>
              {data.intakes.length === 0 ? <TR><TD colSpan={5} className="py-6 text-center text-muted-foreground">Không có</TD></TR> :
                data.intakes.map((i: any) => (
                  <TR key={i.id}>
                    <TD className="font-mono font-medium">{i.number}</TD>
                    <TD className="font-mono">{i.serial?.serialNumber ?? "—"}</TD>
                    <TD className="text-muted-foreground">{i.conditionNote ?? "—"}</TD>
                    <TD className="text-muted-foreground">{formatDate(i.createdAt)}</TD>
                    <TD>{canWrite && <Button size="sm" variant="outline" onClick={() => { setRouteItem(i); setRouteForm({ route: "TO_VENDOR", vendorId: "", carrier: "", trackingNumber: "", cause: "" }); }}>Phân luồng</Button>}</TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vendor RMA */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" /> Đang ở NCC/hãng ({data.vendorRma.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Số RMA</TH><TH>Serial</TH><TH>Gửi</TH><TH>Hạn SLA</TH><TH>Trạng thái</TH><TH></TH></TR></THead>
            <TBody>
              {data.vendorRma.length === 0 ? <TR><TD colSpan={6} className="py-6 text-center text-muted-foreground">Không có</TD></TR> :
                data.vendorRma.map((r: any) => (
                  <TR key={r.id}>
                    <TD className="font-mono font-medium">{r.number}</TD>
                    <TD className="font-mono">{r.serial?.serialNumber ?? "—"}</TD>
                    <TD className="text-muted-foreground">{formatDate(r.sentDate)}</TD>
                    <TD className="text-muted-foreground">{formatDate(r.dueDate)}</TD>
                    <TD>{r.overdue > 0 ? <Badge tone="danger">Quá hạn {r.overdue} ngày</Badge> : <Badge tone="success">Trong hạn</Badge>}</TD>
                    <TD>{canWrite && <Button size="sm" variant="outline" onClick={() => { setReturnItem(r); setReturnForm({ result: "REPAIRED", replacementSerialNumber: "", endDate: "" }); }}><RotateCcw className="h-3.5 w-3.5" /> Nhận về</Button>}</TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Damaged K-HH */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><PackageX className="h-4 w-4 text-destructive" /> Hư hỏng K-HH — SLA 15 ngày ({data.damaged.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>Serial</TH><TH>Hạn chốt</TH><TH>Tình trạng</TH><TH></TH></TR></THead>
              <TBody>
                {data.damaged.length === 0 ? <TR><TD colSpan={4} className="py-6 text-center text-muted-foreground">Không có</TD></TR> :
                  data.damaged.map((d: any) => (
                    <TR key={d.id}>
                      <TD className="font-mono">{d.serial?.serialNumber ?? "—"}</TD>
                      <TD className="text-muted-foreground">{formatDate(d.dueDate)}</TD>
                      <TD>{d.overdue > 0 ? <Badge tone="danger">Quá hạn {d.overdue}n</Badge> : <Badge tone="warning">Chờ xử lý</Badge>}</TD>
                      <TD>{canWrite && <Button size="sm" variant="outline" onClick={() => { setResolveItem(d); setResolveForm({ resolution: "RETURN_VENDOR", note: "" }); }}>Chốt</Button>}</TD>
                    </TR>
                  ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        {/* Vendor claims */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Đòi bảo hành ngược NCC ({data.claims.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>Số phiếu</TH><TH>Serial</TH><TH>Trạng thái</TH></TR></THead>
              <TBody>
                {data.claims.length === 0 ? <TR><TD colSpan={3} className="py-6 text-center text-muted-foreground">Không có</TD></TR> :
                  data.claims.map((c: any) => (
                    <TR key={c.id}>
                      <TD className="font-mono font-medium">{c.number}</TD>
                      <TD className="font-mono">{c.serial?.serialNumber ?? "—"}</TD>
                      <TD><Badge tone="warning">{statusLabel(c.status)}</Badge></TD>
                    </TR>
                  ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modal tiếp nhận */}
      <Modal open={intakeOpen} onClose={() => setIntakeOpen(false)} title="Tiếp nhận máy bảo hành (N3)">
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Serial máy *</Label><Input className="font-mono" value={intake.serialNumber} onChange={(e) => setIntake({ ...intake, serialNumber: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Khách hàng</Label>
              <Select value={intake.customerId} onChange={(e) => setIntake({ ...intake, customerId: e.target.value })}>
                <option value="">— Chọn —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Hóa đơn bán gốc</Label><Input value={intake.originalInvoiceNo} onChange={(e) => setIntake({ ...intake, originalInvoiceNo: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={intake.sealIntact} onChange={(e) => setIntake({ ...intake, sealIntact: e.target.checked })} /> Tem niêm phong còn nguyên</label>
          <div className="space-y-1.5"><Label>Tình trạng</Label><Input value={intake.conditionNote} onChange={(e) => setIntake({ ...intake, conditionNote: e.target.value })} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIntakeOpen(false)}>Hủy</Button><Button onClick={createIntake} disabled={busy || !intake.serialNumber.trim()}>Tiếp nhận</Button></div>
        </div>
      </Modal>

      {/* Modal phân luồng */}
      <Modal open={!!routeItem} onClose={() => setRouteItem(null)} title={`Phân luồng ${routeItem?.number ?? ""}`}>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Hướng xử lý</Label>
            <Select value={routeForm.route} onChange={(e) => setRouteForm({ ...routeForm, route: e.target.value })}>
              <option value="TO_VENDOR">Gửi hãng (còn BH) → K-BH-NCC</option>
              <option value="TO_REPAIR">Sửa chữa có phí → K-SC</option>
              <option value="TO_DAMAGED">Không sửa được → K-HH</option>
            </Select>
          </div>
          {routeForm.route === "TO_VENDOR" && (
            <>
              <div className="space-y-1.5"><Label>NCC/hãng *</Label>
                <Select value={routeForm.vendorId} onChange={(e) => setRouteForm({ ...routeForm, vendorId: e.target.value })}>
                  <option value="">— Chọn —</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Đơn vị VC</Label><Input value={routeForm.carrier} onChange={(e) => setRouteForm({ ...routeForm, carrier: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Mã vận đơn</Label><Input value={routeForm.trackingNumber} onChange={(e) => setRouteForm({ ...routeForm, trackingNumber: e.target.value })} /></div>
              </div>
            </>
          )}
          {routeForm.route === "TO_DAMAGED" && (
            <div className="space-y-1.5"><Label>Nguyên nhân hỏng</Label><Input value={routeForm.cause} onChange={(e) => setRouteForm({ ...routeForm, cause: e.target.value })} /></div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRouteItem(null)}>Hủy</Button><Button onClick={doRoute} disabled={busy}>Xác nhận</Button></div>
        </div>
      </Modal>

      {/* Modal nhận về từ NCC */}
      <Modal open={!!returnItem} onClose={() => setReturnItem(null)} title={`Nhận về từ hãng ${returnItem?.number ?? ""}`}>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Kết quả</Label>
            <Select value={returnForm.result} onChange={(e) => setReturnForm({ ...returnForm, result: e.target.value })}>
              <option value="REPAIRED">Sửa xong (trả khách)</option>
              <option value="REPLACED">Thay mới (N4)</option>
            </Select>
          </div>
          {returnForm.result === "REPLACED" && (
            <>
              <div className="space-y-1.5"><Label>Serial hàng thay thế *</Label><Input className="font-mono" value={returnForm.replacementSerialNumber} onChange={(e) => setReturnForm({ ...returnForm, replacementSerialNumber: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Hạn BH hãng mới</Label><Input type="date" value={returnForm.endDate} onChange={(e) => setReturnForm({ ...returnForm, endDate: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">Serial cũ → REPLACED (liên kết replaced_by), cập nhật as-built BOM version mới, tự mở phiếu đòi BH ngược NCC nếu còn hạn hãng.</p>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setReturnItem(null)}>Hủy</Button><Button onClick={doReturn} disabled={busy}>Xác nhận</Button></div>
        </div>
      </Modal>

      {/* Modal chốt hư hỏng */}
      <Modal open={!!resolveItem} onClose={() => setResolveItem(null)} title="Chốt hướng xử lý K-HH">
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Hướng xử lý</Label>
            <Select value={resolveForm.resolution} onChange={(e) => setResolveForm({ ...resolveForm, resolution: e.target.value })}>
              <option value="RETURN_VENDOR">Trả NCC (X7)</option>
              <option value="CUSTOMER_COMPENSATION">Thu bồi thường khách</option>
              <option value="SALVAGE_PARTS">Tận dụng linh kiện (rã máy)</option>
              <option value="LIQUIDATE">Thanh lý</option>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Ghi chú</Label><Input value={resolveForm.note} onChange={(e) => setResolveForm({ ...resolveForm, note: e.target.value })} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setResolveItem(null)}>Hủy</Button><Button onClick={doResolve} disabled={busy}>Xác nhận</Button></div>
        </div>
      </Modal>
    </div>
  );
}
