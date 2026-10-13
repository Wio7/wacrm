import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Las migraciones de verdad (066–071) contra un Postgres desechable
// (WASM). De lo que ya existía sólo se montan como fixture las tablas de
// identidad; is_super_admin e is_account_member se sacan tal cual de sus
// migraciones, para probar contra lo que corre en producción y no contra
// una copia.
const db = new PGlite({ extensions: { vector } });

const WIO_EMAIL = 'wiocompany7@gmail.com';
const wio = '00000000-0000-0000-0000-000000000001';
const cristian = '00000000-0000-0000-0000-000000000002';
const colega = '00000000-0000-0000-0000-000000000003';
const otroAbogado = '00000000-0000-0000-0000-000000000004';
const golden = '00000000-0000-0000-0000-000000000005';

const cuentaWio = '00000000-0000-0000-0000-000000000011';
const cuentaCristian = '00000000-0000-0000-0000-000000000012';
const cuentaOtro = '00000000-0000-0000-0000-000000000013';
const cuentaGolden = '00000000-0000-0000-0000-000000000014';

const publicada = '00000000-0000-0000-0000-0000000000a1';
const borrador = '00000000-0000-0000-0000-0000000000a2';

const migracion = (archivo: string) =>
  readFileSync(`supabase/migrations/${archivo}`, 'utf8');

/** El `CREATE OR REPLACE FUNCTION …` de una migración, hasta donde cierra. */
function funcion(archivo: string, firma: string, cierre = '$$;') {
  const sql = migracion(archivo);
  const desde = sql.indexOf(`CREATE OR REPLACE FUNCTION ${firma}`);
  const hasta = sql.indexOf(cierre, desde);
  if (desde < 0 || hasta < 0) throw new Error(`${firma} no está en ${archivo}`);
  return sql.slice(desde, hasta + cierre.length);
}

async function como(usuario: string, email = `${usuario}@test.local`) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [
    usuario,
  ]);
  await db.query("SELECT set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: usuario, email }),
  ]);
}
const comoWio = () => como(wio, WIO_EMAIL);

/** Lo que hace el servidor con la service-role: sin RLS. */
async function sistema(sql: string) {
  await db.exec('RESET ROLE');
  try {
    await db.exec(sql);
  } finally {
    await db.exec('SET ROLE authenticated');
  }
}

async function cuenta(sql: string, params: unknown[] = []) {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM (${sql}) q`,
    params
  );
  return r.rows[0].n;
}

async function temaId(slug: string) {
  const r = await db.query<{ id: string }>(
    'SELECT id FROM juris_temas WHERE slug = $1',
    [slug]
  );
  return r.rows[0]?.id;
}

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;

    CREATE TYPE account_role_enum AS ENUM ('owner', 'admin', 'agent', 'viewer');
    CREATE TABLE public.accounts(
      id uuid PRIMARY KEY, name text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      viewers_are_clients boolean NOT NULL DEFAULT false);
    CREATE TABLE public.profiles(
      user_id uuid PRIMARY KEY REFERENCES auth.users(id),
      account_id uuid REFERENCES accounts(id),
      account_role account_role_enum, full_name text, email text);

    ${funcion('001_initial_schema.sql', 'update_updated_at_column()', '$$ LANGUAGE plpgsql;')}
    ${funcion('031_saas_features.sql', 'public.is_super_admin()')}
    ${funcion('041_clients_and_ai_handoff.sql', 'public.is_account_member(')}
  `);

  // Sola, como en producción: el valor nuevo del enum no se puede usar
  // en la misma transacción que lo crea.
  await db.exec(migracion('066_rol_usuario_app.sql'));

  await db.exec(`
    INSERT INTO auth.users VALUES
      ('${wio}'), ('${cristian}'), ('${colega}'), ('${otroAbogado}'), ('${golden}');
    INSERT INTO accounts (id, name) VALUES
      ('${cuentaWio}', 'Wio'), ('${cuentaCristian}', 'Cristian Linares'),
      ('${cuentaOtro}', 'Otro abogado'), ('${cuentaGolden}', 'Golden');
    INSERT INTO profiles VALUES
      ('${wio}', '${cuentaWio}', 'owner', 'Wio', '${WIO_EMAIL}'),
      ('${cristian}', '${cuentaCristian}', 'usuario_app', 'Cristian', 'cristian@test.local'),
      ('${colega}', '${cuentaCristian}', 'usuario_app', 'Colega', 'colega@test.local'),
      ('${otroAbogado}', '${cuentaOtro}', 'usuario_app', 'Otro', 'otro@test.local'),
      ('${golden}', '${cuentaGolden}', 'owner', 'Golden', 'golden@test.local');
  `);

  for (const archivo of [
    '067_account_modules.sql',
    '068_juris_catalogo.sql',
    '069_juris_usuario.sql',
    '070_juris_temas_iniciales.sql',
    '071_juris_ingesta.sql',
    '073_juris_busqueda.sql',
  ]) {
    await db.exec(migracion(archivo));
  }

  // Supabase da estos permisos por defecto a las tablas de `public`; lo
  // que protege los datos es RLS, que es lo que aquí se prueba.
  await db.exec(`
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    INSERT INTO account_modules (account_id, module) VALUES
      ('${cuentaCristian}', 'jurisprudencia'), ('${cuentaOtro}', 'jurisprudencia');
    SET ROLE authenticated;
  `);
}, 60000);

