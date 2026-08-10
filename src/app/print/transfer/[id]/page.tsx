"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { PrintFrame, PrintToolbar } from "@/components/print-frame";

interface Movement {
  id: string;
  product: { sku: string; name: string; uom: string };
  batch?: { batchCode?: string | null; expiryDate?: string | null } | null;
  quantity: number;
}
interface Transfer {
  id: string;
  code: string;
  fromWarehouse: { name: string };
  toWarehouse: { name: string };
  createdBy: { name: string };
  note?: string | null;
  transferredAt?: string | null;
  movements: Movement[];
}

export default function PrintTransferPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Transfer | null>(null);

  useEffect(() => {
    apiFetch<Transfer>(`/api/transfers/${params.id}`).then(setData).catch(() => {});
  }, [params.id]);
  useEffect(() => {
    if (data) setTimeout(() => window.print(), 400);
  }, [data]);

  if (!data) return <p style={{ padding: 24 }}>Đang tải…</p>;

  return (
    <PrintFrame>
      <PrintToolbar />
      <h1 className="doc-title">PHIẾU CHUYỂN KHO</h1>
      <div className="doc-code">Số: {data.code}</div>
      <div className="doc-meta">
        <div><b>Kho nguồn:</b> {data.fromWarehouse.name}</div>
        <div><b>Kho đích:</b> {data.toWarehouse.name}</div>
        <div><b>Ngày chuyển:</b> {formatDate(data.transferredAt)}</div>
        <div><b>Người lập:</b> {data.createdBy.name}</div>
      </div>
      <table className="doc-table">
        <thead>
          <tr>
            <th>STT</th><th>SKU</th><th>Tên hàng</th><th>Mã lô</th><th>HSD</th><th className="r">SL chuyển</th>
          </tr>
        </thead>
        <tbody>
          {data.movements.map((m, i) => (
            <tr key={m.id}>
              <td>{i + 1}</td>
              <td>{m.product.sku}</td>
              <td>{m.product.name}</td>
              <td>{m.batch?.batchCode ?? "—"}</td>
              <td>{m.batch?.expiryDate ? formatDate(m.batch.expiryDate) : "—"}</td>
              <td className="r">{formatNumber(Math.abs(m.quantity))} {m.product.uom}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.note && <p className="doc-note"><b>Ghi chú:</b> {data.note}</p>}
      <div className="doc-sign">
        <div>Kho nguồn</div>
        <div>Vận chuyển</div>
        <div>Kho đích</div>
      </div>
    </PrintFrame>
  );
}
