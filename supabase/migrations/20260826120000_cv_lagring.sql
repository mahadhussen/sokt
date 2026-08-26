-- ===================================================================
-- Sökt: CV-lagring per konto (privat bucket + RLS)
-- ===================================================================
-- CV:t låg tidigare bara i webbläsarens IndexedDB — det följde aldrig med
-- kontot. En deltagare la in sitt CV på datorn och telefonen såg ingenting.
-- Nu lagras CV:t i en PRIVAT bucket, en fil per konto på väg `<user_id>/cv`,
-- så alla enheter med samma inloggning når det. Bara ägaren når sin egen fil.
--
-- Idempotent.

-- ── 1. Privat bucket ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cvs', 'cvs', false, 10485760)   -- 10 MB, aldrig publik
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

-- ── 2. Storage-RLS: ägaren når bara sin egen mapp ─────────────────
-- Vägen är `<user_id>/cv`. Första mappnivån måste vara den inloggades id.
DROP POLICY IF EXISTS "cvs_select_own" ON storage.objects;
CREATE POLICY "cvs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "cvs_insert_own" ON storage.objects;
CREATE POLICY "cvs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "cvs_update_own" ON storage.objects;
CREATE POLICY "cvs_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "cvs_delete_own" ON storage.objects;
CREATE POLICY "cvs_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 3. CV-metadata på profilen ─────────────────────────────────────
-- Filnamn + extraherad text så en ny enhet kan återskapa CvMeta utan att
-- tolka om PDF:en. Själva filen bor i bucketen; det här är bara etiketterna.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv_file_name text,
  ADD COLUMN IF NOT EXISTS cv_text text,
  ADD COLUMN IF NOT EXISTS cv_byte_size integer;