afterAll(async () => {
  await db.close();
});

describe.sequential('jurisprudencia: catálogo', () => {
  it('siembra el árbol de temas, con un subtema por causal de nulidad', async () => {
    await comoWio();
    expect(await cuenta('SELECT 1 FROM juris_temas')).toBe(22);
    expect(
      await cuenta(
        `SELECT 1 FROM juris_temas t JOIN juris_temas p ON p.id = t.parent_id
         WHERE p.slug = 'nulidad-de-acto-juridico'`
      )
    ).toBe(6);
    const r = await db.query<{ padre: string }>(
      `SELECT p.slug AS padre FROM juris_temas t JOIN juris_temas p ON p.id = t.parent_id
       WHERE t.slug = 'nulidad-simulacion-absoluta'`
    );
    expect(r.rows[0].padre).toBe('nulidad-de-acto-juridico');
  });

  it('volver a correr la siembra no duplica ni pisa lo editado a mano', async () => {
    await comoWio();
    await db.query(
      "UPDATE juris_temas SET nombre = 'Daño moral y a la persona' WHERE slug = 'dano-moral'"
    );
    await sistema(migracion('070_juris_temas_iniciales.sql'));
    expect(await cuenta('SELECT 1 FROM juris_temas')).toBe(22);
    expect(
      await cuenta(
        "SELECT 1 FROM juris_temas WHERE nombre = 'Daño moral y a la persona'"
      )
    ).toBe(1);
  });

  it('sólo el admin de Wio carga resoluciones', async () => {
    await comoWio();
    await db.query(
      `INSERT INTO juris_resoluciones
         (id, tipo, numero, anio, procedencia, sala, fecha, sumilla, criterio,
          articulos, fallo, url_fuente, estado, revisado_por, revisado_at, publicada_at)
       VALUES ($1, 'casacion', '1234-2019', 2019, 'Lima', 'Sala Civil Permanente',
          '2020-03-10', 'Nulidad de acto jurídico por simulación absoluta',
          'Hay simulación absoluta cuando las partes no quieren ningún acto.',
          ARRAY['CC art. 219 inc. 5', 'CC art. 190'], 'fundada',
          'https://example.test/cas-1234-2019.pdf', 'publicada', $2, now(), now())`,
      [publicada, wio]
    );
    await db.query(
      `INSERT INTO juris_resoluciones (id, tipo, numero, sumilla, estado)
       VALUES ($1, 'casacion', '999-2021', 'Ficha de la IA sin revisar', 'pendiente_revision')`,
      [borrador]
    );
    const simulacion = await temaId('nulidad-simulacion-absoluta');
    await db.query(
      `INSERT INTO juris_resolucion_temas (resolucion_id, tema_id, principal)
       VALUES ($1, $3, true), ($2, $3, true)`,
      [publicada, borrador, simulacion]
    );
    await db.query(
      `INSERT INTO juris_resolucion_chunks (resolucion_id, chunk_index, content)
       VALUES ($1, 0, 'Las partes simularon una compraventa.'),
              ($2, 0, 'Texto de una resolución sin revisar.')`,
      [publicada, borrador]
    );

    for (const usuario of [cristian, golden]) {
      await como(usuario);
      await expect(
        db.query(
          "INSERT INTO juris_resoluciones (tipo, numero) VALUES ('casacion', '1-2024')"
        )
      ).rejects.toThrow(/row-level security/);
      await expect(
        db.query(
          "INSERT INTO juris_temas (slug, nombre) VALUES ('penal', 'Penal')"
        )
      ).rejects.toThrow(/row-level security/);
    }
  });

  it('no se puede publicar sin revisor ni sin lo mínimo para citar', async () => {
    await comoWio();
    await expect(
      db.query(
        "UPDATE juris_resoluciones SET estado = 'publicada' WHERE id = $1",
        [borrador]
      )
    ).rejects.toThrow(/juris_resoluciones_publicable/);
    // Con todos los datos pero sin que nadie la haya revisado, tampoco.
    await expect(
      db.query(
        `UPDATE juris_resoluciones
            SET estado = 'publicada', sala = 'Sala Civil Transitoria',
                fecha = '2021-05-05', url_fuente = 'https://example.test/x.pdf',
                publicada_at = now()
          WHERE id = $1`,
        [borrador]
      )
    ).rejects.toThrow(/juris_resoluciones_publicable/);
  });

  it('una cuenta con el módulo lee lo publicado y nada más', async () => {
    await como(cristian);
    const r = await db.query<{ id: string }>(
      'SELECT id FROM juris_resoluciones'
    );
    expect(r.rows.map((x) => x.id)).toEqual([publicada]);
    expect(await cuenta('SELECT 1 FROM juris_resolucion_temas')).toBe(1);
    expect(await cuenta('SELECT 1 FROM juris_resolucion_chunks')).toBe(1);
    expect(await cuenta('SELECT 1 FROM juris_temas')).toBe(22);
  });

  it('un usuario_app no edita ni borra resoluciones', async () => {
    await como(cristian);
    const editar = await db.query(
      "UPDATE juris_resoluciones SET criterio = 'otro criterio' WHERE id = $1",
      [publicada]
    );
    expect(editar.affectedRows).toBe(0);
    const borrar = await db.query(
      'DELETE FROM juris_resoluciones WHERE id = $1',
      [publicada]
    );
    expect(borrar.affectedRows).toBe(0);
    const tema = await db.query(
      "UPDATE juris_temas SET nombre = 'x' WHERE slug = 'civil'"
    );
    expect(tema.affectedRows).toBe(0);

    await comoWio();
    expect(await cuenta('SELECT 1 FROM juris_resoluciones')).toBe(2);
  });

  it('una cuenta sin el módulo no ve nada del catálogo', async () => {
    await como(golden);
    for (const tabla of [
      'juris_temas',
      'juris_resoluciones',
      'juris_resolucion_temas',
      'juris_resolucion_chunks',
    ]) {
      expect(await cuenta(`SELECT 1 FROM ${tabla}`)).toBe(0);
    }
  });

  it('la búsqueda en español encuentra por la raíz de la palabra', async () => {
    await como(cristian);
    expect(
      await cuenta(
        "SELECT 1 FROM juris_resoluciones WHERE fts @@ plainto_tsquery('spanish', 'simulaciones absolutas')"
      )
    ).toBe(1);
    expect(
      await cuenta(
        "SELECT 1 FROM juris_resolucion_chunks WHERE fts @@ plainto_tsquery('spanish', 'simulando compraventas')"
      )
    ).toBe(1);
  });
});

