'use client';

import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * ¿Es el admin de Wio? Se le pregunta a la base (`is_super_admin`), que
 * es la misma respuesta que usan las políticas RLS: si el panel dijera
 * que sí y la base que no, las pantallas saldrían vacías sin explicación.
 *
 * `null` mientras no se sabe.
 */
export function useAdminWio(): boolean | null {
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let vigente = true;
    createClient()
      .rpc('is_super_admin')
      .then(({ data, error }) => {
        if (vigente) setEsAdmin(!error && data === true);
      });
    return () => {
      vigente = false;
    };
  }, []);

  return esAdmin;
}
