"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { PrintFrame, PrintToolbar } from "@/components/print-frame";

interface Item {
  id: string;
  product: { sku: string; name: string; uom: string };
  batchCode?: string | null;
  expiryDate?: string | null;
  quantity: number;
  unitCost?: number | null;
}
interface Receipt {
  id: string;
  code: string;
  supplier: { name: string; code: string };
  warehouse: { name: string };
  createdBy: { name: string };
  note?: string | null;
  receivedAt?: string | null;
  items: Item[];
}

export default function PrintReceiptPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Receipt | null>(null);

  useEffect(() => {
    apiFetch<Receipt>(`/api/receipts/${params.id}`).then(setData).catch(() => {});
  }, [params.id]);

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 400);
  }, [data]);

  if (!data) return <p style={{ padding: 24 }}>Đang tải…</p>;
  const total = data.items.reduce((s, it) => s + it.quantity * (it.unitCost ?? 0), 0);

  return (
    <PrintFrame>
      <PrintToolbar />
      <h1 className="doc-title">PHIẾU NHẬP KHO</h1>
      <div className="doc-code">Số: {data.code}</div>
      <div className="doc-meta">
        <div><b>Nhà cung cấp:</b> {data.supplier.name}</div>
        <div><b>Kho nhập:</b> {data.warehouse.name}</div>
        <div><b>Ngày nhập:</b> {formatDate(data.receivedAt)}</div>
        <div><b>Người lập:</b> {data.createdBy.name}</div>
      </div>
      <table className="doc-table">
        <thead>
          <tr>
            <th>STT</th><th>SKU</th><th>Tên hàng</th><th>Mã lô</th><th>HSD</th>
            <th className="r">SL</th><th className="r">Giá vốn</th><th className="r">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={it.id}>
              <td>{i + 1}</td>
              <td>{it.product.sku}</td>
              <td>{it.product.name}</td>
              <td>{it.batchCode ?? "—"}</td>
              <td>{it.expiryDate ? formatDate(it.expiryDate) : "—"}</td>
              <td className="r">{formatNumber(it.quantity)} {it.product.uom}</td>
              <td className="r">{it.unitCost != null ? formatNumber(it.unitCost) : "—"}</td>
              <td className="r">{formatNumber(it.quantity * (it.unitCost ?? 0))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} className="r"><b>Tổng cộng</b></td>
            <td className="r"><b>{formatNumber(total)} đ</b></td>
          </tr>
        </tfoot>
      </table>
      {data.note && <p className="doc-note"><b>Ghi chú:</b> {data.note}</p>}
      <div className="doc-sign">
        <div>Người giao hàng</div>
        <div>Thủ kho</div>
        <div>Người lập phiếu</div>
      </div>
    </PrintFrame>
  );
}
