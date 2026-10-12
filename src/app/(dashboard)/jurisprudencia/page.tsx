"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Scale } from "lucide-react";

import { ColaResoluciones } from "@/components/jurisprudencia/cola-resoluciones";
import { EditorTemas } from "@/components/jurisprudencia/editor-temas";
import { useAdminWio } from "@/components/jurisprudencia/use-admin-wio";

const PESTANAS = [
  { id: "resoluciones", nombre: "Resoluciones" },
  { id: "temas", nombre: "Temas" },
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
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Scale className="size-5 text-primary" />
          Jurisprudencia
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube resoluciones, revisa la ficha que arma la IA contra el PDF y publícalas. Solo lo
          publicado llega a la app.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPestana(p.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              pestana === p.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {pestana === "resoluciones" ? <ColaResoluciones /> : <EditorTemas />}
    </div>
  );
}
