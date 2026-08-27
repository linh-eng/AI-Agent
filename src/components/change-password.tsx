"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/client";

const EMPTY = { currentPassword: "", newPassword: "", confirm: "" };

/** Nút + hộp thoại để người dùng tự đổi mật khẩu của mình. */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setForm(EMPTY);
    setError(null);
    setDone(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirm) {
      setError("Xác nhận mật khẩu không khớp");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      setDone(true);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        title="Đổi mật khẩu"
      >
        <KeyRound className="h-4 w-4" />
        <span className="hidden sm:inline">Đổi mật khẩu</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Đổi mật khẩu">
        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-700">Đã đổi mật khẩu thành công.</p>
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Đóng</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Mật khẩu hiện tại *</Label>
              <Input
                type="password"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mật khẩu mới *</Label>
              <Input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                placeholder="Tối thiểu 6 ký tự"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Xác nhận mật khẩu mới *</Label>
              <Input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Đang lưu…" : "Đổi mật khẩu"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
