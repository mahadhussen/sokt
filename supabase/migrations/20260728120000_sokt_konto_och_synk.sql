-- ===================================================================
-- Sökt: konto och synk av deltagarens EGNA uppgifter
-- ===================================================================
-- Sökt är öppet för vem som helst som söker jobb i Sverige. Kontot är
-- FRIVILLIGT: appen fungerar fullt ut lokalt utan inloggning, och kontot finns
-- bara för att deltagaren ska nå sina egna ansökningar från flera enheter.
--
-- Därför bor det här i ett EGET Supabase-projekt, inte i Pathlys. En publik
-- konsumentapps användare ska inte ligga som rader i en leverantörs
-- tenant-databas — särskilt inte när Sökt ska kunna säljas till flera
-- R&M-leverantörer. Deltagaren äger sitt eget konto och kan senare VÄLJA att
-- dela med en coach; det är också det enda sättet att få ett samtycke som är
-- frivilligt i GDPR:s mening (art. 7.4), eftersom coachen annars styr
-- deltagarens programdeltagande.
--
-- Idempotent: kan köras om utan att något går sönder.

-- ── 1. Ansökningar ─────────────────────────────────────────────────
-- Kolumnnamnen speglar src/model/types.ts. De sex första fälten ÄR
-- Arbetsförmedlingens aktivitetsrapport och får aldrig hittas på — varken av
-- appen eller av en språkmodell.
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY,                       -- sätts av klienten (crypto.randomUUID)
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title text NOT NULL,
  employer_name text NOT NULL,
  employment_type text NOT NULL CHECK (employment_type IN ('heltid', 'deltid', 'timanstalld')),
  applied_at date NOT NULL,
  survey_answered boolean NOT NULL DEFAULT false,
  municipality text NOT NULL,
  -- Spårbarhet, inte ett rapportfält: 'manual', 'email:...' eller 'url:...'.
  channel text NOT NULL DEFAULT 'manual',
  job_url text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'draft')),
  -- Mjuk radering. Utan den kan en radering på en enhet inte nå de andra:
  -- en saknad rad går inte att skilja från en rad som ännu inte laddats upp,
  -- så nästa synk skulle återuppliva den och deltagaren blir aldrig av med den.
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applications_user_idx
  ON public.applications (user_id, applied_at DESC);

-- ── 2. Profil ──────────────────────────────────────────────────────
-- CV-filen synkas INTE här. Den ligger kvar på enheten tills filsynk byggs;
-- en referens till en fil som inte finns vore en lögn på nästa enhet.
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  base_letter text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3. RLS ─────────────────────────────────────────────────────────
-- En användare ser och rör bara sina egna rader. Det finns ingen coach- eller
-- adminroll i det här projektet: ingen annan än deltagaren själv har åtkomst.
-- WITH CHECK på INSERT/UPDATE hindrar att någon skriver rader åt en annan
-- user_id — USING ensamt skyddar bara läsning.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_select_own" ON public.applications;
CREATE POLICY "applications_select_own" ON public.applications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "applications_insert_own" ON public.applications;
CREATE POLICY "applications_insert_own" ON public.applications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "applications_update_own" ON public.applications;
CREATE POLICY "applications_update_own" ON public.applications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "applications_delete_own" ON public.applications;
CREATE POLICY "applications_delete_own" ON public.applications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── 4. updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS applications_updated_at ON public.applications;
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. GDPR: radera betyder radera ─────────────────────────────────
-- Den som kan skapa ett konto måste kunna ta bort det, i appen, utan att mejla
-- någon. Utan det här är "radera" ett påstående och inte en funktion.
--
-- SECURITY DEFINER krävs: anon-nyckeln får aldrig röra auth.users direkt.
-- Funktionen raderar BARA den inloggades egen rad — auth.uid() kommer från
-- JWT:n och går inte att skicka med som argument, så en användare kan inte
-- begära att någon annans konto tas bort.
--
-- ON DELETE CASCADE på applications och profiles gör att allt innehåll följer
-- med. Deltagarens data på den egna enheten rörs inte; den raderas separat med
-- "Radera all data", och det står uttryckligen i appen.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Inte inloggad';
  END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END; $$;

-- Bara inloggade, aldrig anon.
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
