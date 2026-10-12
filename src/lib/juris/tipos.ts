// ============================================================
// Jurisprudencia — los tipos que comparten el servidor y el panel.
// Reflejan las migraciones 068 y 071; los valores permitidos son los
// mismos CHECK de la base.
// ============================================================

export const TIPOS_RESOLUCION = [
  'casacion',
  'pleno_casatorio',
  'precedente_vinculante',
  'acuerdo_plenario',
] as const;
export type TipoResolucion = (typeof TIPOS_RESOLUCION)[number];

export const FALLOS = [
  'fundada',
  'fundada_en_parte',
  'infundada',
  'improcedente',
  'otro',
] as const;
export type Fallo = (typeof FALLOS)[number];

export const ESTADOS_RESOLUCION = [
  'borrador',
  'pendiente_revision',
  'publicada',
  'rechazada',
] as const;
export type EstadoResolucion = (typeof ESTADOS_RESOLUCION)[number];

export const NOMBRE_TIPO: Record<TipoResolucion, string> = {
  casacion: 'Casación',
  pleno_casatorio: 'Pleno casatorio',
  precedente_vinculante: 'Precedente vinculante',
  acuerdo_plenario: 'Acuerdo plenario',
};

export const NOMBRE_FALLO: Record<Fallo, string> = {
  fundada: 'Fundada',
  fundada_en_parte: 'Fundada en parte',
  infundada: 'Infundada',
  improcedente: 'Improcedente',
  otro: 'Otro',
};

export const NOMBRE_ESTADO: Record<EstadoResolucion, string> = {
  borrador: 'Borrador',
  pendiente_revision: 'Por revisar',
  publicada: 'Publicada',
  rechazada: 'Rechazada',
};

export interface Tema {
  id: string;
  parent_id: string | null;
  slug: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
}

export interface Resolucion {
  id: string;
  tipo: TipoResolucion | null;
  numero: string | null;
  anio: number | null;
  procedencia: string | null;
  sala: string | null;
  fecha: string | null;
  sumilla: string | null;
  criterio: string | null;
  hechos: string | null;
  articulos: string[];
  fallo: Fallo | null;
  url_fuente: string | null;
  pdf_path: string | null;
  texto_completo: string | null;
  estado: EstadoResolucion;
  archivo_nombre: string | null;
  paginas: number | null;
  texto_origen: 'pdf' | 'ia' | null;
  ficha_avisos: string[];
  modelo_ficha: string | null;
  embeddings_modelo: string | null;
  motivo_rechazo: string | null;
  revisado_por: string | null;
  revisado_at: string | null;
  publicada_at: string | null;
  created_at: string;
}

export type PasoJob = 'texto' | 'ficha' | 'fragmentos';
export type EstadoJob = 'pendiente' | 'procesando' | 'listo' | 'error';

export interface Job {
  id: string;
  resolucion_id: string;
  estado: EstadoJob;
  paso: PasoJob;
  cursor: number;
  parcial: string | null;
  intentos: number;
  error: string | null;
}

export const BUCKET_PDFS = 'juris-pdfs';

/** Un error con un mensaje que se le puede mostrar tal cual al admin. */
export class JurisError extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string
  ) {
    super(mensaje);
    this.name = 'JurisError';
  }
}
