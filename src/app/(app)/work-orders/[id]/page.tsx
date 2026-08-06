"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PackageCheck, ClipboardCheck, Boxes } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { WO_STATUS_LABEL, WO_STATUS_TONE, WO_MODE_LABEL } from "@/lib/labels";

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canWO = useCan(PERMISSIONS.WORKORDER_WRITE);
  const canQC = useCan(PERMISSIONS.QC_WRITE);

  const [wo, setWo] = useState<any>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Allocate
  const [allocText, setAllocText] = useState("");
  // QC
  const [qcResult, setQcResult] = useState("PASS");
  const [burnIn, setBurnIn] = useState("");
  const [qcNote, setQcNote] = useState("");
  // Complete
  const [finSn, setFinSn] = useState("");
  const [destCode, setDestCode] = useState("K-TM");
  const [projectId, setProjectId] = useState("");
  const [commercial, setCommercial] = useState(false);
  const [assembledBy, setAssembledBy] = useState("");
  const [consumed, setConsumed] = useState<Record<string, boolean>>({});
  const [licSel, setLicSel] = useState<Record<string, boolean>>({});
  const [thngStart, setThngStart] = useState("");
  const [thngEnd, setThngEnd] = useState("");
  const [thngTerms, setThngTerms] = useState("");

  async function load() {
    const data = await apiFetch<any>(`/api/work-orders/${id}`);
    setWo(data);
    // mặc định chọn tất cả linh kiện WIP để lắp
    const wip: Record<string, boolean> = {};
    data.allocated.filter((a: any) => a.status === "WIP").forEach((a: any) => (wip[a.serialNumber] = true));
    setConsumed(wip);
    if (data.assembledBy) setAssembledBy(data.assembledBy);
  }
  useEffect(() => {
    load();
    apiFetch<any[]>("/api/warehouses").then(setWarehouses).catch(() => {});
    apiFetch<any[]>("/api/projects").then(setProjects).catch(() => {});
    apiFetch<any[]>("/api/licenses?free=1").then(setLicenses).catch(() => {});
  }, [id]);

  async function run(fn: () => Promise<any>, okMsg: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(okMsg);
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  function allocate() {
    const serialNumbers = allocText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    return run(
      () => apiFetch(`/api/work-orders/${id}/allocate`, { method: "POST", body: JSON.stringify({ serialNumbers }) }),
      "Đã cấp phát linh kiện vào WIP."
    ).then(() => setAllocText(""));
  }

  function submitQc() {
    return run(
      () =>
        apiFetch(`/api/work-orders/${id}/qc`, {
          method: "POST",
          body: JSON.stringify({
            result: qcResult,
            burnInHours: burnIn ? Number(burnIn) : null,
            details: qcNote ? { note: qcNote } : null,
          }),
        }),
      qcResult === "PASS" ? "QC đạt." : "QC không đạt — lệnh quay lại lắp ráp."
    );
  }

  function complete() {
    const consumedSerialNumbers = Object.entries(consumed).filter(([, v]) => v).map(([k]) => k);
    const licenseIds = Object.entries(licSel).filter(([, v]) => v).map(([k]) => k);
    return run(
      () =>
        apiFetch(`/api/work-orders/${id}/complete`, {
          method: "POST",
          body: JSON.stringify({
            finishedSerialNumber: finSn,
            destinationWarehouseCode: destCode,
            projectId: projectId || null,
            isCommercialStock: commercial,
            assembledBy: assembledBy || null,
            consumedSerialNumbers,
            licenseIds,
            thngWarranty: thngStart || thngEnd ? { startDate: thngStart || null, endDate: thngEnd || null, terms: thngTerms || null } : null,
          }),
        }),
      "Đã hoàn thành lắp ráp & nhập kho thành phẩm."
    );
  }

  if (!wo) return <p className="text-muted-foreground">Đang tải...</p>;
  const done = wo.status === "DONE";
  const wipItems = wo.allocated.filter((a: any) => a.status === "WIP");

  return (
    <div>
      <div className="mb-4">
        <Link href="/work-orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Danh sách lệnh lắp ráp
        </Link>
      </div>
      <PageHeader
        title={`Lệnh ${wo.number}`}
        description={`${WO_MODE_LABEL[wo.mode]}${wo.product ? " · " + wo.product.name : ""}`}
        action={<Badge tone={WO_STATUS_TONE[wo.status]}>{WO_STATUS_LABEL[wo.status]}</Badge>}
      />

      {msg && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* BOM kế hoạch */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">BOM kế hoạch</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>Linh kiện</TH><TH>Chế độ</TH><TH className="text-right">SL</TH></TR></THead>
              <TBody>
                {wo.bomPlanned.length === 0 ? (
                  <TR><TD colSpan={3} className="py-4 text-center text-muted-foreground">Không có</TD></TR>
                ) : wo.bomPlanned.map((b: any) => (
                  <TR key={b.id}>
                    <TD>{b.product.name}</TD>
                    <TD><Badge tone="muted">{b.product.trackingMode}</Badge></TD>
                    <TD className="text-right">{b.quantity}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        {/* Linh kiện đã cấp phát */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Linh kiện đã cấp phát ({wo.allocated.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>Serial</TH><TH>Linh kiện</TH><TH>Trạng thái</TH></TR></THead>
              <TBody>
                {wo.allocated.length === 0 ? (
                  <TR><TD colSpan={3} className="py-4 text-center text-muted-foreground">Chưa cấp phát</TD></TR>
                ) : wo.allocated.map((a: any) => (
                  <TR key={a.id}>
                    <TD className="font-mono">{a.serialNumber}</TD>
                    <TD>{a.product.name}</TD>
                    <TD>
                      {a.parentSerialId ? <Badge tone="success">Đã lắp</Badge>
                        : a.status === "WIP" ? <Badge tone="warning">WIP</Badge>
                        : <Badge tone="muted">{a.status}</Badge>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Cấp phát */}
      {!done && canWO && (
        <Card className="mt-4">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Boxes className="h-4 w-4" /> Cấp phát linh kiện (quét serial)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={allocText}
              onChange={(e) => setAllocText(e.target.value)}
              placeholder={"Quét serial linh kiện, mỗi dòng 1 serial\nSN-CPU-...\nSN-SSD-..."}
            />
            <div className="flex justify-end">
              <Button onClick={allocate} disabled={busy || !allocText.trim()}>Cấp phát vào WIP</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QC */}
      {!done && canQC && (
        <Card className="mt-4">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> QC / Burn-in đầu ra</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label className="text-xs">Kết quả</Label>
                <Select value={qcResult} onChange={(e) => setQcResult(e.target.value)}>
                  <option value="PASS">Đạt (PASS)</option>
                  <option value="FAIL">Không đạt (FAIL)</option>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Burn-in (giờ)</Label><Input type="number" value={burnIn} onChange={(e) => setBurnIn(e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Ghi chú</Label><Input value={qcNote} onChange={(e) => setQcNote(e.target.value)} /></div>
            </div>
            <div className="flex justify-end"><Button variant="outline" onClick={submitQc} disabled={busy}>Ghi kết quả QC</Button></div>
            {wo.qcReports?.length > 0 && (
              <div className="space-y-1 border-t pt-2 text-xs">
                {wo.qcReports.map((q: any) => (
                  <div key={q.id} className="flex items-center gap-2">
                    <Badge tone={q.result === "PASS" ? "success" : "danger"}>{q.result}</Badge>
                    {q.burnInHours != null && <span>burn-in {q.burnInHours}h</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hoàn thành */}
      {!done && canWO && (
        <Card className="mt-4">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><PackageCheck className="h-4 w-4" /> Hoàn thành & nhập kho thành phẩm</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label className="text-xs">Serial thành phẩm *</Label><Input className="font-mono" value={finSn} onChange={(e) => setFinSn(e.target.value)} placeholder="WS-..." /></div>
              <div className="space-y-1.5"><Label className="text-xs">Kho đích</Label>
                <Select value={destCode} onChange={(e) => setDestCode(e.target.value)}>
                  <option value="K-TM">K-TM (Thương mại)</option>
                  <option value="K-DA">K-DA (Dự án)</option>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Người lắp</Label><Input value={assembledBy} onChange={(e) => setAssembledBy(e.target.value)} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label className="text-xs">Dự án</Label>
                <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={commercial}>
                  <option value="">— Chọn dự án —</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.code}</option>)}
                </Select>
              </div>
              <label className="flex items-end gap-2 text-sm"><Checkbox checked={commercial} onChange={(e) => { setCommercial(e.target.checked); if (e.target.checked) setProjectId(""); }} /> Hàng thương mại</label>
            </div>

            <div>
              <Label className="text-xs">Linh kiện lắp vào máy (as-built BOM)</Label>
              <div className="mt-1 space-y-1 rounded-md border p-2">
                {wipItems.length === 0 ? <p className="text-xs text-muted-foreground">Chưa có linh kiện WIP. Cấp phát trước.</p> :
                  wipItems.map((a: any) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!consumed[a.serialNumber]} onChange={(e) => setConsumed({ ...consumed, [a.serialNumber]: e.target.checked })} />
                      <span className="font-mono">{a.serialNumber}</span>
                      <span className="text-muted-foreground">{a.product.name}</span>
                    </label>
                  ))
                }
                <p className="pt-1 text-xs text-muted-foreground">Linh kiện WIP không chọn sẽ được trả về kho K-LK.</p>
              </div>
            </div>

            {licenses.length > 0 && (
              <div>
                <Label className="text-xs">Cài phần mềm / License</Label>
                <div className="mt-1 space-y-1 rounded-md border p-2">
                  {licenses.map((l: any) => (
                    <label key={l.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!licSel[l.id]} onChange={(e) => setLicSel({ ...licSel, [l.id]: e.target.checked })} />
                      <span className="font-mono">{l.licenseKey}</span>
                      <span className="text-muted-foreground">{l.product?.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label className="text-xs">BH THNG từ</Label><Input type="date" value={thngStart} onChange={(e) => setThngStart(e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">BH THNG đến</Label><Input type="date" value={thngEnd} onChange={(e) => setThngEnd(e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Điều kiện BH</Label><Input value={thngTerms} onChange={(e) => setThngTerms(e.target.value)} /></div>
            </div>

            <div className="flex justify-end">
              <Button onClick={complete} disabled={busy || !finSn.trim() || !wo.product}>
                <PackageCheck className="h-4 w-4" /> Hoàn thành & nhập kho
              </Button>
            </div>
            {!wo.product && <p className="text-right text-xs text-destructive">Lệnh chưa gán sản phẩm thành phẩm.</p>}
          </CardContent>
        </Card>
      )}

      {/* As-built + thành phẩm khi DONE */}
      {done && (
        <Card className="mt-4">
          <CardHeader className="pb-2"><CardTitle className="text-base">As-built BOM & thành phẩm</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {wo.finished && (
              <div className="text-sm">
                Thành phẩm:{" "}
                <Link href="/serials" className="font-mono font-medium text-primary hover:underline">{wo.finished.serialNumber}</Link>
                {" "}— xem truy vết tại trang Serial.
              </div>
            )}
            <Table>
              <THead><TR><TH>Loại con</TH><TH>Serial/Lô/License</TH><TH className="text-right">SL</TH><TH>Version</TH></TR></THead>
              <TBody>
                {wo.bomAsBuilt.map((b: any) => (
                  <TR key={b.id}>
                    <TD>{b.childSerialId ? "Serial" : b.childLotId ? "Lô" : "License"}</TD>
                    <TD className="font-mono">{b.childSerial?.serialNumber ?? b.childLotId ?? b.childLicenseId}</TD>
                    <TD className="text-right">{b.quantity}</TD>
                    <TD>v{b.version}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