describe.sequential(
  'jurisprudencia: aislamiento entre cuentas y usuarios',
  () => {
    let carpeta: string;

    it('cada quien guarda lo suyo', async () => {
      await como(cristian);
      await db.query(
        'INSERT INTO juris_favoritos (account_id, user_id, resolucion_id) VALUES ($1, $2, $3)',
        [cuentaCristian, cristian, publicada]
      );
      const c = await db.query<{ id: string }>(
        `INSERT INTO juris_carpetas (account_id, user_id, nombre, notas)
       VALUES ($1, $2, 'Caso de simulación', 'Revisar el criterio sobre terceros') RETURNING id`,
        [cuentaCristian, cristian]
      );
      carpeta = c.rows[0].id;
      await db.query(
        "INSERT INTO juris_carpeta_resoluciones (carpeta_id, resolucion_id, nota) VALUES ($1, $2, 'Citar el fundamento 8')",
        [carpeta, publicada]
      );
      await db.query(
        `INSERT INTO juris_consultas (account_id, user_id, tipo, pregunta)
       VALUES ($1, $2, 'asistente', '¿Cuándo hay simulación absoluta?')`,
        [cuentaCristian, cristian]
      );
      await db.query(
        'INSERT INTO juris_alertas (account_id, user_id, tema_id) VALUES ($1, $2, $3)',
        [cuentaCristian, cristian, await temaId('nulidad-simulacion-absoluta')]
      );

      for (const tabla of TABLAS_DE_USUARIO) {
        expect(await cuenta(`SELECT 1 FROM ${tabla}`)).toBe(1);
      }
    });

    it.each([
      ['otra cuenta con el módulo', otroAbogado],
      ['otro usuario de la misma cuenta', colega],
      ['una cuenta sin el módulo', golden],
    ])(
      '%s no lee favoritos, carpetas, notas, consultas ni alertas',
      async (_, usuario) => {
        await como(usuario);
        for (const tabla of TABLAS_DE_USUARIO) {
          expect(await cuenta(`SELECT 1 FROM ${tabla}`)).toBe(0);
        }
      }
    );

    it('nadie escribe a nombre de otro ni en la cuenta de otro', async () => {
      await como(otroAbogado);
      // Con mi usuario pero en la cuenta de Cristian.
      await expect(
        db.query(
          'INSERT INTO juris_favoritos (account_id, user_id, resolucion_id) VALUES ($1, $2, $3)',
          [cuentaCristian, otroAbogado, publicada]
        )
      ).rejects.toThrow(/row-level security/);
      // En mi cuenta pero a nombre de Cristian.
      await expect(
        db.query(
          "INSERT INTO juris_carpetas (account_id, user_id, nombre) VALUES ($1, $2, 'ajena')",
          [cuentaOtro, cristian]
        )
      ).rejects.toThrow(/row-level security/);
      await expect(
        db.query(
          "INSERT INTO juris_consultas (account_id, user_id, tipo, pregunta) VALUES ($1, $2, 'busqueda', 'x')",
          [cuentaCristian, cristian]
        )
      ).rejects.toThrow(/row-level security/);
      // Dentro de la carpeta de Cristian.
      await expect(
        db.query(
          'INSERT INTO juris_carpeta_resoluciones (carpeta_id, resolucion_id) VALUES ($1, $2)',
          [carpeta, publicada]
        )
      ).rejects.toThrow(/row-level security/);
    });

    it('nadie edita ni borra lo de otro', async () => {
      for (const usuario of [otroAbogado, colega, golden]) {
        await como(usuario);
        const notas = await db.query(
          "UPDATE juris_carpetas SET notas = 'pisado' WHERE id = $1",
          [carpeta]
        );
        expect(notas.affectedRows).toBe(0);
        for (const tabla of TABLAS_DE_USUARIO) {
          const r = await db.query(`DELETE FROM ${tabla}`);
          expect(r.affectedRows).toBe(0);
        }
      }
      await como(cristian);
      for (const tabla of TABLAS_DE_USUARIO) {
        expect(await cuenta(`SELECT 1 FROM ${tabla}`)).toBe(1);
      }
      expect(
        await cuenta("SELECT 1 FROM juris_carpetas WHERE notas = 'pisado'")
      ).toBe(0);
    });

    it('el registro de consultas no se edita ni se borra, ni por su dueño', async () => {
      await como(cristian);
      const editar = await db.query(
        "UPDATE juris_consultas SET pregunta = 'otra'"
      );
      expect(editar.affectedRows).toBe(0);
      const borrar = await db.query('DELETE FROM juris_consultas');
      expect(borrar.affectedRows).toBe(0);
    });

    it('el admin de Wio ve el uso, no los favoritos ni las notas', async () => {
      await comoWio();
      expect(await cuenta('SELECT 1 FROM juris_consultas')).toBe(1);
      for (const tabla of [
        'juris_favoritos',
        'juris_carpetas',
        'juris_carpeta_resoluciones',
        'juris_alertas',
      ]) {
        expect(await cuenta(`SELECT 1 FROM ${tabla}`)).toBe(0);
      }
    });
  }
);

