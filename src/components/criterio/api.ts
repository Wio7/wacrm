'use client';

// Llamadas de la app a /api/juris/*. La sesión va en la cookie de
// Supabase, así que basta con fetch del mismo origen.

export interface Resumen {
  id: string;
  tipo: string | null;
  numero: string | null;
  anio: number | null;
  procedencia: string | null;
  sala: string | null;
  fecha: string | null;
  sumilla: string | null;
  criterio: string | null;
  articulos: string[];
  fallo: string | null;
}

export class ErrorApi extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/juris/${ruta}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const datos = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = '/criterio/entrar';
    throw new ErrorApi('Tu sesión terminó.', 401);
  }
  if (!res.ok) {
    throw new ErrorApi(
      (datos as { error?: string }).error ?? 'Algo falló. Intenta de nuevo.',
      res.status
    );
  }
  return datos as T;
}

const TIPOS: Record<string, string> = {
  casacion: 'Casación',
  pleno_casatorio: 'Pleno Casatorio',
  precedente_vinculante: 'Precedente Vinculante',
  acuerdo_plenario: 'Acuerdo Plenario',
};

export function titulo(r: Resumen): string {
  const tipo = r.tipo ? (TIPOS[r.tipo] ?? r.tipo) : 'Resolución';
  return r.numero ? `${tipo} N.° ${r.numero}` : tipo;
}
