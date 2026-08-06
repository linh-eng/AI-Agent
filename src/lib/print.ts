// In ấn phía client: mở cửa sổ mới với nội dung HTML rồi gọi print.
function openPrint(title: string, bodyHtml: string, styles = "") {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
    <style>
      *{box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}
      body{margin:0;padding:20px;color:#111}
      h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:12px 0 6px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
      .muted{color:#666;font-size:12px} .mono{font-family:ui-monospace,Menlo,monospace}
      .label{border:2px solid #111;border-radius:8px;padding:12px;width:280px}
      .label .sn{font-size:22px;font-weight:700;letter-spacing:1px}
      .barcode{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:2px;margin-top:6px;word-break:break-all}
      ${styles}
    </style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

/** In tem serial (M3) — khổ tem nhỏ. */
export function printSerialLabel(s: { serialNumber: string; sku?: string; product?: string; warehouse?: string }) {
  openPrint(
    `Tem ${s.serialNumber}`,
    `<div class="label">
      <div class="muted">THNG — Tem hàng hóa</div>
      <div class="sn mono">${s.serialNumber}</div>
      <div>${s.product ?? ""}</div>
      <div class="muted">SKU: ${s.sku ?? "—"} · Kho: ${s.warehouse ?? "—"}</div>
      <div class="barcode">*${s.serialNumber}*</div>
    </div>`
  );
}

/** In biên bản bàn giao (M8). */
export function printDeliveryNote(order: any, delivery: any) {
  const serials = (delivery.serialNumbers ?? "").split(",").filter(Boolean);
  openPrint(
    `Biên bản bàn giao ${delivery.number}`,
    `<h1>BIÊN BẢN BÀN GIAO HÀNG HÓA</h1>
     <div class="muted">Số: ${delivery.number} · Phiếu xuất: ${order.number} (${order.type})</div>
     <h2>Thông tin giao hàng</h2>
     <table>
       <tr><th>Khách hàng</th><td>${order.customer?.name ?? "—"}</td><th>Dự án</th><td>${order.project?.code ?? "—"}</td></tr>
       <tr><th>Hình thức</th><td>${delivery.method ?? "—"}</td><th>Đơn vị VC</th><td>${delivery.carrier ?? "—"}</td></tr>
       <tr><th>Mã vận đơn</th><td>${delivery.trackingNumber ?? "—"}</td><th>Ngày giao</th><td>${delivery.deliveredAt ? new Date(delivery.deliveredAt).toLocaleDateString("vi-VN") : "—"}</td></tr>
     </table>
     <h2>Danh sách serial (${serials.length})</h2>
     <table><thead><tr><th>#</th><th>Serial</th></tr></thead><tbody>
       ${serials.map((s: string, i: number) => `<tr><td>${i + 1}</td><td class="mono">${s}</td></tr>`).join("") || '<tr><td colspan="2">—</td></tr>'}
     </tbody></table>
     <div style="margin-top:32px;display:flex;justify-content:space-between">
       <div style="text-align:center">Bên giao<br/><br/><br/>(ký, ghi rõ họ tên)</div>
       <div style="text-align:center">Bên nhận<br/><br/><br/>(ký, ghi rõ họ tên)</div>
     </div>`
  );
}