describe.sequential('jurisprudencia: módulos y rol usuario_app', () => {
  it('una cuenta lee sus módulos y no los de otra, ni los cambia', async () => {
    await como(cristian);
    expect(await cuenta('SELECT 1 FROM account_modules')).toBe(1);
    const apagar = await db.query('UPDATE account_modules SET enabled = false');
    expect(apagar.affectedRows).toBe(0);

    await como(golden);
    expect(await cuenta('SELECT 1 FROM account_modules')).toBe(0);
    await expect(
      db.query(
        "INSERT INTO account_modules (account_id, module) VALUES ($1, 'jurisprudencia')",
        [cuentaGolden]
      )
    ).rejects.toThrow(/row-level security/);
  });

  it('un usuario_app no es miembro de su cuenta para el CRM', async () => {
    await como(cristian);
    const r = await db.query<{ miembro: boolean; modulo: boolean }>(
      `SELECT is_account_member($1) AS miembro,
              account_has_module('jurisprudencia') AS modulo`,
      [cuentaCristian]
    );
    expect(r.rows[0]).toEqual({ miembro: false, modulo: true });
  });

  it('apagar el módulo corta el acceso en el acto, y encenderlo lo devuelve', async () => {
    await comoWio();
    await db.query(
      'UPDATE account_modules SET enabled = false WHERE account_id = $1',
      [cuentaCristian]
    );
    await como(cristian);
    for (const tabla of [
      'juris_resoluciones',
      'juris_temas',
      ...TABLAS_DE_USUARIO,
    ]) {
      expect(await cuenta(`SELECT 1 FROM ${tabla}`)).toBe(0);
    }

    await comoWio();
    await db.query(
      'UPDATE account_modules SET enabled = true WHERE account_id = $1',
      [cuentaCristian]
    );
    await como(cristian);
    expect(await cuenta('SELECT 1 FROM juris_resoluciones')).toBe(1);
    expect(await cuenta('SELECT 1 FROM juris_favoritos')).toBe(1);
  });

  it('una cuenta desactivada pierde el acceso', async () => {
    await sistema(
      `UPDATE accounts SET status = 'inactive' WHERE id = '${cuentaCristian}'`
    );
    await como(cristian);
    expect(await cuenta('SELECT 1 FROM juris_resoluciones')).toBe(0);
    expect(await cuenta('SELECT 1 FROM juris_carpetas')).toBe(0);
    await sistema(
      `UPDATE accounts SET status = 'active' WHERE id = '${cuentaCristian}'`
    );
  });

  it('sin sesión no se lee nada', async () => {
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
    await db.query("SELECT set_config('request.jwt.claims', '', false)");
    for (const tabla of [
      'juris_resoluciones',
      'juris_temas',
      ...TABLAS_DE_USUARIO,
    ]) {
      expect(await cuenta(`SELECT 1 FROM ${tabla}`)).toBe(0);
    }
  });
});

