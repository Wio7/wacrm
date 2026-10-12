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
