-- ===================================================================
-- Sökt: sändlogg för ansökningsmejl (dagstak mot missbruk)
-- ===================================================================
-- Serverfunktionen som skickar ansökningar via Resend loggar varje utskick
-- här och vägrar över 20 per konto och dygn. Utan taket vore adressen ett
-- spamrelä för vilket inloggat konto som helst. RLS: var och en ser och
-- skriver bara sina egna rader — samma modell som applications.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.sokt_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sokt_send_log_user_time_idx
  ON public.sokt_send_log (user_id, sent_at DESC);

ALTER TABLE public.sokt_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "send_log_select_own" ON public.sokt_send_log;
CREATE POLICY "send_log_select_own" ON public.sokt_send_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "send_log_insert_own" ON public.sokt_send_log;
CREATE POLICY "send_log_insert_own" ON public.sokt_send_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Ingen update/delete: loggen är append-only. Raderas kontot försvinner den
-- via CASCADE.
