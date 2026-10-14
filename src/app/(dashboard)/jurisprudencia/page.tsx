"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, FolderTree, Loader2, Scale, Sparkles } from "lucide-react";

import { ColaResoluciones } from "@/components/jurisprudencia/cola-resoluciones";
import { EditorTemas } from "@/components/jurisprudencia/editor-temas";
import { useAdminWio } from "@/components/jurisprudencia/use-admin-wio";
import { cn } from "@/lib/utils";

const PESTANAS = [
  { id: "resoluciones", nombre: "Resoluciones y Cola", icon: FileText },
  { id: "temas", nombre: "Árbol de Materias", icon: FolderTree },
] as const;

export default function JurisprudenciaPage() {
  const esAdmin = useAdminWio();
  const router = useRouter();
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]["id"]>("resoluciones");

  useEffect(() => {
    if (esAdmin === false) router.push("/dashboard");
  }, [esAdmin, router]);

  if (!esAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Verificando permisos de administrador...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Icon and Description Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-5 shadow-xs backdrop-blur-xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-xs">
              <Scale className="size-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Jurisprudencia
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="size-3" />
                  Módulo IA
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Sube resoluciones judiciales en formato PDF, valida la ficha extraída por la IA cotejándola con el texto original y publícalas en el catálogo de Criterio.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pill-style tabs */}
      <div className="flex items-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {PESTANAS.map((p) => {
            const Icon = p.icon;
            const isActive = pestana === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPestana(p.id)}
                className={cn(
                  "flex min-h-[38px] items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  isActive
                    ? "bg-card text-foreground shadow-xs ring-1 ring-border"
                    : "text-muted-foreground hover:bg-card/40 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} />
                <span>{p.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="animate-in fade-in-0 duration-200">
        {pestana === "resoluciones" ? <ColaResoluciones /> : <EditorTemas />}
      </div>
    </div>
  );
}
