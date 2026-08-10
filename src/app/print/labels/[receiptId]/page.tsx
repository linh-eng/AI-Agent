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
  mfgDate?: string | null;
  quantity: number;
}
interface Receipt {
  code: string;
  warehouse: { name: string };
  items: Item[];
}

export default function PrintLabelsPage({ params }: { params: { receiptId: string } }) {
  const [data, setData] = useState<Receipt | null>(null);

  useEffect(() => {
    apiFetch<Receipt>(`/api/receipts/${params.receiptId}`).then(setData).catch(() => {});
  }, [params.receiptId]);
  useEffect(() => {
    if (data) setTimeout(() => window.print(), 400);
  }, [data]);

  if (!data) return <p style={{ padding: 24 }}>Đang tải…</p>;

  return (
    <PrintFrame>
      <PrintToolbar />
      <h1 className="doc-title">TEM LÔ HÀNG</h1>
      <div className="doc-code">Từ phiếu nhập {data.code} · {data.warehouse.name}</div>
      <div className="label-grid">
        {data.items.map((it) => (
          <div className="label" key={it.id}>
            <div className="name">{it.product.name}</div>
            <div className="row">
              <span className="sku">{it.product.sku}</span>
              <span>SL: {formatNumber(it.quantity)} {it.product.uom}</span>
            </div>
            <div className="row">
              <span>Lô: <b>{it.batchCode ?? "—"}</b></span>
              <span>NSX: {it.mfgDate ? formatDate(it.mfgDate) : "—"}</span>
            </div>
            <div className="row">
              <span>HSD: <b>{it.expiryDate ? formatDate(it.expiryDate) : "—"}</b></span>
              <span>{data.warehouse.name}</span>
            </div>
          </div>
        ))}
      </div>
    </PrintFrame>
  );
}
