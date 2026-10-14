"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  MessageSquare,
  Users,
  Scale,
  Bot,
  Zap,
  CalendarDays,
  Settings,
  Moon,
  Sun,
  FileText,
  Sparkles,
  Bookmark,
  Building2,
  PhoneCall,
  GitBranch,
  X,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Navegación" | "Jurisprudencia (Criterio)" | "Acciones y Apariencia";
  icon: typeof LayoutDashboard;
  badge?: string;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { mode, setMode } = useTheme();

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const execute = useCallback((action: () => void) => {
    setOpen(false);
    setSearch("");
    action();
  }, []);

  const items: CommandItem[] = useMemo(
    () => [
      // Jurisprudencia & Criterio
      {
        id: "criterio-app",
        title: "Criterio - Búsqueda de Jurisprudencia",
        subtitle: "Buscador móvil/web con sumillas y fichas legales",
        category: "Jurisprudencia (Criterio)",
        icon: Scale,
        badge: "PWA Legal",
        action: () => router.push("/criterio"),
      },
      {
        id: "criterio-asistente",
        title: "Criterio - Asistente Jurídico IA",
        subtitle: "Consultas en lenguaje natural con citas jurisprudenciales",
        category: "Jurisprudencia (Criterio)",
        icon: Sparkles,
        badge: "IA",
        action: () => router.push("/criterio/asistente"),
      },
      {
        id: "criterio-guardados",
        title: "Criterio - Resoluciones Guardadas",
        subtitle: "Tu biblioteca personal de casaciones y precedentes",
        category: "Jurisprudencia (Criterio)",
        icon: Bookmark,
        action: () => router.push("/criterio/guardados"),
      },
      {
        id: "juris-admin",
        title: "Administración de Jurisprudencia",
        subtitle: "Cola de resoluciones, extracción IA de PDFs y temas",
        category: "Jurisprudencia (Criterio)",
        icon: FileText,
        badge: "Admin",
        action: () => router.push("/jurisprudencia"),
      },

      // Dashboard & CRM
      {
        id: "nav-dashboard",
        title: "Panel Principal",
        subtitle: "Métricas en vivo, KPIs y gráficos de rendimiento",
        category: "Navegación",
        icon: LayoutDashboard,
        action: () => router.push("/dashboard"),
      },
      {
        id: "nav-inbox",
        title: "Bandeja de Entrada",
        subtitle: "Chats en tiempo real de WhatsApp y clientes",
        category: "Navegación",
        icon: MessageSquare,
        action: () => router.push("/inbox"),
      },
      {
        id: "nav-contacts",
        title: "Contactos y Clientes",
        subtitle: "Directorio unificado, etiquetas y campos personalizados",
        category: "Navegación",
        icon: Users,
        action: () => router.push("/contacts"),
      },
      {
        id: "nav-pipelines",
        title: "Embudos de Venta",
        subtitle: "Tablero kanban y valor proyectado de tratos",
        category: "Navegación",
        icon: GitBranch,
        action: () => router.push("/pipelines"),
      },
      {
        id: "nav-projects",
        title: "Proyectos y Catálogo",
        subtitle: "Unidades disponibles, reservadas y vendidas",
        category: "Navegación",
        icon: Building2,
        action: () => router.push("/projects"),
      },
      {
        id: "nav-calendar",
        title: "Calendario de Citas",
        subtitle: "Agenda comercial y eventos programados",
        category: "Navegación",
        icon: CalendarDays,
        action: () => router.push("/calendar"),
      },
      {
        id: "nav-dialer",
        title: "Marcador Telefónico",
        subtitle: "Llamadas de voz y sesiones de contacto",
        category: "Navegación",
        icon: PhoneCall,
        action: () => router.push("/dialer"),
      },
      {
        id: "nav-automations",
        title: "Automatizaciones y Flujos",
        subtitle: "Disparadores automáticos, embudos y tareas",
        category: "Navegación",
        icon: Zap,
        action: () => router.push("/automations"),
      },
      {
        id: "nav-agents",
        title: "Agentes IA de Respuesta",
        subtitle: "Configuración de modelos de IA y respuestas inteligentes",
        category: "Navegación",
        icon: Bot,
        action: () => router.push("/agents"),
      },
      {
        id: "nav-settings",
        title: "Configuración General",
        subtitle: "Cuenta, equipo, perfiles y WhatsApp API",
        category: "Navegación",
        icon: Settings,
        action: () => router.push("/settings"),
      },

      // Actions & Theme
      {
        id: "toggle-theme",
        title: mode === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro",
        subtitle: "Alterna la apariencia visual del sistema",
        category: "Acciones y Apariencia",
        icon: mode === "dark" ? Sun : Moon,
        badge: mode === "dark" ? "Luz" : "Noche",
        action: () => setMode(mode === "dark" ? "light" : "dark"),
      },
    ],
    [router, mode, setMode]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  const categories = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        type="button"
        aria-label="Abrir buscador global (Ctrl+K)"
        className="group relative hidden sm:flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground shadow-xs transition-all hover:border-primary/40 hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-98"
      >
        <Search className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
        <span className="font-medium">Buscar o comando…</span>
        <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/80 bg-card px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-xs">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de Comandos Global"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 backdrop-blur-md bg-black/50 animate-in fade-in-0 duration-150"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/5 duration-150 animate-in zoom-in-95"
      >
        {/* Search header */}
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5 bg-card/60 backdrop-blur-sm">
          <Search className="size-5 shrink-0 text-primary" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Escribe para buscar resolución, módulo o acción..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 select-none items-center rounded border border-border/70 bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results container */}
        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
          {categories.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Search className="mx-auto mb-2 size-8 text-muted-foreground/40" />
              <p>No se encontraron resultados para &ldquo;{search}&rdquo;</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Prueba buscando por &ldquo;casación&rdquo;, &ldquo;contactos&rdquo; o &ldquo;tema&rdquo;.
              </p>
            </div>
          ) : (
            categories.map(([category, items]) => (
              <div key={category} className="mb-3">
                <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                  {category}
                </div>
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => execute(item.action)}
                        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99]"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground group-hover:border-primary/30 group-hover:bg-primary/20 group-hover:text-primary">
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-foreground group-hover:text-primary">
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="truncate text-xs text-muted-foreground group-hover:text-primary/70">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        {item.badge && (
                          <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                            {item.badge}
                          </span>
                        )}
                        <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100 text-primary" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/40 px-4 py-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Navega con flechas o ratón</span>
            <span>•</span>
            <span><kbd className="rounded bg-card px-1 border border-border">Enter</kbd> para abrir</span>
          </div>
          <span className="font-semibold text-primary/80">Wio CRM + Criterio</span>
        </div>
      </div>
    </div>
  );
}
