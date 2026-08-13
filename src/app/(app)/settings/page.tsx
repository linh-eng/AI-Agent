"use client";
import { useEffect, useRef, useState } from "react";
import { Save, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

interface Brand { name: string; tagline?: string; primaryColor?: string; logoDataUrl?: string }

export default function SettingsPage() {
  const canWrite = useCan(PERMISSIONS.SETTING_WRITE);
  const [brand, setBrand] = useState<Brand>({ name: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<Brand>("/api/settings/brand").then(setBrand).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) { setError("Logo tối đa ~400KB. Hãy dùng ảnh nhỏ hơn."); return; }
    const reader = new FileReader();
    reader.onload = () => setBrand((b) => ({ ...b, logoDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true); setError(null); setMsg(null);
    try {
      const saved = await apiFetch<Brand>("/api/settings/brand", { method: "PUT", body: JSON.stringify(brand) });
      setBrand(saved);
      setMsg("Đã lưu. Tải lại trang để áp dụng tên/logo mới trên toàn hệ thống.");
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải...</p>;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Cài đặt · Thương hiệu" description="Tên phần mềm, khẩu hiệu, màu nhấn và logo. Cấu hình tập trung tại đây (không sửa mã nguồn)." />
      {!canWrite && <p className="mb-3 rounded border border-amber-500/40 bg-amber-500/5 p-2 text-sm text-amber-700">Bạn chỉ có quyền xem. Liên hệ quản lý để thay đổi cấu hình.</p>}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Tên phần mềm / thương hiệu *</Label>
            <Input value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} disabled={!canWrite} placeholder="VD: Sophia Care" />
          </div>
          <div className="space-y-1.5">
            <Label>Khẩu hiệu</Label>
            <Input value={brand.tagline ?? ""} onChange={(e) => setBrand({ ...brand, tagline: e.target.value })} disabled={!canWrite} placeholder="Quản lý khách hàng & vận hành dịch vụ" />
          </div>
          <div className="space-y-1.5">
            <Label>Màu nhấn (hex)</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={brand.primaryColor ?? "#4f7d6e"} onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })} disabled={!canWrite} className="h-9 w-12 rounded border" />
              <Input value={brand.primaryColor ?? ""} onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })} disabled={!canWrite} placeholder="#4f7d6e" className="w-40" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              {brand.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoDataUrl} alt="logo" className="h-12 w-12 rounded object-contain ring-1 ring-border" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded bg-muted text-xs text-muted-foreground">—</div>
              )}
              {canWrite && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Chọn ảnh</Button>
                  {brand.logoDataUrl && <Button type="button" variant="ghost" onClick={() => setBrand({ ...brand, logoDataUrl: undefined })}>Bỏ logo</Button>}
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Ảnh vuông, nền trong suốt, tối đa ~400KB.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          {canWrite && <div className="flex justify-end"><Button onClick={save} disabled={saving || !brand.name}><Save className="h-4 w-4" /> {saving ? "Đang lưu..." : "Lưu cấu hình"}</Button></div>}
        </CardContent>
      </Card>
    </div>
  );
}
