// =============================================================================
// In ấn phía client: mở cửa sổ mới với nội dung HTML rồi gọi print.
// Dùng cho phiếu nhập/xuất/chuyển kho và tem lô (mã lô + HSD).
// =============================================================================
import { ISSUE_TYPE_LABEL } from "./labels";

function openPrint(title: string, bodyHtml: string, styles = "") {
  const w = window.open("", "_blank", "width=840,height=640");
  if (!w) return;
  const BRAND = "#1e6fd6";

  // Thông tin công ty (đã cache khi đăng nhập) để in lên đầu phiếu.
  let company: any = { name: "Sophia Wellness", logo: null };
  try {
    const c = JSON.parse(localStorage.getItem("sophia_company") || "{}");
    if (c && c.name) company = { ...company, ...c };
  } catch {}
  const esc = (s: string) => String(s).replace(/</g, "&lt;");
  const mark = company.logo
    ? `<img class="mark" src="${company.logo}" alt="logo" />`
    : `<div class="mark">✦</div>`;
  const contact = [company.address, company.phone && "ĐT: " + company.phone, company.taxCode && "MST: " + company.taxCode]
    .filter(Boolean)
    .map(esc)
    .join(" · ");
  const brandHtml = `<div class="brand">${mark}<div>
      <div class="brand-name">${esc(company.name)}</div>
      <div class="brand-sub">${contact || "Hệ thống quản lý kho"}</div>
    </div></div>`;
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
    <style>
      *{box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}
      body{margin:0;padding:24px 28px;color:#16203a}
      .brand{display:flex;align-items:center;gap:12px;border-bottom:2px solid ${BRAND};padding-bottom:12px;margin-bottom:18px}
      .brand .mark{width:40px;height:40px;border-radius:10px;background:${BRAND};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}
      img.mark{object-fit:contain;background:#fff;border:1px solid #d8e3f0}
      .brand-name{font-family:Cambria,"Times New Roman","Liberation Serif",serif;font-size:19px;font-weight:700;letter-spacing:.02em;line-height:1.1}
      .brand-sub{font-size:11px;color:#64748b;margin-top:3px}
      h1{font-family:Cambria,"Times New Roman","Liberation Serif",serif;font-size:20px;text-align:center;margin:0 0 4px;color:${BRAND}}
      h2{font-size:14px;margin:14px 0 6px}
      .code{text-align:center;color:#64748b;margin-bottom:16px}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:13px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #d8e3f0;padding:6px 8px;text-align:left}
      th{background:#e8f1fb;color:#1e3a5f}
      tfoot td{background:#f2f7fd}
      .r{text-align:right}
      .mono{font-family:ui-monospace,Menlo,monospace}
      .muted{color:#64748b}
      .sign{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;margin-top:36px;font-weight:600}
      .sign div::after{content:"";display:block;height:56px}
      .labels{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
      .label{border:1px dashed ${BRAND};border-radius:8px;padding:10px 12px}
      .label .name{font-weight:700;font-size:14px}
      .label .row{display:flex;justify-content:space-between;margin-top:4px;font-size:12px}
      ${styles}
    </style></head><body>
    ${brandHtml}
    ${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function d(v?: string | null): string {
  return v ? new Date(v).toLocaleDateString("vi-VN") : "—";
}
function n(v?: number | null): string {
  return v == null ? "—" : new Intl.NumberFormat("vi-VN").format(v);
}

interface ReceiptDoc {
  code: string;
  supplier: { name: string };
  warehouse: { name: string };
  createdBy: { name: string };
  receivedAt?: string | null;
  note?: string | null;
  items: {
    product: { sku: string; name: string; uom: string };
    batchCode?: string | null;
    expiryDate?: string | null;
    mfgDate?: string | null;
    quantity: number;
    unitCost?: number | null;
  }[];
}

/** In phiếu nhập kho (khổ A4). */
export function printReceipt(r: ReceiptDoc) {
  const total = r.items.reduce((s, it) => s + it.quantity * (it.unitCost ?? 0), 0);
  openPrint(
    `Phiếu nhập ${r.code}`,
    `<h1>PHIẾU NHẬP KHO</h1>
     <div class="code">Số: ${r.code}</div>
     <div class="meta">
       <div><b>Nhà cung cấp:</b> ${r.supplier.name}</div>
       <div><b>Kho nhập:</b> ${r.warehouse.name}</div>
       <div><b>Ngày nhập:</b> ${d(r.receivedAt)}</div>
       <div><b>Người lập:</b> ${r.createdBy.name}</div>
     </div>
     <table><thead><tr>
       <th>STT</th><th>SKU</th><th>Tên hàng</th><th>Mã lô</th><th>HSD</th>
       <th class="r">SL</th><th class="r">Giá vốn</th><th class="r">Thành tiền</th>
     </tr></thead><tbody>
       ${r.items
         .map(
           (it, i) => `<tr>
         <td>${i + 1}</td><td class="mono">${it.product.sku}</td><td>${it.product.name}</td>
         <td class="mono">${it.batchCode ?? "—"}</td><td>${d(it.expiryDate)}</td>
         <td class="r">${n(it.quantity)} ${it.product.uom}</td>
         <td class="r">${n(it.unitCost)}</td><td class="r">${n(it.quantity * (it.unitCost ?? 0))}</td>
       </tr>`
         )
         .join("")}
     </tbody><tfoot><tr><td colspan="7" class="r"><b>Tổng cộng</b></td><td class="r"><b>${n(total)} đ</b></td></tr></tfoot></table>
     ${r.note ? `<p><b>Ghi chú:</b> ${r.note}</p>` : ""}
     <div class="sign"><div>Người giao hàng</div><div>Thủ kho</div><div>Người lập phiếu</div></div>`
  );
}

interface IssueDoc {
  code: string;
  issueType: string;
  customerName?: string | null;
  warehouse: { name: string };
  createdBy: { name: string };
  issuedAt?: string | null;
  note?: string | null;
  items: {
    product: { sku: string; name: string; uom: string };
    batch?: { batchCode?: string | null; expiryDate?: string | null } | null;
    quantity: number;
  }[];
}

/** In phiếu xuất kho (khổ A4). */
export function printIssue(r: IssueDoc) {
  openPrint(
    `Phiếu xuất ${r.code}`,
    `<h1>PHIẾU XUẤT KHO</h1>
     <div class="code">Số: ${r.code}</div>
     <div class="meta">
       <div><b>Loại xuất:</b> ${ISSUE_TYPE_LABEL[r.issueType] ?? r.issueType}</div>
       <div><b>Kho xuất:</b> ${r.warehouse.name}</div>
       <div><b>Khách / Bộ phận:</b> ${r.customerName ?? "—"}</div>
       <div><b>Ngày xuất:</b> ${d(r.issuedAt)}</div>
       <div><b>Người lập:</b> ${r.createdBy.name}</div>
     </div>
     <table><thead><tr>
       <th>STT</th><th>SKU</th><th>Tên hàng</th><th>Lô xuất</th><th>HSD</th><th class="r">SL</th>
     </tr></thead><tbody>
       ${r.items
         .map(
           (it, i) => `<tr>
         <td>${i + 1}</td><td class="mono">${it.product.sku}</td><td>${it.product.name}</td>
         <td class="mono">${it.batch?.batchCode ?? "—"}</td><td>${d(it.batch?.expiryDate)}</td>
         <td class="r">${n(it.quantity)} ${it.product.uom}</td>
       </tr>`
         )
         .join("")}
     </tbody></table>
     ${r.note ? `<p><b>Ghi chú:</b> ${r.note}</p>` : ""}
     <div class="sign"><div>Người nhận hàng</div><div>Thủ kho</div><div>Người lập phiếu</div></div>`
  );
}

interface TransferDoc {
  code: string;
  fromWarehouse: { name: string };
  toWarehouse: { name: string };
  createdBy: { name: string };
  transferredAt?: string | null;
  note?: string | null;
  movements: {
    product: { sku: string; name: string; uom: string };
    batch?: { batchCode?: string | null; expiryDate?: string | null } | null;
    quantity: number;
  }[];
}

/** In phiếu chuyển kho (khổ A4). */
export function printTransfer(r: TransferDoc) {
  openPrint(
    `Phiếu chuyển ${r.code}`,
    `<h1>PHIẾU CHUYỂN KHO</h1>
     <div class="code">Số: ${r.code}</div>
     <div class="meta">
       <div><b>Kho nguồn:</b> ${r.fromWarehouse.name}</div>
       <div><b>Kho đích:</b> ${r.toWarehouse.name}</div>
       <div><b>Ngày chuyển:</b> ${d(r.transferredAt)}</div>
       <div><b>Người lập:</b> ${r.createdBy.name}</div>
     </div>
     <table><thead><tr>
       <th>STT</th><th>SKU</th><th>Tên hàng</th><th>Mã lô</th><th>HSD</th><th class="r">SL chuyển</th>
     </tr></thead><tbody>
       ${r.movements
         .map(
           (m, i) => `<tr>
         <td>${i + 1}</td><td class="mono">${m.product.sku}</td><td>${m.product.name}</td>
         <td class="mono">${m.batch?.batchCode ?? "—"}</td><td>${d(m.batch?.expiryDate)}</td>
         <td class="r">${n(Math.abs(m.quantity))} ${m.product.uom}</td>
       </tr>`
         )
         .join("")}
     </tbody></table>
     ${r.note ? `<p><b>Ghi chú:</b> ${r.note}</p>` : ""}
     <div class="sign"><div>Kho nguồn</div><div>Vận chuyển</div><div>Kho đích</div></div>`
  );
}

/** In tem lô hàng từ phiếu nhập (mã lô + HSD + NSX). */
export function printBatchLabels(r: ReceiptDoc) {
  openPrint(
    `Tem lô ${r.code}`,
    `<h1>TEM LÔ HÀNG</h1>
     <div class="code">Từ phiếu nhập ${r.code} · ${r.warehouse.name}</div>
     <div class="labels">
       ${r.items
         .map(
           (it) => `<div class="label">
         <div class="name">${it.product.name}</div>
         <div class="row"><span class="mono">${it.product.sku}</span><span>SL: ${n(it.quantity)} ${it.product.uom}</span></div>
         <div class="row"><span>Lô: <b>${it.batchCode ?? "—"}</b></span><span>NSX: ${d(it.mfgDate)}</span></div>
         <div class="row"><span>HSD: <b>${d(it.expiryDate)}</b></span><span>${r.warehouse.name}</span></div>
       </div>`
         )
         .join("")}
     </div>`
  );
}
