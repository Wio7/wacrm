import { NextResponse } from 'next/server';

import {
  MAX_PREGUNTA,
  responder,
  type RespuestaAsistente,
} from '@/lib/juris/asistente';
import { cuerpo, ruta, texto } from '@/lib/juris/http';
import { exigirCupoDelAsistente, registrarConsulta } from '@/lib/juris/uso';

/**
 * POST /api/juris/asistente
 *
 *   { "pregunta": "¿Cuándo hay simulación absoluta en una compraventa?" }
 *
 * Responde sólo con lo que dicen las resoluciones del catálogo, citando
 * cada afirmación. El texto trae marcas `[RES:<id>]` donde va cada cita;
 * `citas` trae los datos de esas resoluciones para dibujar las tarjetas.
 * Si el catálogo no cubre la pregunta: "No encontré jurisprudencia en la
 * base para esa consulta."
 *
 * Con `Accept: text/event-stream` la respuesta llega en eventos
 * (`citas`, luego `texto` por trozos, luego `fin`). Lo que se transmite
 * es el texto YA validado por el servidor, no lo que el modelo va
 * escribiendo: la primera palabra tarda lo que tarda la respuesta
 * entera, y a cambio nunca aparece en pantalla una cita que después
 * haya que retirar.
 *
 * Límite de uso por usuario: ver src/lib/juris/uso.ts.
 */
export const maxDuration = 300;

const codificador = new TextEncoder();
const evento = (nombre: string, datos: unknown) =>
  codificador.encode(`event: ${nombre}\ndata: ${JSON.stringify(datos)}\n\n`);

function enEventos(respuesta: RespuestaAsistente): Response {
  const trozos = respuesta.respuesta.match(/\S+\s*/g) ?? [];
  const flujo = new ReadableStream<Uint8Array>({
    start(control) {
      control.enqueue(
        evento('citas', {
          citas: respuesta.citas,
          sin_resultados: respuesta.sinResultados,
          aviso: respuesta.aviso,
        })
      );
      // De a pocas palabras: se lee como si se escribiera, sin mandar
      // un evento por cada una.
      for (let i = 0; i < trozos.length; i += 6) {
        control.enqueue(
          evento('texto', { texto: trozos.slice(i, i + 6).join('') })
        );
      }
      control.enqueue(evento('fin', {}));
      control.close();
    },
  });
  return new Response(flujo, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export const POST = ruta(async (ctx, request) => {
  const pregunta = texto((await cuerpo(request)).pregunta, MAX_PREGUNTA);
  if (!pregunta || pregunta.length < 5) {
    return NextResponse.json(
      { error: 'Escribe tu pregunta.' },
      { status: 400 }
    );
  }

  await exigirCupoDelAsistente(ctx);

  const inicio = performance.now();
  const respuesta = await responder(ctx.supabase, pregunta);

  await registrarConsulta(ctx, {
    tipo: 'asistente',
    pregunta,
    respuesta: respuesta.respuesta,
    resolucionesCitadas: respuesta.citas.map((c) => c.id),
    sinResultados: respuesta.sinResultados,
    duracionMs: performance.now() - inicio,
  });

  if (request.headers.get('accept')?.includes('text/event-stream')) {
    return enEventos(respuesta);
  }
  return {
    respuesta: respuesta.respuesta,
    citas: respuesta.citas,
    sin_resultados: respuesta.sinResultados,
    aviso: respuesta.aviso,
  };
});