describe.sequential('jurisprudencia: cola de ingesta', () => {
  /** Como el servidor: service-role, sin RLS. */
  async function tomar() {
    await db.exec('RESET ROLE');
    try {
      const r = await db.query<{
        resolucion_id: string;
        estado: string;
        intentos: number;
      }>('SELECT resolucion_id, estado, intentos FROM juris_tomar_job()');
      return r.rows;
    } finally {
      await db.exec('SET ROLE authenticated');
    }
  }

  it('sólo el admin de Wio ve y maneja la cola', async () => {
    await comoWio();
    await db.query('INSERT INTO juris_jobs (resolucion_id) VALUES ($1)', [
      borrador,
    ]);
    expect(await cuenta('SELECT 1 FROM juris_jobs')).toBe(1);

    for (const usuario of [cristian, golden]) {
      await como(usuario);
      expect(await cuenta('SELECT 1 FROM juris_jobs')).toBe(0);
      await expect(
        db.query('INSERT INTO juris_jobs (resolucion_id) VALUES ($1)', [
          publicada,
        ])
      ).rejects.toThrow(/row-level security/);
      await expect(db.query('SELECT juris_tomar_job()')).rejects.toThrow(
        /permission denied/
      );
    }
  });

  it('un trabajo tomado no se entrega dos veces', async () => {
    const primera = await tomar();
    expect(primera).toEqual([
      { resolucion_id: borrador, estado: 'procesando', intentos: 1 },
    ]);
    expect(await tomar()).toEqual([]);
  });

  it('se vuelve a tomar si quien lo tenía se quedó colgado', async () => {
    await sistema(
      "UPDATE juris_jobs SET bloqueado_hasta = now() - interval '1 minute'"
    );
    expect(await tomar()).toEqual([
      { resolucion_id: borrador, estado: 'procesando', intentos: 2 },
    ]);
  });

  it('lo terminado y lo fallido no vuelven a la cola solos', async () => {
    for (const estado of ['listo', 'error']) {
      await sistema(
        `UPDATE juris_jobs SET estado = '${estado}', bloqueado_hasta = NULL`
      );
      expect(await tomar()).toEqual([]);
    }
  });
});

