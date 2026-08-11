"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Tech {
  id: string;
  code: string;
  name: string;
  group?: string | null;
  deviceModel?: string | null;
  area?: string | null;
  durationMinutes?: number | null;
  brand?: { name: string } | null;
}
interface Brand { id: string; name: string }

export default function TechnologiesPage() {
  const canWrite = useCan(PERMISSIONS.TECHNOLOGY_WRITE);
  const [rows, setRows] = useState<Tech[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", group: "", brandId: "", deviceModel: "", area: "", durationMinutes: "",
    indications: "", contraindications: "", description: "", preCare: "", postCare: "",
  });

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch<Tech[]>("/api/technologies")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); apiFetch<Brand[]>("/api/brands").then(setBrands).catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: any = { ...form };
      if (!body.brandId) delete body.brandId;
      if (body.durationMinutes) body.durationMinutes = Number(body.durationMinutes); else delete body.durationMinutes;
      Object.keys(body).forEach((k) => { if (body[k] === "") delete body[k]; });
      await apiFetch("/api/technologies", { method: "POST", body: JSON.stringify(body) });
      setOpen(false);
      setForm({ name: "", group: "", brandId: "", deviceModel: "", area: "", durationMinutes: "", indications: "", contraindications: "", description: "", preCare: "", postCare: "" });
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Công nghệ"
        description="Thiết bị/công nghệ dùng tại spa — dùng được trong nhiều dịch vụ và phác đồ."
        action={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Thêm công nghệ</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Tên</TH><TH>Nhóm</TH><TH>Brand</TH><TH>Model</TH><TH>Vùng</TH><TH>Thời lượng</TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có công nghệ</TD></TR>
              ) : (
                rows.map((t) => (
                  <TR key={t.id}>
                    <TD className="font-mono font-medium">{t.code}</TD>
                    <TD className="font-medium">{t.name}</TD>
                    <TD>{t.group ?? "—"}</TD>
                    <TD>{t.brand?.name ?? "—"}</TD>
                    <TD>{t.deviceModel ?? "—"}</TD>
                    <TD>{t.area ?? "—"}</TD>
                    <TD>{t.durationMinutes ? `${t.durationMinutes}′` : "—"}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm công nghệ" className="max-w-2xl">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tên *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Nhóm</Label><Input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
                <option value="">—</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Model thiết bị</Label><Input value={form.deviceModel} onChange={(e) => setForm({ ...form, deviceModel: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Thời lượng (phút)</Label><Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Vùng thực hiện</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Chỉ định</Label><Input value={form.indications} onChange={(e) => setForm({ ...form, indications: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Chống chỉ định</Label><Input value={form.contraindications} onChange={(e) => setForm({ ...form, contraindications: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Hướng dẫn trước</Label><Input value={form.preCare} onChange={(e) => setForm({ ...form, preCare: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Hướng dẫn sau</Label><Input value={form.postCare} onChange={(e) => setForm({ ...form, postCare: e.target.value })} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></div>
        </form>
      </Modal>
    </div>
  );
}
