# Säkerhet i Sökt

Kort översikt över vad som skyddar deltagarnas data — och vad som medvetet inte
gör det. Skriven för att kunna visas en R&M-leverantör som frågar.

## Modellen: öppet konto, isolerad data

Sökt är öppet — vem som helst kan skapa ett konto med sin mejl. Det är avsiktligt
och innebär **ingen** risk för andras data, eftersom varje konto bara når sitt
eget. Tre lager garanterar det:

1. **Row Level Security (RLS).** Varje rad i `applications` och `profiles` är
   låst till `user_id = auth.uid()`. Verifierat skarpt: anonym läsning ger noll
   rader, inloggad ser bara sina egna. `WITH CHECK` på insert/update hindrar att
   någon skriver rader åt en annan användare. Det finns ingen coach- eller
   adminroll i projektet — ingen kan läsa på tvärs.
2. **Signerade JWT.** `auth.uid()` kommer ur en token Supabase signerar med en
   hemlighet bara de har. Den går inte att förfalska, så man kan inte utge sig
   för att vara någon annan. `delete_own_account()` läser `auth.uid()` ur token,
   så ingen kan radera någon annans konto.
3. **`service_role`-nyckeln finns aldrig i klienten.** Det är den enda nyckeln
   som kringgår RLS, och den ligger bara i Supabase-dashboarden. Appen använder
   `anon`-nyckeln, som är byggd för att vara publik och bara får det RLS tillåter.

## Inloggning

Lösenordslöst: engångskod (6–10 siffror) via mejl, Supabase Auth + Resend som
SMTP. Ingen lösenordsdatabas att läcka. Att komma in i ett befintligt konto
kräver tillgång till mejladressens inkorg.

## Vad som står på spel

Jobbansökningar och en profil (namn, mejl, grundbrev). **Inga lösenord, inga
betaluppgifter, inga personnummer.** Attackytan är liten och belöningen låg.

## Den verkliga risken: missbruk, inte inbrott

Öppen registrering kan missbrukas för att skapa massor av skräpkonton eller
spamma kod-mejl till andras adresser. Det läcker ingen data men bränner Resends
kvot. Skydd:

- **60-sekundersspärr per adress** (Supabase, redan på).
- **Vakthund** (`supabase/migrations/20260728130000_vakthund_signups.sql`):
  pg_cron kollar var 15:e minut hur många konton som skapats senaste timmen och
  mejlar Mahad om det överstiger gränsen (25/timme som standard). Larmar, blockerar
  inte — auto-block skulle straffa riktiga deltagare. Se setup nedan.
- **CAPTCHA** (Authentication → Attack Protection) stoppar botregistreringar men
  försvårar för målgruppen (låg datorvana). **Slå på först om missbruk syns** —
  vakthunden är förvarningen.

## Regler som inte får brytas

- `service_role`-nyckeln och databaslösenordet får aldrig ut i kod, git, chatt
  eller en `VITE_`-variabel. Så länge de stannar i dashboarden är väggen hel.
- `VITE_`-variabler är publika per definition (hamnar i webbläsaren). Lägg bara
  `anon`-nyckeln och projekt-URL:en där — aldrig något hemligt.

## Setup för vakthunden

1. Dashboard → Database → Extensions: aktivera **pg_cron** och **pg_net** (om
   inte migrationens `CREATE EXTENSION` räcker).
2. Lägg Resend-nyckeln i Vault (körs en gång i SQL Editor, byt ut nyckeln):
   ```sql
   select vault.create_secret('re_DIN_RESEND_NYCKEL', 'resend_key');
   ```
3. Kör `supabase/migrations/20260728130000_vakthund_signups.sql` i SQL Editor.
4. Testa: `select public.check_signup_rate();` ska köra utan fel. Larmloggen
   ligger i `public.security_alerts`.

Manuell koll när som helst:
```sql
select count(*) from auth.users where created_at > now() - interval '24 hours';
```
