-- ===================================================================
-- Sökt: vakthund mot massregistrering
-- ===================================================================
-- Sökt är öppet för vem som helst, vilket är rätt — men det betyder att någon
-- kan skripta tusentals skräpkonton. Det LÄCKER ingen data (RLS isolerar varje
-- konto), men varje registrering skickar ett mejl, så en flod bränner Resends
-- kvot och fyller användarlistan.
--
-- Den här vakthunden LARMAR, den blockerar inte. Att auto-blockera skulle
-- straffa riktiga deltagare (låg datorvana) och en angripare kunde då stänga
-- ute alla genom att slå i taket. I stället mejlar den Mahad så han kan reagera
-- (slå på CAPTCHA, undersöka). Larmet skickas högst en gång per timme.
--
-- Kräver tilläggen pg_cron och pg_net (aktivera i Dashboard → Database →
-- Extensions om CREATE EXTENSION nedan nekas). Resend-nyckeln läses ur Supabase
-- Vault — den ligger ALDRIG i den här filen.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Larmlogg. Ingen vanlig användare kommer åt den — bara dashboarden/service_role.
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_alerts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_signup_rate()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  threshold int := 25;      -- fler än så nya konton på en timme = misstänkt. Justera.
  recent int;
  last_alert timestamptz;
  resend_key text;
BEGIN
  SELECT count(*) INTO recent
  FROM auth.users
  WHERE created_at >= now() - interval '1 hour';

  IF recent <= threshold THEN
    RETURN;
  END IF;

  -- Larma högst en gång i timmen så inboxen inte svämmar över.
  SELECT max(created_at) INTO last_alert
  FROM public.security_alerts WHERE kind = 'signup_flood';
  IF last_alert IS NOT NULL AND last_alert > now() - interval '1 hour' THEN
    RETURN;
  END IF;

  INSERT INTO public.security_alerts(kind, detail)
  VALUES ('signup_flood',
    jsonb_build_object('count', recent, 'window', '1h', 'threshold', threshold));

  -- Mejla Mahad via Resend. Nyckeln hämtas ur Vault; utan nyckel loggas larmet
  -- ändå (raden ovan) och kan läsas i dashboarden.
  SELECT decrypted_secret INTO resend_key
  FROM vault.decrypted_secrets WHERE name = 'resend_key' LIMIT 1;

  IF resend_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || resend_key,
        'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'Sökt vakthund <kod@arbetsklivet.se>',
        'to', jsonb_build_array('mahad@arbetsklivet.se'),
        'subject', 'Sökt: ovanligt många nya konton',
        'html', format(
          '<p><b>%s</b> nya konton skapades den senaste timmen (larmgräns %s).</p><p>Kolla om det är missbruk. Vill du bromsa: slå på CAPTCHA under Authentication → Attack Protection.</p>',
          recent, threshold))
    );
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.check_signup_rate() FROM PUBLIC, anon, authenticated;

-- Kör var 15:e minut. Kör om det här blocket byter schemat utan dubblett.
SELECT cron.unschedule('sokt-signup-watchdog')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sokt-signup-watchdog');

SELECT cron.schedule('sokt-signup-watchdog', '*/15 * * * *',
  $$ SELECT public.check_signup_rate(); $$);
