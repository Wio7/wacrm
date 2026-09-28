// ============================================================
// /api/client/code — pedir un código de acceso por WhatsApp
//
//   POST { phone } → { ok, phone_hint, expires_in_seconds }
//
// Público. Para el contacto que ya está en el CRM sin DNI (el registro le
// respondió `ya_existe_sin_dni`): se le manda un código de 6 dígitos a su
// WhatsApp y con él entra por /api/client/code/verify. Ver
// src/lib/client-portal/acceso-codigo.ts.
// ============================================================

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/flows/admin-client";
import { corsPreflight, withCors } from "@/lib/cors";
import { clientIp } from "@/lib/client-portal/http";
import { pedirCodigoDeAcceso } from "@/lib/client-portal/acceso-codigo";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const STATUS: Record<string, number> = {
  invalid_input: 400,
  no_existe: 404,
  ya_existe: 409,
  fuera_de_ventana: 409,
  locked: 429,
  espera: 429,
  sin_cuenta: 503,
  server_error: 500,
};

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  const rafaga = checkRateLimit(`client-code:${clientIp(request)}`, {
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!rafaga.success) return withCors(request, rateLimitResponse(rafaga));

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const result = await pedirCodigoDeAcceso(supabaseAdmin(), {
    phone: typeof body?.phone === "string" ? body.phone : "",
    ip: clientIp(request),
  });

  if (result.ok) return withCors(request, NextResponse.json(result));
  const response = NextResponse.json(result, { status: STATUS[result.reason] ?? 400 });
  if ("retry_after_seconds" in result) {
    response.headers.set("Retry-After", String(result.retry_after_seconds));
  }
  return withCors(request, response);
}