describe.sequential('jurisprudencia: búsqueda híbrida', () => {
  const arrendamiento = '00000000-0000-0000-0000-0000000000a3';

  /** Un vector de 1024 con un 1 en `eje`: dos ejes distintos quedan a
   *  distancia 1 (lejos); el mismo eje, a distancia 0. */
  const vector = (eje: number) =>
    `[${Array.from({ length: 1024 }, (_, i) => (i === eje ? 1 : 0)).join(',')}]`;

  async function buscar(q: string, embedding: string | null = null) {
    const r = await db.query<{ resolucion_id: string; fragmento: string }>(
      'SELECT resolucion_id, fragmento FROM juris_buscar($1, $2)',
      [q, embedding]
    );
    return r.rows.map((f) => f.resolucion_id);
  }

  it('prepara una segunda resolución publicada y los embeddings', async () => {
    await comoWio();
    await db.query(
      `INSERT INTO juris_resoluciones
         (id, tipo, numero, anio, procedencia, sala, fecha, sumilla, criterio,
          articulos, fallo, url_fuente, estado, revisado_por, revisado_at, publicada_at)
       VALUES ($1, 'casacion', '555-2022', 2022, 'Arequipa', 'Sala Civil Transitoria',
          '2023-06-01', 'Desalojo por vencimiento del contrato de arrendamiento',
          'Vencido el plazo, el arrendatario debe restituir el bien.',
          ARRAY['CC art. 1700'], 'infundada',
          'https://example.test/cas-555-2022.pdf', 'publicada', $2, now(), now())`,
      [arrendamiento, wio]
    );
    await db.query(
      `INSERT INTO juris_resolucion_chunks (resolucion_id, chunk_index, content, embedding)
       VALUES ($1, 0, 'El arrendatario no restituyó el inmueble al vencer el plazo.', $2::vector)`,
      [arrendamiento, vector(2)]
    );
    await db.query(
      'UPDATE juris_resolucion_chunks SET embedding = $2::vector WHERE resolucion_id = $1',
      [publicada, vector(1)]
    );
    // El trigger mantiene los artículos como texto, para filtrar por un trozo.
    expect(
      await cuenta(
        "SELECT 1 FROM juris_resoluciones WHERE articulos_texto ILIKE '%1700%'"
      )
    ).toBe(1);
  });

  it('por palabras: encuentra lo que trata del tema y deja fuera lo demás', async () => {
    await como(cristian);
    expect(await buscar('nulidad por simulación absoluta')).toEqual([
      publicada,
    ]);
    expect(await buscar('arrendatarios que no restituyen')).toEqual([
      arrendamiento,
    ]);
  });

  it('las palabras se buscan con O: no hace falta que estén todas', async () => {
    await como(cristian);
    // "anticresis" no está en ninguna ficha: con Y no saldría nada. Con
    // O sale primero la que reúne más palabras de la consulta, y detrás
    // la que sólo comparte "contrato".
    expect(
      await buscar('simulación absoluta en un contrato de anticresis')
    ).toEqual([publicada, arrendamiento]);
    expect(await buscar('de la que')).toEqual([]);
  });

  it('el número de casación pone esa resolución primera', async () => {
    await como(cristian);
    expect(await buscar('casación 555-2022 simulación absoluta')).toEqual([
      arrendamiento,
      publicada,
    ]);
  });

  it('por significado: encuentra sin compartir ninguna palabra, y corta lo lejano', async () => {
    await como(cristian);
    expect(await buscar('zzzz', vector(1))).toEqual([publicada]);
    expect(await buscar('zzzz', vector(2))).toEqual([arrendamiento]);
    // Un vector lejos de todo no trae "el vecino más cercano" a la fuerza.
    expect(await buscar('zzzz', vector(9))).toEqual([]);
  });

  it('nunca devuelve una resolución sin publicar, ni al admin de Wio', async () => {
    for (const quien of [() => como(cristian), comoWio]) {
      await quien();
      expect(await buscar('resolución sin revisar')).toEqual([]);
      expect(await buscar('999-2021')).toEqual([]);
    }
  });

  it('una cuenta sin el módulo no encuentra nada', async () => {
    await como(golden);
    expect(await buscar('simulación absoluta', vector(1))).toEqual([]);
    expect(
      await cuenta("SELECT 1 FROM juris_fragmentos('simulación', NULL)")
    ).toBe(0);
  });

  it('los fragmentos para el asistente no los acapara una sola resolución', async () => {
    await comoWio();
    await db.query(
      `INSERT INTO juris_resolucion_chunks (resolucion_id, chunk_index, content)
       SELECT $1, n, 'La simulación absoluta, considerando ' || n
       FROM generate_series(1, 5) n`,
      [publicada]
    );
    await db.query(
      `INSERT INTO juris_resolucion_chunks (resolucion_id, chunk_index, content)
       VALUES ($1, 1, 'No hubo simulación en el arrendamiento.')`,
      [arrendamiento]
    );

    await como(cristian);
    const r = await db.query<{ resolucion_id: string }>(
      "SELECT resolucion_id FROM juris_fragmentos('simulación absoluta', NULL, 10, 2)"
    );
    const deLaPrimera = r.rows.filter((f) => f.resolucion_id === publicada);
    expect(deLaPrimera).toHaveLength(2);
    expect(r.rows.some((f) => f.resolucion_id === arrendamiento)).toBe(true);
  });
});

const TABLAS_DE_USUARIO = [
  'juris_favoritos',
  'juris_carpetas',
  'juris_carpeta_resoluciones',
  'juris_consultas',
  'juris_alertas',
];
