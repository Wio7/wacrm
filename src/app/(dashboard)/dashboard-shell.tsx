"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PresenceHeartbeat } from "@/components/presence/presence-heartbeat";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading, isAccountInactive, signOut } = useAuth();
  const router = useRouter();

  // Sidebar drawer state — only used on mobile. On lg+ the sidebar is
  // always visible and this stays at `false` (ignored by the component).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar skeleton outline */}
        <aside className="hidden h-full w-60 flex-col border-r border-border bg-card/60 p-4 lg:flex">
          {/* Logo outline */}
          <div className="flex h-10 items-center gap-2.5 pb-4 border-b border-border">
            <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
          {/* Nav groups outline */}
          <div className="mt-4 flex-1 space-y-6">
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
              <div className="h-8 w-full animate-pulse rounded-lg bg-muted/60" />
              <div className="h-8 w-full animate-pulse rounded-lg bg-muted/40" />
              <div className="h-8 w-full animate-pulse rounded-lg bg-muted/40" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-14 animate-pulse rounded bg-muted/50" />
              <div className="h-8 w-full animate-pulse rounded-lg bg-muted/40" />
              <div className="h-8 w-full animate-pulse rounded-lg bg-muted/40" />
              <div className="h-8 w-full animate-pulse rounded-lg bg-muted/40" />
            </div>
          </div>
          {/* User footer outline */}
          <div className="flex items-center gap-3 border-t border-border pt-3">
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-28 animate-pulse rounded bg-muted/60" />
            </div>
          </div>
        </aside>

        {/* Content area skeleton outline */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header outline */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-muted/60" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-8 w-28 animate-pulse rounded-xl bg-muted/60" />
            </div>
          </header>

          {/* Main content loader */}
          <main className="flex flex-1 flex-col items-center justify-center p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute -inset-2 animate-ping rounded-full bg-primary/20" />
                <div className="relative flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-sm">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Cargando Wio CRM...</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Sincronizando datos de tu cuenta</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (isAccountInactive) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-background px-4 text-foreground">
        {/* Background Mesh Gradients */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
          <div className="absolute -top-[20%] -left-[10%] h-[60%] w-[60%] rounded-full bg-rose-500/15 blur-[140px]" />
          <div className="absolute -bottom-[20%] -right-[10%] h-[60%] w-[60%] rounded-full bg-primary/15 blur-[140px]" />
        </div>
        <div className="relative z-10 w-full max-w-md space-y-6 rounded-3xl border border-border/80 bg-card/90 p-8 text-center shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-300 sm:p-10">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-3xl bg-rose-500/20" />
            <div className="relative flex size-20 items-center justify-center rounded-3xl border border-rose-500/30 bg-rose-500/10 text-rose-500 shadow-inner">
              <Lock className="h-9 w-9 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase">Cuenta Inactiva</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tu cuenta de Wio CRM está actualmente inactiva o suspendida. Por favor, ponte en contacto con el soporte o el administrador principal para reactivarla.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => signOut()}
              variant="outline"
              className="h-11 w-full rounded-xl border-border bg-muted/50 font-semibold tracking-wide text-foreground transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
            >
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Reports this tab's online/away presence once we know a user is
          signed in. Headless — renders nothing. */}
      <PresenceHeartbeat />
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        {/* Thinner horizontal padding on mobile so cards have room to breathe. */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 animate-in fade-in-0 duration-200">{children}</main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
