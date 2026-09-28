// ============================================================
// /api/client/code/verify — entrar con el código que llegó por WhatsApp
//
//   POST { phone, code, dni, name? } → { ok, token, expires_at, client }
//
// Público. Si el código es el último pedido para ese celular, no venció y
// no se usó, el DNI queda en la ficha que ya existía y se abre la sesión
// sobre ella: misma conversación, mismo asesor. 5 intentos fallidos anulan
// el código; los candados por celular e IP son los mismos del ingreso.
// ============================================================

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/flows/admin-client";
import { corsPreflight, withCors } from "@/lib/cors";
import { clientIp } from "@/lib/client-portal/http";
import { entrarConCodigo } from "@/lib/client-portal/acceso-codigo";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const STATUS: Record<string, number> = {
  invalid_input: 400,
  codigo_incorrecto: 401,
  codigo_vencido: 410,
  dni_en_uso: 409,
  ya_existe: 409,
  no_match: 401,
  locked: 429,
  sin_cuenta: 503,
  server_error: 500,
};

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  const rafaga = checkRateLimit(`client-code-verify:${clientIp(request)}`, {
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!rafaga.success) return withCors(request, rateLimitResponse(rafaga));

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const texto = (v: unknown) => (typeof v === "string" ? v : "");

  const result = await entrarConCodigo(supabaseAdmin(), {
    phone: texto(body?.phone),
    code: texto(body?.code),
    dni: texto(body?.dni),
    name: texto(body?.name),
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  if (result.ok) return withCors(request, NextResponse.json(result));
  const response = NextResponse.json(result, { status: STATUS[result.reason] ?? 400 });
  if (result.reason === "locked") {
    response.headers.set("Retry-After", String(result.retry_after_seconds));
  }
  return withCors(request, response);
}
