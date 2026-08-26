# Sätta igång inloggningen (Supabase + Resend)

Koden är klar och mergad. Det som återstår kräver dina konton, så det måste göras
av dig i webbläsaren — jag kan inte och ska inte hantera nycklarna.

**Tills det här är gjort fungerar Sökt precis som förut**: helt lokalt, ingen
inloggningsknapp syns. Appen läser `VITE_SOKT_SUPABASE_URL` och
`VITE_SOKT_SUPABASE_ANON_KEY`; saknas de är kontodelen avstängd, och
supabase-js laddas aldrig ens ner. Det är verifierat i webbläsaren.

Räkna med ~30 minuter. Steg 4 (DNS) kan ta några timmar innan det slår igenom.

---

## 1. Skapa Supabase-projektet

Eget projekt för Sökt — **inte** Pathlys. Skälet står i migrationsfilen: Sökt är
en publik app för vem som helst, och dess användare ska inte ligga som rader i en
leverantörs tenant-databas när verktyget ska säljas till flera R&M-leverantörer.

1. supabase.com → **New project**. Namn `sokt`, region **Frankfurt (eu-central-1)**
   (närmast, och håller personuppgifterna inom EU).
2. Spara databaslösenordet i din lösenordshanterare direkt. Det visas en gång.
3. **OBS free-planen tar max 2 aktiva projekt per organisation.** Arbetsklivet-orgen
   hade Pathly + Dugsi. Antingen: lägg Sökt i en annan organisation, eller
   uppgradera. Kolla vad som faktiskt gäller innan du börjar.

## 2. Lägg in nycklarna

Settings → **API**. Du behöver två värden:

- **Project URL** → `VITE_SOKT_SUPABASE_URL`
- **anon / publishable key** → `VITE_SOKT_SUPABASE_ANON_KEY`

`anon`-nyckeln är publik och skyddas av RLS. **`service_role`-nyckeln ska aldrig
in i den här appen** — den kringgår RLS och skulle ligga i webbläsaren.

Lokalt: kopiera `.env.example` till `.env.local` och fyll i (den är gitignorerad).

I Vercel: Project → Settings → Environment Variables, samma två namn, för
Production och Preview. Deploya om efteråt — Vite bakar in dem vid bygget.

## 3. Kör migrationen

`supabase/migrations/20260728120000_sokt_konto_och_synk.sql` skapar `applications`
och `profiles` med RLS där varje användare bara ser sina egna rader.

Antingen SQL Editor i dashboarden (klistra in filen), eller säg till mig så kör
jag den med `db-migrate` när du har en token — den är idempotent och går att köra
om.

**Verifiera efteråt** (SQL Editor): båda tabellerna ska ha `rowsecurity = true`.

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('applications','profiles');
```

## 4. Resend: domän och nyckel

1. resend.com → lägg till domänen du vill skicka från, t.ex. `sokt.arbetsklivet.se`
   eller `arbetsklivet.se`.
2. Lägg in DNS-posterna Resend visar (DKIM + SPF) hos **one.com**, där
   arbetsklivet.se ligger.
   **Varning:** arbetsklivet.se har MX mot Google Workspace och saknade SPF helt
   vid senaste kollen. Lägg *en* SPF-post som täcker båda, inte två — två
   SPF-poster gör att båda ignoreras:
   `v=spf1 include:_spf.google.com include:_spf.resend.com ~all`
   Använder du en subdomän för utskicken slipper du röra huvuddomänens post.
3. Vänta tills Resend visar domänen som verifierad.
4. Skapa en **API-nyckel** (Sending access räcker). Den blir SMTP-lösenordet.

## 5. Koppla Resend till Supabase

Supabase → Authentication → **SMTP Settings** → Enable Custom SMTP:

| Fält | Värde |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | din Resend API-nyckel |
| Sender email | t.ex. `kod@sokt.arbetsklivet.se` (måste ligga på den verifierade domänen) |
| Sender name | `Sökt` |

Utan custom SMTP använder Supabase sin inbyggda utskickare med **mycket** låg
gräns (några mejl i timmen) — den duger till att testa själv, inte till användare.

## 6. Gör mejlet till en sexsiffrig kod

Det här steget är hela poängen och lätt att missa: Supabase skickar en **magisk
länk** som standard, inte en kod.

Authentication → **Email Templates** → *Magic Link*. Ersätt innehållet så att det
använder `{{ .Token }}` i stället för `{{ .ConfirmationURL }}`. Till exempel:

```html
<h2>Din kod till Sökt</h2>
<p>Skriv in den här koden i appen:</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700">{{ .Token }}</p>
<p>Koden gäller i en timme. Har du inte bett om den kan du strunta i det här mejlet.</p>
```

Skriv det gärna på svenska, arabiska och somaliska i samma mejl — mottagaren
läser inte nödvändigtvis svenska. Mallen är ett enda mejl för alla, så alla tre
språken får plats under varandra.

Kontrollera också under Authentication → Providers att **Email** är påslaget.

## 7. Testa

1. Öppna appen (lokalt eller preview-deployen) → **Logga in** i huvudet.
2. Din egen adress → *Skicka kod* → koden ska komma inom sekunder.
3. Skriv koden → du ska bli inloggad och se "Synkat ✓".
4. Logga en ansökan. Öppna appen i ett privat fönster, logga in med samma adress:
   **ansökan ska finnas där.** Det är hela funktionen.
5. Radera ansökan i det ena fönstret, ladda om det andra — den ska vara borta där
   också (mjuk radering, så raderingen når andra enheter).

Säg till när steg 1–6 är klara, så verifierar jag hela flödet mot det riktiga
projektet och lägger till det som fattas.

---

## Radera kontot — byggt, men overifierat

Migrationen innehåller `delete_own_account()` (SECURITY DEFINER, läser `auth.uid()`
ur JWT:n så ingen kan begära någon annans konto), och kontopanelen har "Radera
mitt konto" med tvåstegsbekräftelse. `ON DELETE CASCADE` tar ansökningar och
profil med sig. Deltagarens data på enheten rörs inte — det står i panelen.

**Testa det explicit** i steg 7: skapa ett konto, logga en ansökan, radera kontot,
och kontrollera i SQL Editor att raden är borta:

```sql
select count(*) from public.applications;
select count(*) from auth.users;
```

## CV-synk — byggt

CV:t följer nu kontot mellan enheter. Filen ligger i en privat Storage-bucket
`cvs`, en fil per konto på vägen `<user_id>/cv`, skyddad av RLS på ägarmappen
(bara ägaren når sin egen fil). Filnamn, textinnehåll och storlek ligger på
`profiles`-raden (`cv_file_name`, `cv_text`, `cv_byte_size`) så en ny enhet kan
visa CV:t direkt utan att tolka om PDF:en.

Kräver migrationen `20260826120000_cv_lagring.sql` (skapar bucketen, RLS-policys
och de tre kolumnerna). Kör den i SQL Editor på samma sätt som kontomigrationen.

Lokalt lagras CV:t som `ArrayBuffer`, inte råa `File`/`Blob` — iOS Safari vägrar
strukturklona en Blob till IndexedDB, vilket gav felet "Error preparing
Blob/File data to be stored in object store" på telefonen.

## Det jag medvetet inte byggt än

- **Delning med coach.** Kommer separat, och ska vara deltagarens eget val.
