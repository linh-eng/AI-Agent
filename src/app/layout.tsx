import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THNG — Quản lý kho",
  description: "Hệ thống quản lý kho THNG: Nhập/Xuất/Lắp ráp/Tháo dỡ/Truy vết Serial",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
