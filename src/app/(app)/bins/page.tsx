"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Bin {
  id: string;
  code: string;
  label?: string | null;
}
interface Zone {
  id: string;
  code: string;
  name: string;
  bins: Bin[];
  warehouse?: { code: string; name: string };
}
interface WarehouseOpt {
  id: string;
  code: string;
  name: string;
}

export default function BinsPage() {
  const canWrite = useCan(PERMISSIONS.BIN_WRITE);
  const [zones, setZones] = useState<Zone[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [binOpen, setBinOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState({ warehouseId: "", code: "", name: "" });
  const [binForm, setBinForm] = useState({ zoneId: "", code: "", label: "" });

  async function load() {
    setLoading(true);
    try {
      const [z, w] = await Promise.all([
        apiFetch<Zone[]>("/api/zones"),
        apiFetch<WarehouseOpt[]>("/api/warehouses"),
      ]);
      setZones(z);
      setWarehouses(w);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/zones", { method: "POST", body: JSON.stringify(zoneForm) });
      setZoneOpen(false);
      setZoneForm({ warehouseId: "", code: "", name: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  async function createBin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/bins", { method: "POST", body: JSON.stringify(binForm) });
      setBinOpen(false);
      setBinForm({ zoneId: "", code: "", label: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div>
      <PageHeader
        title="Vị trí kệ (Zone / Bin)"
        description="Khu vực và vị trí kệ phục vụ Scan-to-Bin khi cất hàng."
        action={
          canWrite && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBinOpen(true)}>
                <Plus className="h-4 w-4" /> Thêm bin
              </Button>
              <Button onClick={() => setZoneOpen(true)}>
                <Plus className="h-4 w-4" /> Thêm khu vực
              </Button>
            </div>
          )
        }
      />

      {loading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : zones.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Chưa có khu vực nào. Tạo khu vực (zone) trước, rồi thêm vị trí kệ (bin).
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {zones.map((z) => (
            <Card key={z.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {z.code} — {z.name}
                </CardTitle>
                {z.warehouse && (
                  <p className="text-xs text-muted-foreground">
                    Kho {z.warehouse.code} — {z.warehouse.name}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {z.bins.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Chưa có bin</span>
                  ) : (
                    z.bins.map((b) => (
                      <Badge key={b.id} tone="muted" className="font-mono">
                        {b.code}
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal tạo zone */}
      <Modal open={zoneOpen} onClose={() => setZoneOpen(false)} title="Thêm khu vực (Zone)">
        <form onSubmit={createZone} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Kho *</Label>
            <Select
              value={zoneForm.warehouseId}
              onChange={(e) => setZoneForm({ ...zoneForm, warehouseId: e.target.value })}
              required
            >
              <option value="">— Chọn kho —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mã khu vực *</Label>
              <Input value={zoneForm.code} onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Tên *</Label>
              <Input value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} required />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setZoneOpen(false)}>
              Hủy
            </Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>

      {/* Modal tạo bin */}
      <Modal open={binOpen} onClose={() => setBinOpen(false)} title="Thêm vị trí kệ (Bin)">
        <form onSubmit={createBin} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Khu vực *</Label>
            <Select
              value={binForm.zoneId}
              onChange={(e) => setBinForm({ ...binForm, zoneId: e.target.value })}
              required
            >
              <option value="">— Chọn khu vực —</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.warehouse?.code} · {z.code} — {z.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mã bin *</Label>
              <Input value={binForm.code} onChange={(e) => setBinForm({ ...binForm, code: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Nhãn</Label>
              <Input value={binForm.label} onChange={(e) => setBinForm({ ...binForm, label: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBinOpen(false)}>
              Hủy
            </Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
