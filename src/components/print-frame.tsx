"use client";
import { Printer, X } from "lucide-react";

/** Thanh công cụ (ẩn khi in) — nút In và Đóng. */
export function PrintToolbar() {
  return (
    <div className="no-print print-toolbar">
      <button onClick={() => window.print()} className="pt-btn pt-primary">
        <Printer size={16} /> In
      </button>
      <button onClick={() => window.close()} className="pt-btn">
        <X size={16} /> Đóng
      </button>
    </div>
  );
}

/** Khung trang in A4 + style dùng chung cho phiếu và tem. */
export function PrintFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="print-sheet">
      {children}
      <style jsx global>{`
        body { background: #f1f5f9; }
        .print-sheet {
          max-width: 780px;
          margin: 16px auto;
          background: #fff;
          padding: 28px 32px;
          color: #0f172a;
          font-size: 13px;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
        }
        .print-toolbar {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-bottom: 16px;
        }
        .pt-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #cbd5e1;
          background: #fff;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 13px;
          cursor: pointer;
        }
        .pt-primary { background: #0f766e; color: #fff; border-color: #0f766e; }
        .doc-title { text-align: center; font-size: 20px; font-weight: 700; margin: 4px 0; }
        .doc-code { text-align: center; color: #475569; margin-bottom: 16px; }
        .doc-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 24px;
          margin-bottom: 16px;
        }
        .doc-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .doc-table th, .doc-table td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          text-align: left;
        }
        .doc-table th { background: #f1f5f9; font-weight: 600; }
        .doc-table .r { text-align: right; }
        .doc-note { margin: 8px 0; }
        .doc-sign {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 32px;
          text-align: center;
          font-weight: 600;
        }
        .doc-sign > div::after {
          content: "";
          display: block;
          height: 56px;
        }
        /* Tem nhãn */
        .label-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .label {
          border: 1px dashed #94a3b8;
          border-radius: 6px;
          padding: 10px 12px;
        }
        .label .name { font-weight: 700; font-size: 14px; }
        .label .row { display: flex; justify-content: space-between; margin-top: 4px; color: #334155; }
        .label .sku { font-family: ui-monospace, monospace; }
        @media print {
          body { background: #fff; }
          .print-sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; }
          .no-print { display: none !important; }
          .label { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
