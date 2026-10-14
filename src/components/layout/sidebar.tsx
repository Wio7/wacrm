"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import { Ticket,
  Bell,
  Bot,
  Building2,
  CalendarCheck,
  CalendarDays,
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PhoneCall,
  PhoneIncoming,
  Radio,
  Scale,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { AccountRole } from "@/lib/auth/roles";

// Per-role chip metadata used in the sidebar's account strip + the
// Members tab roster. Keeping this near both consumers in a single
// place avoids drift between the two surfaces — when a designer
// wants to recolour "agent" rows, this is the one diff.
const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; label: string; className: string }
> = {
  owner: {
    icon: Crown,
    label: "Propietario",
    // Amber: scarce, immutable, "the boss" — gets visual emphasis.
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  admin: {
    icon: Shield,
    label: "Administrador",
    // Primary-tinted: significant but not as scarce as owner.
    className:
      "border-primary/40 bg-primary/10 text-primary",
  },
  agent: {
    icon: UserCog,
    label: "Agente",
    // Neutral slate: the operational default.
    className:
      "border-border bg-muted text-foreground",
  },
  viewer: {
    icon: User,
    label: "Espectador",
    // Muted slate: read-only role; visually quieter than agent.
    className:
      "border-border bg-card text-muted-foreground",
  },
};
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

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /**
   * When true, the nav row renders a small "Beta" chip after the label.
   * Purely informational — doesn't affect routing or access.
   */
  beta?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Principal",
    items: [
      { href: "/dashboard", label: "Panel Principal", icon: LayoutDashboard },
      { href: "/inbox", label: "Bandeja de Entrada", icon: MessageSquare },
      { href: "/notifications", label: "Notificaciones", icon: Bell },
      { href: "/calendar", label: "Calendario", icon: CalendarDays },
    ],
  },
  {
    title: "Ventas",
    items: [
      { href: "/contacts", label: "Contactos", icon: Users },
      { href: "/pipelines", label: "Embudos de Venta", icon: GitBranch },
      { href: "/projects", label: "Proyectos", icon: Building2 },
      { href: "/reservations", label: "Separaciones", icon: CalendarCheck },
      { href: "/payment-plans", label: "Cuotas", icon: Wallet },
      { href: "/coupons", label: "Cupones y referidos", icon: Ticket },
      { href: "/dialer", label: "Marcador", icon: PhoneCall },
      { href: "/calls", label: "Llamadas", icon: PhoneIncoming },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/broadcasts", label: "Difusiones", icon: Radio },
    ],
  },
  {
    title: "Automatización",
    items: [
      { href: "/automations", label: "Automatizaciones", icon: Zap },
      { href: "/flows", label: "Flujos", icon: Workflow, beta: true },
      { href: "/agents", label: "Agentes IA", icon: Bot },
    ],
  },
];

const bottomNavItems = [
  { href: "/settings", label: "Configuración", icon: Settings },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, profileLoading, account, accountRole, signOut, isSuperAdmin } = useAuth();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();
  // Only surface the account-name strip when it actually carries
  // information. A solo user's personal account is named after them
  // (the 017 signup trigger seeds it from `full_name`), so showing it
  // here would just duplicate the user name in the footer below. Once
  // the account is renamed or the user joins a shared account, the
  // name diverges and the strip becomes meaningful — that's the signal
  // we gate on. Wait for the profile fetch to settle first, otherwise
  // the strip flashes in once the row resolves (a layout jump).
  const showAccountStrip =
    !profileLoading &&
    !!account?.name &&
    account.name !== profile?.full_name;

  // Close the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onClose?.();
    // Only pathname drives this — onClose identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the drawer is open on
  // mobile. No-ops on desktop because the sidebar isn't positioned there.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop — only exists on mobile and only when open. Clicking
          it closes the drawer. Hidden from lg+ since the sidebar is
          part of the main flex row there. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          // Mobile: fixed drawer that slides in from the left.
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-border bg-card",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: static, always visible — reset all the mobile framing.
          "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none",
        )}
        aria-label="Primary"
      >
        {/* Logo row. On mobile we put a close button here; on desktop the
            close button is hidden since the sidebar is always-visible. */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2.5 rounded-lg p-1 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute -inset-1 rounded-lg bg-primary/20 opacity-0 blur-xs transition-all duration-300 group-hover:opacity-100 group-hover:scale-110" />
              <img
                src="/logo.png"
                alt="Wio CRM"
                className="relative h-8 w-auto object-contain rounded-md transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
              Wio CRM
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main navigation with section grouping */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5 [scrollbar-width:thin]">
          {(isSuperAdmin
            ? [
                ...navSections,
                {
                  title: "Administración",
                  items: [
                    { href: "/jurisprudencia", label: "Jurisprudencia", icon: Scale },
                    { href: "/saas-owner", label: "Administración SaaS", icon: Shield },
                  ],
                },
              ]
            : navSections
          ).map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                {section.title}
              </div>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  const showUnreadDot =
                    item.href === "/inbox" && totalUnread > 0 && !isActive;

                  const showNotificationBadge =
                    item.href === "/notifications" && unreadNotifications > 0;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-out",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                          isActive
                            ? "bg-primary/10 text-primary font-semibold shadow-xs"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:translate-x-0.5",
                        )}
                      >
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary"
                          />
                        )}
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.beta && (
                          <span
                            aria-label="Función Beta"
                            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300"
                          >
                            Beta
                          </span>
                        )}
                        {showUnreadDot && (
                          <span
                            aria-label={`${totalUnread} conversaciones no leídas`}
                            className="relative flex h-2 w-2"
                          >
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
                        )}
                        {showNotificationBadge && (
                          <span
                            aria-label={`${unreadNotifications} notificaciones no leídas`}
                            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-xs"
                          >
                            {unreadNotifications > 9 ? "9+" : unreadNotifications}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="pt-2 border-t border-border">
            <ul className="flex flex-col gap-0.5">
              {bottomNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-out",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:translate-x-0.5",
                      )}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary"
                        />
                      )}
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-border bg-card/60 p-3">
          {/* Account name display — surfaced only when the account
              name differs from the user's own name (see
              `showAccountStrip`). For a default solo account the two
              match, so we hide it to avoid duplicating the user name
              below; for renamed or shared accounts it tells the user
              which account they're acting in. */}
          {showAccountStrip && account?.name ? (
            <div className="mb-2.5 flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
              <UsersRound className="size-3.5 shrink-0" />
              {/* `title=` exposes the full name on hover when it
                  gets truncated (long account names + narrow
                  sidebars). Cheap a11y win. */}
              <span className="truncate font-medium" title={account.name}>
                {account.name}
              </span>
              {accountRole ? (
                // Always render the chip — owners used to be
                // invisible here, which made them indistinguishable
                // from admins at a glance. Now everyone sees their
                // role (with a colour cue) regardless of tier.
                (() => {
                  const meta = ROLE_CHIP[accountRole];
                  const Icon = meta.icon;
                  return (
                    <span
                      className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.className}`}
                    >
                      <Icon className="size-3" />
                      {meta.label}
                    </span>
                  );
                })()
              ) : null}
            </div>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Menú de usuario"
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-200 hover:bg-muted/70 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 data-popup-open:bg-muted/70"
            >
              <Avatar className="size-9 shrink-0 ring-1 ring-border/60">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "Avatar"}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {profile?.full_name ?? "Usuario"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile?.email ?? ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56 bg-popover text-popover-foreground ring-border"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
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
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <Settings className="size-4" />
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
      </aside>
    </>
  );
}
