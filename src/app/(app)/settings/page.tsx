"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";

interface Setting {
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxCode: string | null;
}

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Setting>({
    name: "",
    logo: null,
    address: "",
    phone: "",
    email: "",
    taxCode: "",
  } as any);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Setting>("/api/settings")
      .then((s) =>
        setForm({
          name: s.name ?? "",
          logo: s.logo ?? null,
          address: s.address ?? "",
          phone: s.phone ?? "",
          email: s.email ?? "",
          taxCode: s.taxCode ?? "",
        })
      )
      .finally(() => setLoading(false));
  }, []);

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn tệp ảnh (PNG, JPG…)");
      return;
    }
    if (file.size > 600 * 1024) {
      setError("Ảnh quá lớn (tối đa ~600KB). Chọn ảnh nhỏ hơn.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result as string }));
    reader.readAsDataURL(file);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          logo: form.logo,
          address: form.address || null,
          phone: form.phone || null,
          email: form.email || null,
          taxCode: form.taxCode || null,
        }),
      });
      setMsg("Đã lưu. Tải lại trang để thấy logo/tên mới ở thanh bên.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Đang tải…</p>;

  return (
    <div>
      <PageHeader
        title="Cài đặt công ty"
        description="Thông tin & logo hiển thị ở thanh bên, trang đăng nhập và trên phiếu in."
      />
      <form onSubmit={save} className="max-w-2xl space-y-4">
        <Card>
          <CardContent className="space-y-5 p-6">
            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo công ty</Label>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-xl border bg-muted">
                  {form.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logo} alt="logo" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Chưa có</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={fileRef} type="file" accept="image/*" onChange={pickLogo} className="hidden" />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Chọn ảnh logo
                  </Button>
                  {form.logo && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setForm((f) => ({ ...f, logo: null }))}
                    >
                      <Trash2 className="h-4 w-4" /> Xoá logo
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">PNG/JPG, nền trong suốt đẹp nhất, tối đa ~600KB.</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tên công ty *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Địa chỉ</Label>
              <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Điện thoại</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Mã số thuế</Label>
                <Input value={form.taxCode ?? ""} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {msg && <p className="text-sm text-emerald-600">{msg}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Đang lưu…" : "Lưu thay đổi"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
