// ============================================================
// Quién puede qué en el módulo de jurisprudencia (lado servidor).
//
// El catálogo sólo lo toca el admin de Wio. Quién es el admin de Wio lo
// decide la base (`is_super_admin`, migración 031), que es también lo
// que miran las políticas RLS: se le pregunta a ella en vez de repetir
// el criterio aquí y arriesgarse a que el panel y la base no coincidan.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { ForbiddenError, UnauthorizedError } from '@/lib/auth/account';
import { getIncomingRequestAuth } from '@/lib/supabase/request-auth';

export interface ContextoAdmin {
  /** Cliente con la sesión del admin: RLS aplica. */
  supabase: SupabaseClient;
  userId: string;
}

export async function requireAdminWio(): Promise<ContextoAdmin> {
  const { supabase, user } = await getIncomingRequestAuth();
  if (!user) throw new UnauthorizedError();

  const { data, error } = await supabase.rpc('is_super_admin');
  if (error) {
    console.error('[juris acceso] is_super_admin failed:', error);
    throw new ForbiddenError('No se pudo comprobar el acceso');
  }
  if (data !== true) {
    throw new ForbiddenError('Sólo el administrador de Wio puede hacer esto');
  }
  return { supabase, userId: user.id };
}

export interface ContextoJuris {
  /** Cliente con la sesión de quien llama: RLS aplica. */
  supabase: SupabaseClient;
  userId: string;
  /** La cuenta, si tiene el módulo encendido. El admin de Wio entra sin
   *  cuenta: puede consultar el catálogo, pero no tiene favoritos,
   *  carpetas ni alertas propios. */
  accountId: string | null;
}

/**
 * Quien usa la app: alguien de una cuenta con el módulo 'jurisprudencia'
 * encendido (el rol dentro de la cuenta no importa), o el admin de Wio.
 * La sesión llega por cookie o por `Authorization: Bearer` — que es como
 * la manda la app móvil.
 */
export async function requireJuris(): Promise<ContextoJuris> {
  const { supabase, user } = await getIncomingRequestAuth();
  if (!user) throw new UnauthorizedError();

  const cuenta = await supabase.rpc('account_with_module', {
    p_module: 'jurisprudencia',
  });
  if (cuenta.error) {
    console.error('[juris acceso] account_with_module failed:', cuenta.error);
    throw new ForbiddenError('No se pudo comprobar el acceso');
  }
  if (typeof cuenta.data === 'string') {
    return { supabase, userId: user.id, accountId: cuenta.data };
  }

  const admin = await supabase.rpc('is_super_admin');
  if (admin.data === true) {
    return { supabase, userId: user.id, accountId: null };
  }
  throw new ForbiddenError('Tu cuenta no tiene el módulo de Jurisprudencia');
}

/** Para lo que es de cada usuario (favoritos, carpetas, alertas). */
export function cuentaDe(ctx: ContextoJuris): string {
  if (!ctx.accountId) {
    throw new ForbiddenError(
      'Esto es de cada cuenta con el módulo; el administrador no tiene datos propios aquí'
    );
  }
  return ctx.accountId;
}
