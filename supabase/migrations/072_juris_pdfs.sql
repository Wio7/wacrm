-- ============================================================
-- 072_juris_pdfs.sql — Dónde viven los PDFs de las resoluciones
--
-- Un bucket PRIVADO. El admin de Wio sube y lee directo desde el panel
-- (el navegador habla con Storage; así un PDF pesado no pasa por el
-- límite de tamaño de las funciones del servidor). Nadie más tiene
-- política: la app lee los PDFs con enlaces firmados de corta duración
-- que le da el servidor después de comprobar que la resolución está
-- publicada y que la cuenta tiene el módulo.
--
-- Idempotente.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'juris-pdfs',
  'juris-pdfs',
  false,
  33554432, -- 32 MB: el tope de un PDF que el modelo de IA acepta leer
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS juris_pdfs_select ON storage.objects;
CREATE POLICY juris_pdfs_select ON storage.objects FOR SELECT
  USING (bucket_id = 'juris-pdfs' AND public.is_super_admin());

DROP POLICY IF EXISTS juris_pdfs_insert ON storage.objects;
CREATE POLICY juris_pdfs_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'juris-pdfs' AND public.is_super_admin());

DROP POLICY IF EXISTS juris_pdfs_delete ON storage.objects;
CREATE POLICY juris_pdfs_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'juris-pdfs' AND public.is_super_admin());
