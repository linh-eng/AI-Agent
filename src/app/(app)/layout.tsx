import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { getBrand } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const brand = await getBrand();
  return (
    <AppShell session={session} brand={{ name: brand.name, logoDataUrl: brand.logoDataUrl }}>
      {children}
    </AppShell>
  );
}
