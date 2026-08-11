"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";
import { FormRenderer } from "@/components/form-renderer";
import { emptySchema, type FormSchema } from "@/lib/form-builder";

interface Instance {
  id: string;
  name?: string | null;
  templateVersion: number;
  schemaSnapshot: FormSchema;
  data?: Record<string, any> | null;
  customerId?: string | null;
  status?: string;
  completedBy?: string | null;
  template: { name: string; code: string };
  customer?: { code: string; fullName: string } | null;
}

export default function FormInstancePage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useCan(PERMISSIONS.TREATMENT_WRITE);
  const [inst, setInst] = useState<Instance | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Instance>(`/api/form-instances/${id}`);
      setInst(data);
      setValues(data.data ?? {});
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function save(complete = false) {
    setSaving(true); setError(null); setSaved(false);
    try {
      await apiFetch(`/api/form-instances/${id}`, { method: "PATCH", body: JSON.stringify({ data: values, complete }) });
      setSaved(true);
      if (complete) load();
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;
  if (!inst) return <p className="text-destructive">Không tìm thấy phiếu.</p>;

  const schema = inst.schemaSnapshot?.sections ? inst.schemaSnapshot : emptySchema();
  const done = inst.status === "COMPLETED";

  return (
    <div>
      {inst.customerId && (
        <Link href={`/customers/${inst.customerId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Về hồ sơ khách
        </Link>
      )}
      <PageHeader
        title={inst.name ?? inst.template.name}
        description={`${inst.template.code} · phiên bản mẫu v${inst.templateVersion}${inst.customer ? " · " + inst.customer.fullName : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={done ? "success" : "muted"}>{done ? "Đã hoàn thành" : "Đang điền"}</Badge>
            {canWrite && !done && <Button variant="outline" onClick={() => save(false)} disabled={saving}><Save className="h-4 w-4" /> {saving ? "..." : "Lưu"}</Button>}
            {canWrite && !done && <Button onClick={() => save(true)} disabled={saving}><CheckCircle2 className="h-4 w-4" /> Hoàn thành</Button>}
          </div>
        }
      />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {saved && <p className="mb-3 text-sm text-emerald-600">Đã lưu.</p>}
      {done && <p className="mb-3 text-sm text-muted-foreground">Phiếu đã hoàn thành{inst.completedBy ? ` bởi ${inst.completedBy}` : ""} — lưu bất biến làm hồ sơ lịch sử.</p>}
      <Card>
        <CardContent className="p-5">
          <FormRenderer schema={schema} values={values} onChange={setValues} disabled={!canWrite || done} />
        </CardContent>
      </Card>
    </div>
  );
}
