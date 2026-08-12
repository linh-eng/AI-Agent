import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_BRAND_NAME || "Sophia Wellness"} — Quản lý khách hàng`,
  description: "Phần mềm quản lý spa/thẩm mỹ: Khách hàng, Booking, Phác đồ, Vật tư, CSKH",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
