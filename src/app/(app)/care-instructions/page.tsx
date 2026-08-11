"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import {
  CARE_KIND_LABEL,
  CARE_KIND_TONE,
  LIBRARY_STATUS_LABEL,
  LIBRARY_STATUS_TONE,
} from "@/lib/clinic-labels";

interface Care {
  id: string; code: string; title: string; kind: string; category?: string | null;
  content: string; version: number; status: string;
}
const KINDS = ["PRE_CARE", "POST_CARE", "GENERAL", "FOLLOW_UP"];
const STATUSES = ["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "ARCHIVED"];

export default function CareInstructionsPage() {
  const canWrite = useCan(PERMISSIONS.CARE_WRITE);
  const [rows, setRows] = useState<Care[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Care | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setRows(await apiFetch<Care[]>("/api/care-instructions")); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const blank: Care = { id: "", code: "", title: "", kind: "PRE_CARE", category: "", content: "", version: 1, status: "DRAFT" };

  async function save(c: Care) {
    setError(null);
    try {
      if (c.id) {
        await apiFetch(`/api/care-instructions/${c.id}`, { method: "PATCH", body: JSON.stringify({ title: c.title, kind: c.kind, category: c.category, content: c.content, status: c.status }) });
      } else {
        await apiFetch("/api/care-instructions", { method: "POST", body: JSON.stringify({ title: c.title, kind: c.kind, category: c.category, content: c.content }) });
      }
      setEdit(null); setCreating(false); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
  }

  return (
    <div>
      <PageHeader
        title="Thư viện hướng dẫn (Pre/Post-care)"
        description="Mẫu dặn dò trước/sau dịch vụ tái sử dụng. Khi gửi khách sẽ tạo bản snapshot riêng, cá nhân hóa được."
        action={canWrite && <Button onClick={() => { setEdit({ ...blank }); setCreating(true); }}><Plus className="h-4 w-4" /> Thêm hướng dẫn</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Mã</TH><TH>Tiêu đề</TH><TH>Loại</TH><TH>Nhóm</TH><TH>Ver</TH><TH>Trạng thái</TH><TH></TH></TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TD></TR>
              ) : rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có hướng dẫn</TD></TR>
              ) : (
                rows.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-mono font-medium">{c.code}</TD>
                    <TD>{c.title}</TD>
                    <TD><Badge tone={CARE_KIND_TONE[c.kind]}>{CARE_KIND_LABEL[c.kind]}</Badge></TD>
                    <TD>{c.category ?? "—"}</TD>
                    <TD>v{c.version}</TD>
                    <TD><Badge tone={LIBRARY_STATUS_TONE[c.status]}>{LIBRARY_STATUS_LABEL[c.status]}</Badge></TD>
                    <TD>{canWrite && <Button size="sm" variant="outline" onClick={() => { setEdit(c); setCreating(false); }}><Pencil className="h-4 w-4" /></Button>}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {edit && (
        <Modal open onClose={() => setEdit(null)} title={creating ? "Thêm hướng dẫn" : `Sửa: ${edit.title}`} className="max-w-2xl">
          <form onSubmit={(e) => { e.preventDefault(); save(edit); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Tiêu đề *</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required /></div>
              <div className="space-y-1.5">
                <Label>Loại</Label>
                <Select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                  {KINDS.map((k) => <option key={k} value={k}>{CARE_KIND_LABEL[k]}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Nhóm</Label><Input value={edit.category ?? ""} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
              {!creating && (
                <div className="space-y-1.5">
                  <Label>Trạng thái</Label>
                  <Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{LIBRARY_STATUS_LABEL[s]}</option>)}
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Nội dung *</Label>
              <textarea className="min-h-[160px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm" value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEdit(null)}>Hủy</Button><Button type="submit">Lưu</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
