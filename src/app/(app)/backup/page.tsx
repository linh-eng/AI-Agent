"use client";
import { useRef, useState } from "react";
import { Download, Upload, AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/session-provider";
import { PERMISSIONS } from "@/lib/rbac";

export default function BackupPage() {
  const canManage = useCan(PERMISSIONS.USER_MANAGE);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"backup" | "restore" | "clear" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [clearConfirm, setClearConfirm] = useState("");

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Sao lưu & Phục hồi" />
        <Card>
          <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Chỉ tài khoản <b className="mx-1">Quản trị</b> mới được sao lưu / phục hồi dữ liệu.
          </CardContent>
        </Card>
      </div>
    );
  }

  async function downloadBackup() {
    setMsg(null);
    setBusy("backup");
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Không tải được bản sao lưu");
      const blob = await res.blob();
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "sophia-backup.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ tone: "ok", text: `Đã tải bản sao lưu: ${name}` });
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Lỗi" });
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    if (!file) {
      setMsg({ tone: "err", text: "Vui lòng chọn tệp .json sao lưu trước." });
      return;
    }
    if (
      !window.confirm(
        "Khôi phục sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại bằng dữ liệu trong tệp sao lưu. Bạn chắc chắn?"
      )
    )
      return;
    setMsg(null);
    setBusy("restore");
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Khôi phục thất bại");
      setMsg({
        tone: "ok",
        text: `Khôi phục thành công (${json.data?.total ?? 0} bản ghi). Hãy ĐĂNG XUẤT và đăng nhập lại; nếu chạy bản production thì khởi động lại phần mềm.`,
      });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Lỗi" });
    } finally {
      setBusy(null);
    }
  }

  async function clearBusiness() {
    if (clearConfirm !== "XOA") {
      setMsg({ tone: "err", text: 'Vui lòng gõ đúng chữ "XOA" để xác nhận.' });
      return;
    }
    if (
      !window.confirm(
        "XÓA TOÀN BỘ dữ liệu nghiệp vụ (sản phẩm, kho, phiếu, tồn kho, dịch vụ, tài sản…)? Người dùng và cài đặt công ty được giữ lại. Thao tác KHÔNG THỂ hoàn tác."
      )
    )
      return;
    setMsg(null);
    setBusy("clear");
    try {
      const res = await fetch("/api/admin/clear-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "XOA" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Xóa dữ liệu thất bại");
      setClearConfirm("");
      setMsg({
        tone: "ok",
        text: `Đã xóa ${json.data?.total ?? 0} bản ghi dữ liệu nghiệp vụ. Người dùng & cài đặt công ty được giữ nguyên. Giờ chị có thể bắt đầu nhập dữ liệu thật.`,
      });
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Lỗi" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sao lưu & Phục hồi"
        description="Tải toàn bộ dữ liệu ra một tệp để cất giữ, hoặc phục hồi lại từ tệp đã sao lưu."
      />

      {msg && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            msg.tone === "ok"
              ? "border-emerald-300/50 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/20"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tải bản sao lưu */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-1 font-semibold">Tải bản sao lưu</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Tải toàn bộ dữ liệu (sản phẩm, phiếu, tồn kho, người dùng, logo công ty…) về máy dưới dạng một
              tệp <b>.json</b>. Nên làm định kỳ và cất ở nơi an toàn (USB, ổ mạng…).
            </p>
            <Button onClick={downloadBackup} disabled={busy !== null}>
              <Download className="h-4 w-4" /> {busy === "backup" ? "Đang tạo…" : "Tải bản sao lưu (.json)"}
            </Button>
          </CardContent>
        </Card>

        {/* Khôi phục */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-1 font-semibold">Khôi phục từ bản sao lưu</h3>
            <p className="mb-3 text-sm text-muted-foreground">Chọn tệp .json đã sao lưu trước đó để khôi phục dữ liệu.</p>
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50/50 p-3 text-sm text-amber-800 dark:bg-amber-950/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>
                Thao tác này sẽ <b>GHI ĐÈ</b> toàn bộ dữ liệu hiện tại. Nên tải một bản sao lưu mới trước khi
                khôi phục. Sau khi khôi phục cần <b>đăng nhập lại</b> (hoặc khởi động lại phần mềm nếu chạy bản
                production).
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mb-3 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
            />
            <Button variant="outline" onClick={restore} disabled={busy !== null || !file}>
              <Upload className="h-4 w-4" /> {busy === "restore" ? "Đang khôi phục…" : "Khôi phục"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Hướng dẫn nhanh */}
      <Card className="mt-4">
        <CardContent className="p-5 text-sm">
          <h3 className="mb-2 font-semibold">Hướng dẫn nhanh</h3>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>
              • <b>Sao lưu:</b> bấm “Tải bản sao lưu” → lưu tệp .json vào nơi an toàn (đặt tên kèm ngày).
            </li>
            <li>
              • <b>Khôi phục:</b> chọn tệp .json → bấm “Khôi phục” → <b>đăng xuất và đăng nhập lại</b> để dữ
              liệu hiển thị đúng.
            </li>
            <li>
              • Tệp .json chứa <b>toàn bộ</b> dữ liệu và logo công ty — không cần sao lưu thêm tệp rời nào khác.
            </li>
            <li>
              • Sao lưu nâng cao (kỹ thuật): có thể dùng <code className="rounded bg-muted px-1">pg_dump</code>{" "}
              trên PostgreSQL để sao lưu nhị phân toàn bộ cơ sở dữ liệu.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Vùng nguy hiểm — Xóa dữ liệu nghiệp vụ */}
      <Card className="mt-4 border-destructive/40">
        <CardContent className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-destructive">Vùng nguy hiểm — Xóa dữ liệu nghiệp vụ</h3>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Xóa toàn bộ dữ liệu demo/nghiệp vụ để bắt đầu nhập dữ liệu thật: sản phẩm, nhóm hàng, thương hiệu,
            nhà cung cấp, kho, tồn kho &amp; lô, phiếu nhập–xuất–chuyển, kiểm kê, dịch vụ &amp; ghi nhận, tài
            sản, tay cầm. <b>Giữ nguyên</b> phần Hệ thống: <b>người dùng, phân quyền và cài đặt công ty</b>.
          </p>
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>
              Thao tác này <b>KHÔNG THỂ hoàn tác</b>. Hãy bấm “Tải bản sao lưu” ở trên trước khi xóa.
            </span>
          </div>
          <label className="mb-1 block text-sm font-medium">Gõ “XOA” để xác nhận</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={clearConfirm}
              onChange={(e) => setClearConfirm(e.target.value)}
              placeholder="XOA"
              className="h-9 w-40 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              variant="destructive"
              onClick={clearBusiness}
              disabled={busy !== null || clearConfirm !== "XOA"}
            >
              <Trash2 className="h-4 w-4" /> {busy === "clear" ? "Đang xóa…" : "Xóa dữ liệu nghiệp vụ"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
