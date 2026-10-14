"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  Bell,
  Bot,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PhoneCall,
  PhoneIncoming,
  Radio,
  Scale,
  Settings as SettingsIcon,
  Shield,
  Ticket,
  User,
  Users,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/layout/mode-toggle";

interface PageMeta {
  title: string;
  section?: string;
  icon: typeof LayoutDashboard;
}

const pageMetaMap: Record<string, PageMeta> = {
  "/dashboard": { title: "Panel Principal", section: "Principal", icon: LayoutDashboard },
  "/inbox": { title: "Bandeja de Entrada", section: "Principal", icon: MessageSquare },
  "/notifications": { title: "Notificaciones", section: "Principal", icon: Bell },
  "/calendar": { title: "Calendario", section: "Principal", icon: CalendarDays },
  "/contacts": { title: "Contactos", section: "Ventas", icon: Users },
  "/pipelines": { title: "Embudos de Venta", section: "Ventas", icon: GitBranch },
  "/projects": { title: "Proyectos Inmobiliarios", section: "Ventas", icon: Building2 },
  "/reservations": { title: "Centro de Separaciones", section: "Ventas", icon: CalendarCheck },
  "/payment-plans": { title: "Cuotas y Cobranzas", section: "Ventas", icon: Wallet },
  "/coupons": { title: "Cupones y Referidos", section: "Ventas", icon: Ticket },
  "/dialer": { title: "Marcador", section: "Ventas", icon: PhoneCall },
  "/calls": { title: "Llamadas", section: "Ventas", icon: PhoneIncoming },
  "/broadcasts": { title: "Difusiones", section: "Marketing", icon: Radio },
  "/automations": { title: "Automatizaciones", section: "Automatización", icon: Zap },
  "/flows": { title: "Flujos", section: "Automatización", icon: Workflow },
  "/agents": { title: "Agentes IA", section: "Automatización", icon: Bot },
  "/jurisprudencia": { title: "Jurisprudencia", section: "Administración", icon: Scale },
  "/saas-owner": { title: "Administración SaaS", section: "Administración", icon: Shield },
  "/settings": { title: "Configuración", icon: SettingsIcon },
};

function getPageMeta(pathname: string): PageMeta {
  if (pageMetaMap[pathname]) return pageMetaMap[pathname];
  const match = Object.entries(pageMetaMap).find(([path]) =>
    pathname.startsWith(path),
  );
  return match ? match[1] : { title: "Dashboard", icon: LayoutDashboard };
}

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const meta = getPageMeta(pathname);
  const PageIcon = meta.icon;

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 shadow-xs backdrop-blur-md lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        {/* Hamburger — mobile only. 44×44 hit target per Apple HIG. */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Abrir menú de navegación"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb-style page title with icon */}
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-foreground/80 shadow-2xs">
            <PageIcon className="size-4 text-primary" />
          </div>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm">
            {meta.section && (
              <>
                <span className="hidden font-medium text-muted-foreground/70 md:inline">
                  {meta.section}
                </span>
                <ChevronRight className="hidden size-3.5 text-muted-foreground/40 md:inline" />
              </>
            )}
            <h1 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
              {meta.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <ModeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="group flex min-h-[44px] items-center gap-2 rounded-xl border border-transparent p-1 transition-all duration-200 hover:border-border/60 hover:bg-muted/70 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 data-popup-open:border-border/60 data-popup-open:bg-muted/70 sm:gap-2.5 sm:px-2"
            aria-label="Abrir menú de cuenta"
          >
            <Avatar className="size-8 ring-1 ring-border/60 transition-transform duration-200 group-hover:scale-105">
              {profile?.avatar_url ? (
                <AvatarImage
                  src={profile.avatar_url}
                  alt={profile.full_name ?? "Avatar"}
                />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[130px] truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary sm:inline">
              {profile?.full_name ?? "Usuario"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-56 bg-popover text-popover-foreground ring-border"
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {profile?.full_name ?? "Usuario"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.email ?? ""}
              </p>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              render={
                <Link
                  href="/settings?tab=profile"
                  className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                />
              }
            >
              <User className="size-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href="/settings?tab=whatsapp"
                  className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                />
              }
            >
              <SettingsIcon className="size-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={signOut}
              className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
            >
              <LogOut className="size-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
