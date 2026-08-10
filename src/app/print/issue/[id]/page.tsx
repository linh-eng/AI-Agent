"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { PrintFrame, PrintToolbar } from "@/components/print-frame";

interface Item {
  id: string;
  product: { sku: string; name: string; uom: string };
  batch?: { batchCode?: string | null; expiryDate?: string | null } | null;
  quantity: number;
}
interface Issue {
  id: string;
  code: string;
  issueType: string;
  customerName?: string | null;
  warehouse: { name: string };
  createdBy: { name: string };
  note?: string | null;
  issuedAt?: string | null;
  items: Item[];
}

const ISSUE_LABEL: Record<string, string> = {
  SALE: "Bán hàng",
  INTERNAL_USE: "Dùng nội bộ",
  DISPOSAL: "Hủy",
  ADJUSTMENT: "Điều chỉnh",
};

export default function PrintIssuePage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Issue | null>(null);

  useEffect(() => {
    apiFetch<Issue>(`/api/issues/${params.id}`).then(setData).catch(() => {});
  }, [params.id]);
  useEffect(() => {
    if (data) setTimeout(() => window.print(), 400);
  }, [data]);

  if (!data) return <p style={{ padding: 24 }}>Đang tải…</p>;

  return (
    <PrintFrame>
      <PrintToolbar />
      <h1 className="doc-title">PHIẾU XUẤT KHO</h1>
      <div className="doc-code">Số: {data.code}</div>
      <div className="doc-meta">
        <div><b>Loại xuất:</b> {ISSUE_LABEL[data.issueType] ?? data.issueType}</div>
        <div><b>Kho xuất:</b> {data.warehouse.name}</div>
        <div><b>Khách / Bộ phận:</b> {data.customerName ?? "—"}</div>
        <div><b>Ngày xuất:</b> {formatDate(data.issuedAt)}</div>
        <div><b>Người lập:</b> {data.createdBy.name}</div>
      </div>
      <table className="doc-table">
        <thead>
          <tr>
            <th>STT</th><th>SKU</th><th>Tên hàng</th><th>Lô xuất</th><th>HSD</th><th className="r">SL</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={it.id}>
              <td>{i + 1}</td>
              <td>{it.product.sku}</td>
              <td>{it.product.name}</td>
              <td>{it.batch?.batchCode ?? "—"}</td>
              <td>{it.batch?.expiryDate ? formatDate(it.batch.expiryDate) : "—"}</td>
              <td className="r">{formatNumber(it.quantity)} {it.product.uom}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.note && <p className="doc-note"><b>Ghi chú:</b> {data.note}</p>}
      <div className="doc-sign">
        <div>Người nhận hàng</div>
        <div>Thủ kho</div>
        <div>Người lập phiếu</div>
      </div>
    </PrintFrame>
  );
}
