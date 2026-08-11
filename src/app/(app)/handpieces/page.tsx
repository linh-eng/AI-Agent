"use client";
import { useEffect, useState } from "react";
import { Plus, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { formatNumber } from "@/lib/utils";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface AssetOpt {
  id: string;
  code: string;
  product: { name: string };
}
interface Row {
  id: string;
  code: string;
  name: string;
  machine?: string | null;
  maxShots: number;
  usedShots: number;
  warnShots: number;
  status: "ACTIVE" | "RETIRED";
  asset?: { code: string; product: { name: string } } | null;
}

const EMPTY = { name: "", assetId: "", machine: "", maxShots: "", warnShots: "1000", note: "" };
const SHOT_EMPTY = { shots: "", customerName: "", performedAt: "", note: "" };

function machineLabel(r: Row): string {
  return r.asset?.product?.name ?? r.machine ?? "—";
}

export default function HandpiecesPage() {
  const canWrite = useCan(PERMISSIONS.ASSET_WRITE);
  const [rows, setRows] = useState<Row[]>([]);
  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  // Ghi shot
  const [shotFor, setShotFor] = useState<Row | null>(null);
  const [shotForm, setShotForm] = useState(SHOT_EMPTY);
  const [shotError, setShotError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<Row[]>("/api/handpieces"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    apiFetch<AssetOpt[]>("/api/assets").then(setAssets).catch(() => {});
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/handpieces", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          assetId: form.assetId || null,
          machine: form.machine || null,
          maxShots: Number(form.maxShots),
          warnShots: form.warnShots ? Number(form.warnShots) : 1000,
          note: form.note || null,
        }),
      });
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  async function recordShot(e: React.FormEvent) {
    e.preventDefault();
    if (!shotFor) return;
    setShotError(null);
    try {
      await apiFetch(`/api/handpieces/${shotFor.id}/shots`, {
        method: "POST",
        body: JSON.stringify({
          shots: Number(shotForm.shots),
          customerName: shotForm.customerName || null,
          performedAt: shotForm.performedAt || null,
          note: shotForm.note || null,
        }),
      });
      setShotFor(null);
      setShotForm(SHOT_EMPTY);
      load();
    } catch (err) {
      setShotError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  async function retire(r: Row) {
    if (!confirm(`Ngừng dùng tay cầm "${r.name}"?`)) return;
    await apiFetch(`/api/handpieces/${r.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "RETIRED" }),
    });
    load();
  }

  return (
    <div>
      <PageHeader
        title="Tay cầm / Vật tư theo máy"
        description="Quản lý tay cầm theo shot tiêu hao — ghi số shot đã bắn, cảnh báo khi sắp hết để thay mới."
        action={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm tay cầm
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mã</TH>
                <TH>Tay cầm</TH>
                <TH>Máy</TH>
                <TH className="w-56">Tiến độ shot</TH>
                <TH className="text-right">Còn lại</TH>
                <TH>Trạng thái</TH>
                {canWrite && <TH className="text-right">Thao tác</TH>}
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={canWrite ? 7 : 6} className="py-8 text-center text-muted-foreground">
                    Đang tải…
                  </TD>
                </TR>
              ) : rows.length === 0 ? (
                <TR>
                  <TD colSpan={canWrite ? 7 : 6} className="py-8 text-center text-muted-foreground">
                    Chưa có tay cầm
                  </TD>
                </TR>
              ) : (
                rows.map((r) => {
                  const remaining = r.maxShots - r.usedShots;
                  const pct = Math.min(100, Math.round((r.usedShots / Math.max(1, r.maxShots)) * 100));
                  const depleted = remaining <= 0;
                  const warn = remaining <= r.warnShots;
                  const barColor = depleted ? "bg-red-500" : warn ? "bg-amber-500" : "bg-primary";
                  return (
                    <TR key={r.id}>
                      <TD className="font-mono text-xs font-medium">{r.code}</TD>
                      <TD className="font-medium">{r.name}</TD>
                      <TD className="text-muted-foreground">{machineLabel(r)}</TD>
                      <TD>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatNumber(r.usedShots)} / {formatNumber(r.maxShots)} shot
                        </div>
                      </TD>
                      <TD className="text-right">
                        {r.status === "RETIRED" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : depleted ? (
                          <Badge tone="danger">Hết shot</Badge>
                        ) : warn ? (
                          <Badge tone="warning">{formatNumber(remaining)}</Badge>
                        ) : (
                          <span className="font-medium">{formatNumber(remaining)}</span>
                        )}
                      </TD>
                      <TD>
                        {r.status === "RETIRED" ? (
                          <Badge tone="muted">Ngừng dùng</Badge>
                        ) : (
                          <Badge tone="success">Đang dùng</Badge>
                        )}
                      </TD>
                      {canWrite && (
                        <TD className="text-right">
                          {r.status === "ACTIVE" && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShotFor(r);
                                  setShotForm(SHOT_EMPTY);
                                  setShotError(null);
                                }}
                              >
                                <Zap className="h-3.5 w-3.5" /> Ghi shot
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => retire(r)}>
                                Ngừng
                              </Button>
                            </div>
                          )}
                        </TD>
                      )}
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Thêm tay cầm */}
      <Modal open={open} onClose={() => setOpen(false)} title="Thêm tay cầm">
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tên tay cầm *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VD: Tay cầm HIFU 4.5mm"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Máy (chọn tài sản)</Label>
            <Select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
              <option value="">— Không gắn tài sản cụ thể —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.product.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Hoặc nhập tên máy</Label>
            <Input
              value={form.machine}
              onChange={(e) => setForm({ ...form, machine: e.target.value })}
              placeholder="VD: Máy HIFU Doublo"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Định mức shot tối đa *</Label>
              <Input
                type="number"
                value={form.maxShots}
                onChange={(e) => setForm({ ...form, maxShots: e.target.value })}
                placeholder="VD: 20000"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cảnh báo khi còn ≤</Label>
              <Input
                type="number"
                value={form.warnShots}
                onChange={(e) => setForm({ ...form, warnShots: e.target.value })}
                placeholder="Mặc định 1000"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>

      {/* Ghi shot */}
      <Modal open={!!shotFor} onClose={() => setShotFor(null)} title={`Ghi shot — ${shotFor?.name ?? ""}`}>
        <form onSubmit={recordShot} className="space-y-4">
          {shotFor && (
            <p className="text-sm text-muted-foreground">
              Đã dùng {formatNumber(shotFor.usedShots)} / {formatNumber(shotFor.maxShots)} shot · còn{" "}
              {formatNumber(shotFor.maxShots - shotFor.usedShots)} shot.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Số shot đã bắn *</Label>
              <Input
                type="number"
                value={shotForm.shots}
                onChange={(e) => setShotForm({ ...shotForm, shots: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ngày thực hiện</Label>
              <Input
                type="date"
                value={shotForm.performedAt}
                onChange={(e) => setShotForm({ ...shotForm, performedAt: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Khách hàng</Label>
            <Input
              value={shotForm.customerName}
              onChange={(e) => setShotForm({ ...shotForm, customerName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={shotForm.note} onChange={(e) => setShotForm({ ...shotForm, note: e.target.value })} />
          </div>
          {shotError && <p className="text-sm text-destructive">{shotError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShotFor(null)}>
              Hủy
            </Button>
            <Button type="submit">Ghi nhận</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
