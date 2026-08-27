import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sophia Wellness — Quản lý kho",
  description:
    "Hệ thống quản lý kho Sophia Wellness: nhập/xuất kho, tồn theo lô & hạn sử dụng, cảnh báo tồn kho",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
