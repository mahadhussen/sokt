# Gmail-utkast: så slår du på det (~15 min)

Knappen "✉️ Lägg utkast i min Gmail — CV:t bifogas" finns i ansökningspanelen.
Den lägger ett färdigt utkast (brev + PDF-CV) i ANVÄNDARENS egen Gmail — de
öppnar Gmail, granskar och trycker Skicka själva. Skickas gör alltså aldrig
något av appen.

Koden är klar och live. Det som återstår är två klickjobb i dashboards som
kräver dina konton:

## 1. Google Cloud: skapa OAuth-klienten (~10 min)

1. console.cloud.google.com → skapa projekt `sokt` (eller återanvänd ett).
2. **APIs & Services → Library** → sök "Gmail API" → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - App name `Sökt`, support-mejl din adress. Spara.
   - **Scopes**: lägg till `.../auth/gmail.compose` (Gmail API → "Create,
     read, update and delete drafts").
   - **Test users**: lägg till `mahadhussen10x@gmail.com` (och andra som ska
     testa). I testläge funkar upp till 100 användare utan Googles granskning.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Type: **Web application**, namn `sokt-web`.
   - **Authorized redirect URIs** — exakt denna:
     `https://vagsegsbldzpamuzgzmd.supabase.co/auth/v1/callback`
   - Skapa → kopiera **Client ID** och **Client Secret**.

## 2. Supabase: slå på Google-providern (~3 min)

Dashboard → Authentication → **Sign In / Providers** → **Google**:
- Enable ✓
- Klistra in Client ID + Client Secret från steg 1.
- Spara.

## 3. Testa

1. sokt-delta.vercel.app → sök ett e-postjobb → Ansök.
2. Tryck **"Lägg utkast i min Gmail"** → du skickas till Google →
   välj mahadhussen10x@gmail.com → godkänn ("skapa utkast").
3. Tillbaka i Sökt: tryck knappen igen → "Klart! Utkastet med CV ligger i din
   Gmail under Utkast."
4. Öppna Gmail (10x-kontot) → **Utkast** → brevet med **CV.pdf bifogad** →
   granska → Skicka. Ligger sedan i din Skickat-mapp.

## Bra att veta

- **Samma mejl i båda:** logga in i Sökt och koppla Google med SAMMA adress,
  annars blir det två olika konton och synken ser tom ut.
- **Googles "unverified app"-skärm** visas i testläge — klicka "Continue".
  Den försvinner när appen verifieras (krävs först vid >100 användare;
  gmail.compose är en "restricted scope" så verifiering vid skala innebär en
  säkerhetsgranskning hos Google).
- Tokenen lever ~1 timme. Går den ut säger appen till och man kopplar om med
  ett klick.
- Utan Google-koppling fungerar allt som förut: Gmail-länken (rätt konto via
  authuser), mailto och Outlook finns kvar.
