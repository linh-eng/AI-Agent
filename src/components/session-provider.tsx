"use client";
import { createContext, useContext } from "react";
import type { SessionPayload } from "@/lib/auth";
import type { PermissionCode } from "@/lib/rbac";

const SessionContext = createContext<SessionPayload | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionPayload {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession phải dùng trong SessionProvider");
  return ctx;
}

export function useCan(permission: PermissionCode): boolean {
  const session = useContext(SessionContext);
  return !!session?.permissions.includes(permission);
}
