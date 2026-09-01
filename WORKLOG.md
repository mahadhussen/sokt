## NEEDS-DECISION (öppna — kräver backend/Supabase/BankID)
Hela produkten kör lokalt utan backend. Följande återstående punkter kan inte byggas ärligt på den lokala stacken och väntar på ett backend-/Supabase-beslut. Alla har en ren söm i koden (StoragePort, letterProvider, freshness-cache) så de aktiveras utan omskrivning:
- **Äkta JobStream-mirror.** M9 ger en lokal freshness-cache (senaste sökningen sparas + "senast hämtad", återställs offline). En riktig mirror konsumerar JobStreams ändringsström till en databas server-side — kräver backend + lagring + schemalagd körning.
- **Multi-user coach-/providervy.** M6 ger deltagarens egen översikt att gå igenom med coachen. Att en coach loggar in och ser flera deltagares data kräver auth + roller + RLS (Supabase).
- **Bevakningar/alerts med push.** M7 ger "nya sedan sist" när användaren själv kör sökningen. Push/e-post kräver bakgrundskörning server-side.
- **BankID.** Kräver certifierad backend-integration; kan inte göras klientlokalt.
- **AI-brev utan egen nyckel.** M8 kör deterministiskt som default + äkta AI via användarens egen Anthropic-nyckel. En delad nyckel kräver backend-proxy (annars exponeras nyckeln).
- **Kryptering i vila på appnivå.** Lokalt skyddas data av OS/webbläsare; äkta app-kryptering kräver en backend-nyckel.

## 2026-09-01 — Sökningar blir taggar automatiskt (M12)

### Byggt (commits f5580bf, d5ee335, 3398694, 09997e5)
Mahads uppdrag: "jag klickar i diskare så sparas det … lägger till
lokalvårdare och det sparas också." Varje körd sökning (yrke + ev. ort
+ ev. omfattning) blir automatiskt en tryckbar tagg under sökfältet —
deltagaren skriver aldrig om en sökning.
- **Ren modul** (`jobs/savedSearch.ts`): `searchKey` (case/space-
  okänslig identitet), `findSavedSearch`, `upsertSearch` (befintlig
  tagg behåller id/namn/position — chips hoppar aldrig), tak
  `MAX_SAVED_SEARCHES = 10` med **LRU-utrymning** (minst nyligen ANVÄND
  ryker, aldrig den som trycks varje dag), `mergeRestoredSearches` för
  backupimport. 24 tester i node.
- **Store**: `recordSearch(input, jobIds)` är ENDA vägen in — ersätter
  `saveSearch` + `markSearchSeen` (borttagna). Sparar seenJobIds så
  "nya sedan sist" nu fungerar för varje upprepad sökning, inte bara
  chip-tryck. `lastUsedAt` följer med i GDPR-exporten (SavedSearch-fält).
- **UI**: taggning sker i `runSearch` — skriven sökning och taggtryck
  går exakt samma väg. Aktiv tagg markerad (ram + tonad bakgrund + fet
  blå text + `aria-current`), rubrik "Dina sökningar — tryck för att
  söka igen" (sv/ar/so). Kryss tar bort. "+ Spara sökningen"-knappen
  och `window.prompt`-flödet borttagna (färre knappar).

### Övervägda val
- **Sökning utan träffar taggas inte** — felstavningar ("diskarre")
  ska inte fylla listan med skräpchips. Rättstavad sökning i liten ort
  med 0 träffar taggas alltså inte heller förrän den ger träff — bedömt
  som rätt byte. Samma villkor som freshness-cachen.
- **Tom sökning (alla fält tomma) taggas inte** — en "Alla jobb"-tagg
  hjälper ingen.
- Ordning: nya taggar läggs sist, befintliga behåller plats (ingen
  MRU-sortering) — chips som hoppar förvirrar målgruppen.
- seenJobIds sparar de VISADE annonserna (efter enkel ansökan-filtret),
  samma semantik som förut.

### Fel hittade och fixade under bygget (BOB före Heisenberg)
1. En rå NUL-byte hamnade i källkoden i stället för escapesekvensen
   `'\u0000'` i searchKey — osynlig i editorer, upptäckt med `od -c`.
2. Sökte man "  DISKARE " på befintlig "diskare"-tagg skrevs taggens q
   om till versalversionen medan namnet bestod — taggen behåller nu
   sitt ursprungliga q (uppmätt i localStorage före/efter).
3. Kryssets tryckyta mätte 32,6×44 px — nu `min-width: var(--tap)`,
   uppmätt 44,0×44,0 i både LTR och RTL.
4. Backupimportens dedup låg otestad i storen och missade dubbletter
   inom själva backupfilen — utlyft till ren testad modul.

### Kvalitetsgrindar
typecheck ✅ lint ✅ test ✅ (176, +18) build ✅. Verifierat i webb-
läsarpanelen på 375×812, hård omladdning: sökning → tagg dyker upp
aktiv; andra sökningen → två taggar, aktiv flyttar; tryck på tagg →
filtren återställs, sökningen körs om, "Inga nya sedan sist" visas,
dedup håller (2 taggar efter "  DISKARE "); kryss → borta ur DOM och
localStorage; persistens över hård omladdning inkl. aktiv-återställning
via lastSearch-matchning; extremlång tagg radbryts inuti chipet utan
sidscroll (scrollWidth 375 = clientWidth 375); arabiska RTL speglad
(dir=rtl, chips från höger, kryss på vänster sida i chipet); somaliska
rubrik/aria verifierade. OBS: webbläsarpanelens klickverktyg tappade
mouseup (panel dold) — klick verifierade via element.click()/
requestSubmit i sidan; tangentbordstext och form_input fungerade.
Heisenberg + Naadir återstår före deploy.

## 2026-08-31 — UI-omgörning: mobilförst designsystem i befintlig CSS

### Byggt (commit 502c529)
Mahads uppdrag: "mer användarvänlig med ui-systemet", målgruppen (låg
digital vana, små telefoner, sv/ar/so) styr allt. Inget ramverksbyte —
tokenskala i ren handskriven `src/index.css`.
- **Bottennavigation** med ikon + text på mobil (<640px), topprad med
  ikoner på desktop. Förut: fem textflikar i scrollrad där två låg
  utanför skärmen på 375px utan synlig väg dit. Badge visar antal
  ansökningar. Fliketiketter kortade i alla tre språk (Rapport/التقرير/
  Warbixin, ملفي) — uppmätt otrunkerade på 375px i alla språk.
- **Ansökningspanelen**: EN stor primär väg (.cta 52px, full bredd) —
  direktutskicket eller mejllänken — sekundära vägar nedtonade under.
  Ny sektionsrubrik "Till aktivitetsrapporten" (nyckel apply.forReport,
  3 språk) förklarar varför datum/form/ort efterfrågas.
- **Kvittot är en toast**: stor, grön, fast ovanför navigationen. Förut
  en rad i sidtoppen som inte syntes när man loggade långt ner i listan.
  Animationen rör bara transform — en pausad animation (dold flik) fick
  aldrig lämna kvittot på opacity 0 (uppmätt bugg under bygget, fixad).
- **Ansökningslistan som kort** i stället för åttakolumnig tabell med
  sidscroll. Rapportfliken behåller tabellen — den speglar AF-dokumentet.
- Fokusringar, :active-tryckåterkoppling, 44px-tryckytor, 16px inputs
  (ingen iOS-zoom), accent-color på checkboxar, tom-läge före första
  sökningen (search.hint, 3 språk).

### Fel hittade och fixade under bygget (BOB före Heisenberg)
1. Toast fastnade på opacity 0 när fliken var dold (animation pausad på
   frame 0) — uppmätt computed opacity 0; opacity borttagen ur keyframes.
2. Samtyckesgrindens Fortsätt-knapp träffades inte av knappselektorerna
   och renderades som ostilad grå defaultknapp — `.card > button` tillagd.
3. "Ansökningar" trunkerades i bottennaven (uppmätt scrollWidth >
   clientWidth) — etikett 0.68rem med konstant vikt (iOS-standard).
4. Arabiska "الملف الشخصي" trunkerades (70px > 69px) — fliketikett "ملفي".
5. p-marginaler dubblades ovanpå panelens flex-gap — `.apply-panel > p`
   nollställd.

### Övervägda val
- Rapportflikens tre exportknappar lika i vikt: först medvetet, sedan
  underkänt av Heisenberg (rond 1, punkt 5) — nu Kopiera primär.
- 320px-enheter (iPhone SE 1): "Ansökningar" (68px) kan trunkeras vid
  60px flikbredd; ellipsis är skyddsnätet, enheten bedöms marginell.
- `[dir='rtl'] .tabs { row-reverse }` borttagen: den tvingade LTR-ordning
  i arabiska; naturlig RTL-ordning verifierad visuellt.

### Kvalitetsgrindar
typecheck ✅ lint ✅ test ✅ (158) build ✅. Verifierat i webbläsare på
375px: Jobb, ansökningspanel, Ansökningar, Profil, Rapport, arabiska
(RTL-spegling uppmätt korrekt). Heisenberg + Naadir återstår före deploy.

### Heisenberg rond 1: NOT CLEAN → åtta fynd fixade (uppmätta före/efter)
1. Tryckytor under 44px: `.mail-alt a` 17→44, `.job-actions a` 24,8→44,
   `.app-card-actions a` 25→44, `.chip-main`/`.chip-x` 33-34→44,
   `.link-button` generellt 17→44. Kommentaren vid `.chip-x` som påstod
   att krysset redan var fixat rättad.
2. Toastens Ångra-knapp: kontrast 4,13:1 → 8,68:1 (svart 28 % över
   grönt i stället för halvvitt; uppmätt i renderad DOM).
3. Alla tre `clipboard.writeText` har try/catch + synligt felbesked
   (copy.failed, 3 språk) — bevisat live med stubbat NotAllowedError.
4. Ångra-fönstret 8s → 15s och pausar vid pekning/fokus på toasten —
   uppmätt: kvar 23s under paus, borta 16,5s efter släpp. OBS testfälla:
   syntetisk icke-bubblande pointerenter når inte Reacts delegering;
   riktiga pekare skickar pointerover, som fungerar.
5. Rapportfliken: Kopiera primär (blå), CSV/PDF ghost (uppmätt computed
   background) — en primär handling per yta.
6. Datumkolumnen radbryts inte längre (`white-space: nowrap` uppmätt).
7. Pappersflygplanet speglas i RTL (`matrix(-1,0,0,1,0,0)` uppmätt i ar).
8. "Ångrat."-kvitto efter Ångra — badge 4→3 verifierat, tystnad borta.

## 2026-08-27 — Deltagarincident: felstavad svarsadress + skydd mot det

### Vad hände
Deltagare (ibrahimabdulkadir222@hotmail.com) skickade 4 ansökningar via
direktutskicket — allt fungerade, men inga kopior kom fram. Diagnos via
Management API: profilens mejlfält var felstavat ("abdulkHadir", extra h).
Kopior + arbetsgivarsvar gick tyst till fel adress. Servern gjorde rätt;
grundorsaken var att ett handskrivet mejlfält var enda källan till
svarsadressen, hos en målgrupp som stavar adresser för hand.

### Åtgärdat
1. Adressen rättad direkt i databasen (villkorad UPDATE, verifierad).
2. **Skydd i appen** (prod `b0d2faf`): mejlfältet förifylls med den
   OTP-verifierade inloggningsadressen för nya profiler; skiljer sig fältet
   från inloggningen visas varning + rättningsknapp "Använd <adress>"
   (sv/ar/so). Blockerar inte — avsiktligt annan adress tillåten.
3. Kvarstående risk dokumenterad: lokal profil vinner över molnet
   (`local.profile ?? remote.profile`), så deltagarens TELEFON måste också
   rättas — öppna Profil, tryck rättningsknappen, Spara. De 4 redan skickade
   ansökningarna har fel reply-to; svarar en arbetsgivare på dem studsar det
   eller når fel adress — går inte att rätta retroaktivt.

## 2026-08-26 — Skicka ansökan direkt med CV:t som riktig bilaga

### Byggt
Mahads dom över länklösningen: "länk ser shady ut, ingen vågar klicka". Rätt
svar är riktig bilaga, och en mejllänk kan aldrig bifoga en fil — alltså
server-side: `api/send-application.ts` (Vercel-funktion) skickar via Resend
från verifierade `arbetsklivet.se` med PDF:en bifogad. En knapp i appen
("Skicka ansökan med CV"), bekräftelse med mottagare/bilaga/svarsadress,
lyckat utskick loggar ansökan direkt. Svar går till deltagaren (reply_to),
kopia till deltagaren (bcc).

### Säkerhetsmodell
- Funktionen kräver deltagarens egen Supabase-JWT och läser namn, svarsadress
  och CV med deltagarens token — RLS avgör ägarskap, ingen service_role,
  omöjligt att skicka i någon annans namn eller med någon annans CV.
- Dagstak 20/konto/dygn via `sokt_send_log` (RLS, append-only, migration
  20260826150000 — körd och verifierad) så domänen inte blir spamrelä.
- Utan `RESEND_API_KEY` i Vercel svarar GET `{configured:false}` och appen
  visar exakt gamla flödet — funktionen vilar tills nyckeln läggs in.

### Beslut
- **Resend, inte Gmail-API, som huvudväg.** Gmail-utkast kräver per-användare-
  OAuth och Googles granskning över 100 användare — osäljbart, och utestänger
  alla med Hotmail. Resend fungerar för varje deltagare oavsett mejlleverantör.
  Gmail-utkastknappen finns kvar som fallback för den som kopplat Google.
- **Signerade CV-länken borttagen** (createCvLink/ensureCvLink) — ersatt av
  riktig bilaga, ingen död kod kvar.

### Kvalitetsgrindar
typecheck ✅ lint ✅ test ✅ (158) build ✅. Prod `6a2591b`, endpointen svarar.

### Skarptest 2026-08-27 — BEVISAT hela vägen (aldrig mot riktiga arbetsgivare)
RESEND_API_KEY inlagd av Mahad → `{configured:true}`. Testkedjan, helt via
produktions-API:erna: OTP beställd → koden läst ur Gmail → inloggad →
profilrad + CV upplagt via kontots egna rättigheter (bucket-RLS släppte in
ägaren = policyerna verifierade skarpt) → POST till funktionen → 200 →
sändloggen räknade båda utskicken → mejlet öppnat i inkorgen: avsändare
`ansokan@arbetsklivet.se`, korrekt brödtext och **bilagan Mahad_Hussen_CV.pdf
(application/pdf) på plats**. Två testmottagare, båda Mahads egna adresser.

## 2026-08-26 — CV:t följer med som länk i ansökningsmejlet

### Byggt
Deltagaren skulle förut ladda ner CV:t och bifoga det manuellt — för många steg.
Nu skapas en signerad nedladdningslänk (90 dagar, `createSignedUrl` med
`download: filnamn`) till CV:t i bucketen, och läggs automatiskt i mejltexten
för mailto/Gmail/Outlook: "Mitt CV: <länk>". `ensureCvLink` i storen laddar upp
CV:t först om det bara finns lokalt. Utan konto, eller om länken inte hunnit
skapas vid klick, faller flödet tillbaka på nedladdning + bifogning — inget
glapp. Länken nollas vid CV-byte/borttagning/kontobyte. Statustext (sv/ar/so):
"följer automatiskt med som länk". Även självläkning av inaktuella chunk-namn
efter deploy (`vite:preloadError` → en omladdning med loopvakt).

### Beslut
- **Länk i brödtexten, inte bilaga.** En webblänk kan aldrig bifoga en fil, och
  Gmail-API-vägen kräver per-användare-OAuth (pausad). Signerad länk fungerar i
  alla mejlklienter, på telefon, utan Google-krångel. Gmail-utkastknappen (med
  äkta bilaga) finns kvar för den som kopplat Google.
- **Alltid svenska i mejlraden** ("Mitt CV:") — mejlet går till svensk
  arbetsgivare oavsett appens språk, samma regel som AF-rapporten.

### Kvalitetsgrindar
- typecheck ✅, lint ✅, test ✅ (158), build ✅. Deployad till produktion
  (`2e728b0`), laddar utan konsolfel. Inloggat E2E-flöde verifieras av Mahad.

## 2026-08-26 — CV följer kontot mellan enheter + iOS-fix

### Bakgrund
En deltagare fick sitt CV inlagt på datorn (inloggad), men på telefonen (samma
konto) syntes ingenting, och uppladdning på telefonen gav *"Error preparing
Blob/File data to be stored in object store"*. Två grundorsaker, båda i koden.

### Byggt
- **iOS-säker lagring.** `fileStore` lagrade det råa `File`-objektet i IndexedDB.
  iOS Safari vägrar strukturklona en Blob dit — exakt felet ovan. Ny ren modul
  `cvBytes` konverterar till `ArrayBuffer` + mimetyp vid skrivning och återskapar
  `Blob` vid läsning, med bakåtkompatibel läsning av gamla blob-poster. Rundturstest.
- **CV-synk via privat Storage-bucket.** Ny migration `20260826120000_cv_lagring.sql`:
  bucket `cvs` (privat, 10 MB), RLS på ägarmappen (`(storage.foldername(name))[1]
  = auth.uid()::text`), väg `<user_id>/cv`, plus tre kolumner på `profiles`
  (`cv_file_name`, `cv_text`, `cv_byte_size`).
- **`cloudSync`:** `uploadCvFile` / `downloadCvFile` / `removeCvFile`. Metadata
  skrivs med **upsert**, inte update — en ny enhet kan ladda upp CV:t innan
  profilraden hunnit synkas; en update hade träffat noll rader tyst och CV:t
  aldrig synts på nästa enhet. `pull()` returnerar `cvMeta`.
- **`store`:** `uploadCv` speglar till molnet (fel = `syncError`, aldrig
  blockerande), `syncNow` laddar ner CV:t på en ny enhet och laddar upp ett
  lokalt-bara CV, `removeCv` och `deleteAccount` städar bucketen.
- **Ärliga samtyckestexter** (sv/ar/so): den gamla "inget skickas till någon
  server" stämde inte längre för inloggade — nu synkas även CV:t till kontot.

### Beslut
- **CV:t måste lämna enheten.** Den dokumenterade begränsningen "CV-synk saknas"
  var medveten, men en riktig deltagare träffade den. Cross-device kräver
  molnlagring — privat bucket med ägarmapp-RLS, samma isoleringsmodell som raderna.
- **Upsert av CV-metadata, inte update.** Se ovan: annars osynligt CV på nästa enhet.
- **En fil per konto** (`<user_id>/cv`, upsert) — inget versionsträd, CV:t är en
  ersätt-och-glöm-artefakt.

### Kvalitetsgrindar
- `npm run typecheck` ✅, `npm run lint` ✅, `npm test` ✅ (158), `npm run build` ✅.
- Röktest i webbläsare: appen laddar utan konsolfel, nya samtyckestexten live.

### Kräver att Mahad kör (mot riktig databas — jag rör den aldrig)
- Migrationen `20260826120000_cv_lagring.sql` i Supabase SQL Editor.
- Därefter: be deltagaren logga in igen på telefonen — CV + profil ska komma ner.

## 2026-07-28 — Milestone 17: Radera kontot

### Byggt
- **`delete_own_account()`** i migrationen — SECURITY DEFINER, eftersom anon-nyckeln aldrig får röra
  `auth.users`. Funktionen läser `auth.uid()` ur JWT:n i stället för att ta ett argument, så en
  användare kan inte begära att någon annans konto raderas. `ON DELETE CASCADE` tar ansökningar och
  profil med sig.
- **"Radera mitt konto"** i kontopanelen med tvåstegsbekräftelse, sv/ar/so. Panelen säger rakt ut att
  uppgifterna på den egna enheten INTE raderas — de tas bort separat under Profil.
- `AuthPort.deleteAccount()`; den avstängda implementationen avvisar anropet i stället för att låtsas
  lyckas.

### Beslut
- **Den som kan skapa ett konto måste kunna ta bort det, i appen.** Utan det är "radera" ett påstående
  och inte en funktion, och Sökt är öppet för vem som helst — det finns ingen coach att mejla.
- **Kontoradering rör inte enhetens data.** Två skilda saker, två skilda knappar. Att smyga med en
  lokal radering i en molnradering vore precis den sortens överraskning som gör att man inte vågar
  trycka på något.

### Inte verifierat
Kräver ett riktigt Supabase-projekt. Knappen syns bara när man är inloggad, så den går inte att köra
mot attrapp-nycklar. Testfallet ligger i SETUP_KONTO.md steg 7.

144 tester, typkontroll, lint och bygge gröna.

## 2026-07-28 — Milestone 16: Konto med sexsiffrig kod, och synk mellan enheter

### Byggt
- **`services/auth.ts` + `services/supabaseClient.ts`** — inloggning med e-post och sexsiffrig
  engångskod (Supabase Auth `signInWithOtp`/`verifyOtp`, mejlet levererat av Resend som SMTP).
  Vi genererar, lagrar och kontrollerar **inte** koder själva: rate limiting, brute force-skydd,
  token-förnyelse och sessionslagring är precis de delar som är lätta att göra subtilt och farligt
  fel. Inget lösenord — att hitta på, minnas och återställa ett är tre separata sätt att bli utelåst
  för den här målgruppen.
- **Kontot är frivilligt.** Utan `VITE_SOKT_SUPABASE_*` finns ingen inloggningsknapp, och
  supabase-js laddas aldrig ner (verifierat: bara vår egen 3,6 kB-modul hämtas). Appen fungerar
  exakt som förut lokalt. Det är inte en reservlösning utan produktens grundläge.
- **`model/sync.ts`** (ren, testad) — `mergeRemote`. Reglerna finns för att synken ska vara
  *oförmögen* att tappa en ansökan: rader bara denna enhet har LADDAS UPP (en månad offline får inte
  kosta en månad), rader bara kontot har LÄGGS TILL, rader kontot markerat raderade TAS BORT även
  här, och en lokal rad skrivs aldrig över av kontots kopia.
- **Mjuk radering (`deleted_at`).** Utan den går en saknad rad inte att skilja från en rad som ännu
  inte laddats upp — nästa synk skulle återuppliva den och deltagaren blir aldrig av med den.
- **Per-post-skrivningar.** `Command` fick `sync`/`syncUndo`, så varje ändring speglas som EN rad.
  Den gamla `save(hela modellen)` var last-write-wins och fire-and-forget: med två enheter (eller
  två flikar) hade den andra skrivningen tyst raderat den förstas arbete. Det var den kända
  blockeraren för allt molnarbete, och den är borta nu.
- **Sparfel syns.** `persist()` fångar ett avvisat `save` och visar en banner. Tidigare svaldes
  ett `QuotaExceededError` av `void storage.save(...)` — raden låg på skärmen, räknaren tickade upp,
  och allt var borta vid omladdning.
- **`model/credentials.ts`** (ren, testad) — normaliserar e-post och kod. Koden klistras in med
  mellanslag, hårda mellanslag eller bindestreck ur mejlappen; adressen kommer med stor
  begynnelsebokstav från telefonens tangentbord. Att avvisa det är inte stringens, det är en låst
  dörr.
- **`supabase/migrations/20260728120000_sokt_konto_och_synk.sql`** — `applications` + `profiles`
  med RLS där varje användare bara når sina egna rader. `WITH CHECK` på insert/update, inte bara
  `USING`, annars kan man skriva rader åt någon annan.
- **`SETUP_KONTO.md`** — de steg som kräver Mahads konton (Supabase-projekt, Resend-domän, DNS,
  SMTP, mallen med `{{ .Token }}`).

### Beslut (med alternativ)
- **Eget Supabase-projekt, inte Pathlys.** Sökt är öppet för vem som helst. Publika användare ska
  inte ligga i en leverantörs tenant-databas när verktyget ska säljas till flera R&M-leverantörer,
  och Pathlys `handle_new_user` gör dessutom varje ny inloggning till handläggare i company 1.
  Bonus: deltagaren äger sitt eget konto och kan senare VÄLJA att dela med en coach — det är det
  enda sättet att få ett samtycke som är frivilligt enligt GDPR art. 7.4, eftersom coachen annars
  styr deltagarens programdeltagande.
- **Supabase Auth, inte egen OTP mot Resend.** Alternativet (egen kod, egen tabell, egna sessioner)
  är en stor säkerhetsyta för en ensam utvecklare. Resend används där det hör hemma: som SMTP.
- **`noValidate` på formulären.** `type="email"` behålls för tangentbordet, men webbläsarens egen
  valideringsbubbla kommer på *webbläsarens* språk — en arabisk- eller somalisktalande på en svensk
  telefon hade rättats på svenska. Vår text är översatt.
- **Synkfel är inte dataförlust.** Den lokala skrivningen har redan lyckats, så ett misslyckat
  moln-anrop rapporteras som "inte synkat än" och nästa `syncNow()` tar raden från den lokala sidan.

### Verifierat i webbläsare (375 px)
Utan nycklar: ingen inloggningsknapp, supabase-js hämtas inte alls, appen oförändrad.
Med attrapp-nycklar: knappen syns, panelen renderar, felaktig adress ger "Kontrollera
e-postadressen." (vår översatta text, inte webbläsarens), och "Skicka kod" mot en påhittad
Supabase-URL ger "Ingen kontakt med servern. Kontrollera din uppkoppling." och lämnar användaren kvar
på e-poststeget. 144 tester.

**Inte verifierat mot ett riktigt projekt** — det kräver Supabase + Resend enligt SETUP_KONTO.md.
Hela kedjan (kod i mejlet → inloggning → synk mellan två enheter) ska köras igenom när nycklarna
finns.

### Öppet innan riktiga användare släpps in
- **Radera kontot** går i dag bara via Supabase-dashboarden. "Radera" måste betyda radera.
- CV-synk saknas (står uttryckligen i kontopanelen).
- Delning med coach: separat, och deltagarens eget val.

## 2026-07-28 — Milestone 15: Säkerhetskopia som faktiskt går att läsa tillbaka

### Byggt
- **`model/backup.ts`** (ren, testad) — filformatet `{sokt:'backup', version, exportedAt, profile,
  applications, savedSearches, cv}`. `parseBackup` validerar och **räddar det som går att läsa**
  i stället för att kasta allt: en trasig rad hoppas över och räknas, resten återställs. Vägrar med
  ett begripligt skäl när filen inte är en Sökt-kopia eller kommer från en nyare version.
- **`mergeBackup`** — återställning får aldrig förstöra. Ansökningar slås ihop på id, en profil som
  redan finns på enheten vinner över filens, och ett CV som redan finns rörs inte. Att läsa in samma
  fil två gånger lägger till noll.
- **CV:t följer med filen** (base64, chunkad kodning — att spreada en flermegabyte-Uint8Array in i
  `String.fromCharCode` spränger stacken). Den gamla exporten kallade sig "allt du sparat" men
  lämnade kvar CV-blobben, och **ingenting i hela kodbasen kunde läsa tillbaka den**. En
  säkerhetskopia är bara en säkerhetskopia om den återställer.
- **AI-nyckeln är avsiktligt inte med.** Den är en hemlighet, inte deltagarens data.
- **`model/validate.ts`** (ren, testad indirekt) — riktiga typvakter för `Application`/`Profile`.
  `deserializeModel` validerade tidigare bara `Array.isArray`, så en enda trasig rad gick rakt in i
  render-trädet och blankade appen — varefter deltagaren inte ens kunde nå Exportera eller Radera,
  eftersom de knapparna satt i appen som just dog. Nu kastar den i stället, vilket leder till
  säkerhetskopie-vägen från M12 där rådata bevaras och lämnas tillbaka.
- **`navigator.storage.persist()`** begärs vid boot. Utan den rensar Safaris ITP allt efter sju dagar
  utan besök — och en arbetssökande söker jobb, hen kollar inte appar.

### Beslut (med alternativ)
- **Sammanslagning, inte överskrivning.** En återställning på en enhet som redan har data behåller
  allt den hade. Alternativet (ersätt allt) är enklare att resonera om men gör en felklickad
  återställning till en katastrof.
- **Ingen "Ångra" på återställning.** Det är en bulkskrivning, inte ett kommando i historiken; att
  erbjuda Ångra hade varit en lögn. Historiken nollställs i stället.
- **Vakterna kastar i stället för att tyst filtrera bort rader.** Att tappa en rad ur en rapport som
  går till Arbetsförmedlingen får inte ske i tysthet. Kastet leder till bannern med säkerhetskopian.

### Verifierat i webbläsare (375 px)
Export → filen innehåller `sokt:'backup'`, version 1, tidsstämpel och ansökan (CV-fältet saknas
korrekt när inget CV finns). Ta bort ansökan → import → "1 ansökningar tillagda", raden tillbaka i
localStorage. Samma fil igen → "0 ansökningar tillagda" (inga dubbletter). Främmande JSON → "Filen är
inte en säkerhetskopia från Sökt" och orörd data. `navigator.storage.persist()` returnerar false på
en färsk localhost-origin — webbläsaren avslår själv, verifierat med ett direkt anrop; Chrome ger
persistens vid engagemang/installation, vilket är ännu ett argument för PWA-manifestet härnäst.

### Noterat, inte åtgärdat
Efter "Radera all data" (och i en färsk webbläsare) måste samtycket ges innan Profil-fliken renderas,
alltså innan man kommer åt "Läs in säkerhetskopia". Ett tryck extra, men det hör till den större
frågan om samtyckesgrinden som ändå ska omprövas.

129 tester.

## 2026-07-28 — Milestone 14: Dubbletter, sökt-markering och en väg tillbaka

### Byggt
- **`apply/duplicates.ts`** (ren, testad) — `appliedTo(applications, job)` och
  `findDuplicate(applications, kandidat, withinDays = 60)`. Ingenting kontrollerade detta tidigare:
  nästa vecka kom samma annonser tillbaka och såg orörda ut, så deltagaren antingen sökte igen eller
  loggade samma ansökan två gånger. En dubblettrad är precis vad som får en aktivitetsrapport
  ifrågasatt — och samma annons finns på riktigt två gånger i Sökt, en gång från Platsbanken och en
  gång via JobAd Links, med olika id och olika url.
- **Matchning på annonsens url först, annars arbetsgivare + titel** — vikta genom `fold` från
  `jobs/occupations`, så "Städare" och "stadare" är samma jobb. Tidsfönstret gäller bara
  arbetsgivare+titel: samma roll hos samma arbetsgivare ett halvår senare är en riktig andra
  ansökan, inte ett misstag. Url-matchningen är tidlös — samma annons är samma annons.
- **Sökt-markering på jobbkortet** — "✓ Du sökte den {datum}" och grön ram.
- **Dubblettvarning** i både Ansök-panelen och det manuella formuläret. Varnar, blockerar aldrig:
  bara deltagaren vet om den andra ansökan var avsiktlig.
- **Bekräftelse med Ångra.** Att logga en ansökan fällde tidigare ihop panelen utan någon signal
  alls, och "Ta bort" var ett enda oåterkalleligt klick — medan `undo()` låg färdigimplementerad i
  store.ts utan en enda anropare i hela UI:t. Nu sätter både logga och ta bort en `notice` som visas
  som en rad högst upp med knappen "Ångra".

### Beslut (med alternativ)
- **Ångra i stället för bekräftelsedialog före radering.** En dialog framför varje radering straffar
  alla för ett sällsynt misstag; en ångra-knapp efteråt kostar ingenting förrän man behöver den.
  Dessutom fanns maskineriet redan — det saknades bara en knapp.
- **`notice` nollställs i `execute()`.** Ett ångra-erbjudande får aldrig överleva kommandot det
  beskriver: `undo()` ångrar sista kommandot i historiken, så om något annat hunnit köras skulle
  knappen ta bort fel sak. Rensas också automatiskt efter åtta sekunder.
- **Varning, inte spärr, vid dubblett.** Alternativet (blockera) hade gjort en legitim andra ansökan
  omöjlig att logga, och rapporten hade blivit fel åt andra hållet.

### Verifierat i webbläsare (375 px, riktiga API:t)
Manuell ansökan → grön rad "Ansökan loggad ✓" med Ångra. Ta bort → "Ansökan borttagen." → Ångra →
raden tillbaka i listan OCH i localStorage. Manuellt formulär med "lagerarbetare" / "AHMEDS LOGISTIK
AB" → dubblettvarning trots annan skiftläge. Sökning på städare → logga ansökan från kortet → kortet
får grön ram och "✓ Du sökte den 2026-07-28".

119 tester.

## 2026-07-28 — Milestone 13: Manuell ansökan (rapporten blir fullständig)

### Byggt
- **`apply/buildManualApplication.ts`** (ren, testad) — bygger en `Application` av det deltagaren
  själv skriver in, för jobb hen sökt utanför Sökt: på plats, via telefon, från coachens tips, från
  en annons hittad någon annanstans. Fram tills nu gick `addApplicationCommand` att nå från exakt
  ETT ställe (Ansök-panelen på ett sökträffskort), så allt annat gick helt enkelt inte att registrera.
  Aktivitetsrapporten täckte alltså bara den del av aktiviteten som råkat gå genom appens sökruta.
- **`validateManualApply`** returnerar fältnycklar, inte meningar. Rena moduler kan inte översätta,
  och ett kastat svenskt felmeddelande hade varit oläsbart i en app som skeppar arabiska och somaliska.
  UI:t översätter nycklarna till fältnära fel i stället för en textrad längst ned.
- **Formulär i Ansökningar-vyn** bakom "+ Lägg till en ansökan du gjort själv". Sex AF-fält, inget
  mer: datum förifyllt med dagens (lokala) datum, ort förifylld från profilen. i18n sv/ar/so.

### Beslut (med alternativ)
- **Samma vägran att gissa som `buildApplication`.** Ofullständig post byggs inte — rapporten går
  till Arbetsförmedlingen, och en påhittad arbetsgivare eller anställningsform i ett myndighets-
  dokument är värre än en saknad rad. Alternativet (spara som utkast med tomma fält) valdes bort:
  ett utkast som ser färdigt ut i listan är en fälla.
- **`channel: 'manual'`, ingen fråga om hur man sökte.** Kanalen är spårbarhet, inte ett rapportfält
  (`activityReport` läser bara de sex AF-fälten). Att fråga hade lagt till en ruta utan att göra
  rapporten mer korrekt.
- **Inga nya aktivitetstyper (kontakt med arbetsgivare, rekryteringsträff, utbildning) ännu.** De hör
  hemma i AF:s rapport men kräver en modelländring och därmed `SCHEMA_VERSION` 2 — som är spärrat
  tills `migrate()` finns (M12). Nästa steg, i rätt ordning.

### Verifierat i webbläsare (375 px)
Tomt formulär → fyra fältfel, ingenting skrivet till localStorage. Ifyllt → rad i Ansökningar,
`channel: "manual"` i lagringen, formuläret stängs, och raden syns i aktivitetsrapporten för juli.
Formuläret renderar rent på arabiska (`dir=rtl`) utan att sidan scrollar i sidled.

108 tester.

## 2026-07-28 — Milestone 12: Vecka 1 efter granskningen (grund för deltagaren)

Föregicks av en granskning med tre agenter (deltagar-UX, Pathly-integration, teknik) plus en
adversariell kritiker. Kritikern kullkastade flera av förslagen; det som byggdes här är kritikerns
prioritering, inte granskarnas. Se "Byggs INTE" nedan — den listan är lika viktig som det byggda.

### Byggt
- **`report/periods.ts`** (ren, testad) — `todayIso`/`toIsoDate` läser LOKALT datum, aldrig
  `toISOString()`. Sverige är UTC+1/+2, så mellan midnatt och 01/02 gav den gamla `todayIso()` i
  JobsView gårdagens datum som default på en ansökan — in i en månad vars rapport kan vara inlämnad.
  Samma modul äger nu perioden: `reportPeriod(now)` ger FÖREGÅENDE månad så länge AF:s
  rapportfönster (1–14) är öppet, annars innevarande. Rapport- och översiktsvyn delade tidigare en
  kopierad `currentMonthRange()` som defaultade fel under exakt de två veckor någon öppnar fliken.
- **Deadline-rad i rapportvyn** — "Lämna rapporten i Mina sidor senast den 14:e — {n} dagar kvar",
  bara medan fönstret är öppet.
- **`jobs/occupations.ts`** (ren, testad) — JobTech-API:t viker inte diakriter. Verifierat live:
  `stadare` → 0 träffar, `städare` → 733; `underskoterska` → 0, `undersköterska` → 26. Deltagare med
  arabiskt/somaliskt tangentbord gick alltså in i en tyst återvändsgränd på appens viktigaste
  kontroll. Vid noll träffar viks sökningen och matchas mot en kurerad yrkeslista → knappen
  "Menade du städare?". Brute force är uteslutet (54 stavningar för "lokalvardare" = 54 anrop).
  Listan är samtidigt fröet till en yrkesväljare, som är den riktiga långsiktiga lösningen.
- **Ärliga siffror i sökningen.** Kryssrutan visar nu "Bara enkel ansökan — 47 av 100 jobb", och
  resultatraden syns även när filtret tömmer listan. Den gamla texten ("43 enkla ansökningar av 729
  annonser") blandade två olika populationer: 43 kom ur de 100 hämtade, 729 var API:ts totalsumma.
- **Tomt läge är aldrig en återvändsgränd.** Noll enkla ansökningar ger knappen "Visa alla
  ansökningssätt (100 jobb)"; noll träffar totalt ger stavningsförslaget. Filtret filtrerar nu
  lokalt på redan hämtade annonser — omedelbart, utan nytt anrop.
- **Säkerhetskopia vid oläsbar data.** `storage.load()` kastar `StorageReadError` i stället för att
  se ut som "tomt", och lägger undan råsträngen under `sokt.model.v1.trasig` (första kopian vinner)
  innan appen börjar skriva över den. Store skiljer nu "saknas" från "gick inte att läsa" och visar
  en banner: ingenting är raderat, ladda ner kopian och visa den för din coach.
  Detta var den enda vägen till total dataförlust i produkten: `deserializeModel` kastar på ALLA
  schemaversioner ≠ 1 och det finns ingen migrate(), så en framtida `SCHEMA_VERSION`-höjning hade
  tömt varje installation vid nästa klick.
- **E-post före formulärlänk** i `mapApplicationChannel`. En annons kan bära båda; att läsa url
  först stängde ute dem från enkel ansökan trots att ett vanligt mail gick lika bra. Mätt effekt
  live: städare 43 → 47 enkla av 100 hämtade.
- **Mobil-CSS.** Filen hade noll `@media` på 545 rader. Dokumentet var 492 px brett vid 375 px
  viewport, så två flikar låg utanför skärmen och tabellerna sköt ut sidan till 794 px. Nu:
  `overflow-x: hidden` på body, scrollande flikremsa med snap, `.table-wrap` runt båda tabellerna,
  44 px träffytor, 16 px inputs (annars zoomar iOS Safari), staplad sökform och jobbkort på telefon.
  RTL: `.tag` och chips använder logiska egenskaper, så arabiskan får rätt sida.
- **Tom sökning cachas inte längre** — den skrev över offline-cachen och gav ett blankt flöde vid
  nästa kallstart. Cachen sparar nu ofiltrerade annonser, så filtret går att slå om offline.

### Verifierat i webbläsare (375 px, riktiga API:t)
`stadare` → 0 träffar → "Menade du städare?" → 47 jobb. Kryssrutan "47 av 100 jobb", raden
"47 jobb med enkel ansökan. 730 annonser finns totalt." Toggle av → 100 kort utan nytt anrop.
`document.scrollWidth` 375 = viewport (var 492). Femte fliken nåbar via remsan. Planterad v2-modell
→ banner + `sokt.model.v1.trasig` med originalet intakt. Rapportfliken 2026-07-28 → 1–31 juli,
ingen deadline-rad (fönstret stängt) — precis som avsett.

### Beslut (med alternativ)
- **Kurerad yrkeslista, inte typeahead eller brute force.** JobTechs `/complete` viker inte heller
  diakriter (testat: `underskoterska` → tom, `undersk` → träff), så den kan inte rädda den vanligaste
  felstavningen. Listan är deterministisk, kostar noll anrop och blir yrkesväljaren senare.
- **Kryssrutan "Bara enkel ansökan" står kvar PÅ.** Granskningen ville ha den av (den döljer ~74 %
  av annonserna). Kritikern hade rätt: filtret ÄR produkten — utan det möter deltagaren
  Workbuster-/Teamtailor-formulär hen inte kan slutföra, och lär sig på ett möte att appen inte
  fungerar. Kompromissen är siffror på kryssrutan och en väg ut ur det tomma läget.
- **Säkerhetskopia före export/import.** Granskningen ville bygga import/export först. Den hjälper
  bara den som redan hade tagit en kopia — alltså inte den som drabbas. En rad i `load()` räddar
  alla; import/export ligger kvar som nästa steg.
- **Perioden ligger i report/, inte i vyerna.** `currentMonthRange()` var kopierad i två vyer med
  samma fel i båda. Regeln är domänlogik och testas som sådan.

### Byggs INTE (medvetet bortvalt efter kritiken)
- Slå av "enkel ansökan" som default; automatisk fallback-stege som muterar sökningen i tysthet;
  filterberget (geo-radie, län, distans, deltid-%, publicerad-efter); print-stylesheet i stället för
  jsPDF (html2canvas/dompurify laddas aldrig ner i verkligheten — 777 kB-siffran var fel, och
  ett-tapps-PDF är bättre på Android); hela annonstexten i appen; femstegs statuspipeline;
  CV-matchningspoäng för deltagaren; paginering.
- **Aldrig höja `SCHEMA_VERSION` innan `migrate()` finns.**

### Nästa (vecka 2–3, i ordning)
Manuell "Lägg till ansökan" (idag går bara jobb hittade i Sökt att logga — rapporten blir ofullständig
och det är ett efterlevnadsproblem, inte en saknad finess) → applied-markering + dubblettvarning +
synlig bekräftelse + koppla in `undo()` som "Ångra" → `navigator.storage.persist()` + export/import
med CV-blobben → PWA-manifest, QR-onboarding och ett coach-manus → minimal telemetri (idag går det
inte att skilja "inga användare" från "tyst dataförlust").

## 2026-07-08 — Milestone 11: PDF-export av aktivitetsrapporten

### Byggt
- **`ui/reportPdf.ts`** — `buildReportPdf(rows, start, end)` med jsPDF (MIT, lazy-laddad). Blocklayout (två rader per ansökan) som aldrig spränger sidbredden och paginerar rent; rubrik med period, antal och källa. Government-dokument → alltid svenska (som text/CSV), oberoende av UI-språk. `downloadReportPdf` triggar nedladdning.
- **Knapp "Ladda ner PDF"** i ReportView bredvid CSV. Lazy `import('./reportPdf')` så huvudbundeln förblir 84 kB gzip (jsPDF 130 kB laddas bara vid klick).
- Test: giltig PDF (`%PDF-`, byte-storlek), sidbrytning vid många rader, tom period kraschar inte.

### Beslut
- **PDF-rendering i ui-lagret, inte report/.** Den rena rapportderiveringen (`activityReport`) ligger kvar i report/; jsPDF är en render-/UI-sak. Blocklayout valdes framför bred tabell för robusthet mot långa titlar/arbetsgivare och ren paginering.

## 2026-07-08 — Milestone 10: Fler jobbkällor (JobTech JobAd Links)

### Byggt
- **Andra sanktionerade källan.** `services/joblinks.ts` mot JobTech JobAd Links (`links.api.jobtechdev.se/joblinks`) — officiell AF-öppen-data som länkar annonser från andra svenska jobbsajter (ingenjorsjobb.se, ledigajobb.se, studentjob.se, offentligajobb.se m.fl.). Ingen skrapning.
- **Ren mapper med dubblettfiltrering.** `jobs/mapJobLinksAd.ts` släpper igenom bara annonser UTAN arbetsformedlingen.se-länk (resten är dubbletter av Platsbanken-flödet) och länklösa annonser. `Job.source` union: `'platsbanken' | 'joblinks'`. Testad.
- **Egen UI-sektion.** Externa jobb visas i en hopfällbar sektion under huvudträffarna, med källmärkning (host som `tag-source`) och en tydlig not: ansökan sker på deras sajt, omfattas inte av "enkel ansökan". Andra källan hämtas parallellt och dess fel bryter aldrig huvudsökningen. i18n sv/ar/so.

### Beslut (med alternativ)
- **JobAd Links, inte scraping/andra API:er.** Användaren frågade om alla jobb bara kom från Platsbanken. JobAd Links är JobTechs officiella aggregat av externa annonser — samma öppna data-familj, tillåtet enligt reglerna. Alternativ: skrapa jobbsajter (förbjudet) eller integrera varje sajts API (finns inte/otillåtet). Mätt unik andel (ej AF): ~0–7 % för lokalvårdare/diskare, 10–17 % för säljare/systemutvecklare — värdefullt främst för tjänstemannayrken.
- **Länk-annonser är aldrig "enkel ansökan".** De saknar e-postkanal (bara extern länk), så de hamnar i egen sektion, inte i huvudlistan, och krockar inte med namn+CV+brev-löftet.

## Slutstatus 2026-07-07
M0–M9 byggda, testade (64 tester), verifierade i webbläsare mot riktiga API:t, mergade till main via en PR per milstolpe. Produkten uppfyller BUILD_SPECs Definition of Done och GOALS M0–M2 samt de backend-oberoende delarna av M3. Återstående punkter dokumenterade ovan.

## 2026-07-07 — Milestone 9: JobStream-freshness (lokal cache)

### Byggt
- **`jobs/freshness.ts`** (ren, testad) — `CachedSearch`-typ + `minutesAgo`.
- **Freshness-cache** — senaste lyckade sökningen (resultat + filter + tidsstämpel) sparas i `sokt.lastsearch.v1`, återställs på nästa öppning (offline inkluderat), med "Senast hämtad …". Rensas vid deleteAll. Lokal tolkning av "JobStream mirror for freshness"; äkta mirror kräver backend (se NEEDS-DECISION).

## 2026-07-07 — Milestone 8: AI-brev (provider + valfri egen nyckel)

### Byggt
- **`apply/letterProvider.ts`** (ren, testad) — `chooseProvider(key)`: anthropic om nyckel finns, annars deterministic (default).
- **`services/letterAi.ts`** — Anthropic-anrop (browser-direct, modell claude-haiku-4-5) som förbättrar brevet. Endast brevinnehåll, aldrig rapportfält.
- **AI-nyckel i profil** — valfri, sparas lokalt (`sokt.aikey.v1`), UTESLUTS ur dataexporten, rensas vid deleteAll. "Förbättra med AI"-knapp i ansök-vyn; utan nyckel visas hint, deterministiskt brev fungerar alltid.
- i18n sv/ar/so.

### Beslut
18. **BYO-nyckel i browsern, deterministiskt som default.** Den lokala stacken har ingen backend/nyckel; äkta AI levereras via användarens egen Anthropic-nyckel (browser-direct-header). Deterministiskt brev är default och alltid gratis/offline. Verifierat med stubbat fetch (rätt endpoint/headers/modell/prompt, brevet uppdateras); skarp körning kräver riktig nyckel.

## 2026-07-07 — Milestone 7: Sparade sökningar — "nya sedan sist"

### Byggt
- **`newJobIds(currentIds, seenIds)`** (ren, testad) — lokala "alerts" utan backend: nya annons-id sedan sökningen senast kördes.
- **SavedSearch.seenJobIds** + store `markSearchSeen`. När en sparad sökning körs visas "N nya sedan sist" (eller inga), och sedda id sparas. i18n sv/ar/so.

## 2026-07-06 — Milestone 6: Coach- och provideröversikt

### Byggt
- **`report/applicationStats.ts`** (ren, testad) — total, urvalsfrågor besvarade, per anställningsform, per ort (sorterad), per ISO-vecka. Robust isoWeek-algoritm (testad mot årsskifte).
- **Översikt-flik** — statistikkort + stapellistor, byggd ovanpå activityReport (härleds enbart ur Application). Att gå igenom med coach/provider. i18n sv/ar/so.

# WORKLOG

## NEEDS-DECISION (löst)
- **Supabase inför M1 → körs helt lokalt.** Beslut 2026-07-03: användarens Supabase-projekt är fullt, så M1 byggs på den lokala stacken (localStorage + IndexedDB) bakom samma `StoragePort`. Auth utgår; en profil per webbläsare. GDPR-konsekvens: personuppgifter lämnar aldrig enheten, överförs aldrig till en server, och kan exporteras/raderas helt av användaren. "Kryptering i vila" hanteras av OS/webbläsarens egen lagring — äkta applikationskryptering kräver en backend-nyckel och skjuts till en framtida Supabase-migrering. Detta är ärligt dokumenterat i UI:t (samtyckestexten).

## 2026-07-06 — Milestone 5: Apply-hjälp (prefill/streamline)

### Byggt
- **`apply/applicantFields.ts`** (ren, testad) — ordnad lista av kopierbara uppgifter (namn, e-post, telefon, adress, ort, födelseår); tomma fält utelämnas.
- **Kopiera-panel i ansök-vyn** — "Dina uppgifter (klicka för att kopiera)", varje fält en klick-att-kopiera-chip. Streamline enligt BUILD_SPEC pkt 3 (prepares/prefills), aldrig auto-submit.
- **Födelseår** i profilen (efterfrågas ofta av externa formulär, t.ex. Ponty).
- i18n sv/ar/so.

## 2026-07-06 — Milestone 4: "Enkel ansökan"-filter

### Byggt
- **`jobs/simpleApply.ts`** (ren, testad) — `isSimpleApply(job) = kanal är e-post`. E-postansökan kräver bara namn + CV + brev; url-kanal går till externt formulär (t.ex. Ponty) vars fält vi inte kan se utan att skrapa (förbjudet), så det utesluts.
- **Standard-på-filter i Jobb-vyn** — kryssrutan "Bara enkel ansökan" är förvald. I det läget hämtas API:ts maxsida (100) och listan filtreras till e-postjobb; ärlig räknare "X enkla ansökningar (av Y annonser)". Kan stängas av för full lista. Tomt-läge när inga enkla finns. i18n sv/ar/so.

### Beslut (med alternativ)
16. **"Enkel ansökan" = e-postkanal, avgjort via JobTech-data, inte skrapning.** Användaren vill bara se jobb där det räcker med namn/CV/brev. Vi kan inte inspektera ett externt ansökningsformulär utan att skrapa (hård regel), så vi använder annonsens egen sanktionerade kanal: e-post = enkelt; url/unknown = uteslut. Alternativ: (a) skrapa formulären och räkna fält — förbjudet och ömtåligt; (b) inkludera url om domänen ser "enkel" ut — gissning, "nästan rätt"-fällan. Förkastade.
17. **Filtret är på som standard.** Användaren var tydlig: inga andra jobb. Kryssruta låter den som vill se allt stänga av. Hämtar limit 100 i enkelt läge så tillräckligt många e-postjobb visas (mätt: ~40/100 för lokalvårdare, ~29 diskare, ~44 personlig assistent, ~11 lagerarbetare).

## 2026-07-05 — Milestone 3: Flerspråk (sv/ar/so)

### Byggt
- **i18n-modul** — `i18n/translations.ts` (ren): ordbok för svenska, arabiska, somaliska; `translate(lang, key, params)` med `{param}`-interpolation och fallback (lang → sv → nyckel); `dirFor` (rtl endast arabiska); `uiEmploymentTypeLabel`/`uiSurveyLabel` för skärm. Testad.
- **Språk i store** — `lang`/`setLang`, persist i `sokt.lang.v1` (default sv). `useT`-hook.
- **RTL** — `App` sätter `document.documentElement.dir/lang`; CSS speglar tabbar, tabelljustering och textriktning för arabiska.
- **Alla vyer översatta** — App, Jobs (inkl. ansök-panel), Profile (samtycke/CV/data/profil), Applications, Report. Språkväljare i headern.

### Beslut (med alternativ)
13. **AF-rapportexporten förblir alltid svensk.** `report/`-modulens text/CSV (myndighetsdokument till Arbetsförmedlingen) behåller svenska etiketter via `employmentTypeLabel`/`surveyLabel`. Skärmtabellerna använder separata `uiEmploymentTypeLabel`/`uiSurveyLabel` i UI-språket. Alternativ: översätt exporten — förkastat, AF förväntar sig svenska.
14. **Språk utanför AF-modellen, rensas inte vid radera-allt.** Språk är en UI-preferens, inte personuppgift; egen localStorage-nyckel, överlever `deleteAll`.
15. **`translate` importerar `EmploymentType` från model — tillåtet.** i18n är UI-lagernära; beroenderegeln förbjuder bara model/jobs/report/apply att importera uppåt. i18n importeras aldrig av de rena modulerna.

### Kvalitetsgrindar
- typecheck ✅, lint ✅, 51 tester ✅, build ✅. Verifierat i webbläsare: byte sv↔ar↔so, RTL-spegling för arabiska, persistens, AF-export förblir svensk.

## 2026-07-05 — Milestone 2: Fas 2 (delvis, lokal stack)

### Byggt
- **Taxonomibaserad titelmappning** — `jobs/taxonomy.ts` (ren, testad) läser annonsens occupation/occupation_group/occupation_field till `Job.taxonomy`, och `canonicalOccupation` väljer mest specifika yrke, annars rubriken. Visas som tagg i jobbkorten när det skiljer sig från rubriken.
- **Deterministiskt per-jobb-anpassat brev** — `apply/tailorLetter.ts` (ren, testad). Om grundbrevet har platshållare ({tjänst}/{arbetsgivare}/{ort}/{namn}/{yrke}) ersätts bara de (respekterar användarens struktur), annars omsluts brevet med hälsning/inledning/signatur byggd av jobb + profil. Redigerbart i ansök-panelen, kopierbart, prefyller e-postkanalens body. Unicode-säker token-regex (\w matchar inte ä/ö).
- **Sparade sökningar** — `jobs/savedSearch.ts` (ren, testad summary), lagrade i separat localStorage-nyckel, laddade i storen, inkluderade i `exportData`, rensade vid `deleteAll`. Chips överst i Jobb-vyn, klick återkör.

### Beslut (med alternativ)
10. **Job-typen utökad med `taxonomy` (planerad M2-utökning, ej drift).** GOALS M2 kräver taxonomibaserad titelmappning; att bära taxonomin på Job är den rena platsen. Invarianterna hålls: rapportfält härleds fortfarande enbart ur Application. Alternativ: separat sidostruktur — förkastat, taxonomin hör till jobbet.
11. **AI-brev → deterministiskt brev nu, ren söm för Anthropic senare.** Riktig AI-anpassning kräver Anthropic-API bakom en backend; den lokala byggnaden har ingen nyckel (Max-abonnemang, ingen ANTHROPIC_API_KEY). Deterministisk mall/token-ersättning ger per-jobb-brev gratis och offline (free-over-paid). `tailorLetter` är synkron och ren; byt anropet mot ett async backend-anrop när nyckel finns. Rapportfält rörs aldrig.
12. **Sparade sökningar utanför AF-modellen.** De är inte rapportdata, så de ligger i egen localStorage-nyckel (som samtycke/CV) men inkluderas i GDPR-exporten. Alternativ: lägg i PersistedModel — skulle kräva schemaversion-migrering utan tydlig vinst.

### Ej byggt i denna omgång (kräver backend/auth — rapporterat)
- **AI-brev via Anthropic** — kräver backend + nyckel. Söm finns (se ovan).
- **JobStream lokal mirror** — kräver persistens/backend för att hålla en färsk spegel; JobSearch ger redan färska annonser.
- **Coach- och providervy för Rusta och matcha** — kräver multi-user/auth (Supabase); meningslös utan inloggning lokalt.
- **Flerspråk (svenska/arabiska/somaliska)** — stor i18n-yta; separat omgång.
- **Alerts på sparade sökningar** — kräver bakgrundskörning/backend.

### Kvalitetsgrindar
- typecheck ✅, lint ✅, 46 tester ✅, build ✅. Verifierat end-to-end i webbläsare mot riktiga API:t (taxonomitagg, sparad sökning, anpassat brev, mailto-prefyllning).

## 2026-07-03 — Milestone 1: MVP (lokal stack)

### Byggt
- **Jobbfilter** — yrke (fritext → `q`), ort (kommun-taxonomi → `municipality`-concept-id, kontroll ej fritextgissning), anställningsform Heltid/Deltid (`worktime-extent`-concept-id). Alla via officiella API-parametrar, korrekt totalantal.
- **Kommun-taxonomi** — 290 kommuner buntade statiskt från JobTech Taxonomy (`src/jobs/municipalities.ts`), genererade en gång, inga runtime-anrop.
- **Profil** — CV-uppladdning (PDF) med textextraktion (pdfjs-dist, Apache-2.0), lagrad i IndexedDB; personuppgifter (telefon, adress, ort); grundbrev. Nedladdningsbar.
- **Samtycke** — samtyckesgrind innan personuppgifter sparas, med ärlig lokal-lagring-text.
- **GDPR** — exportera all data (JSON), radera all data (profil, ansökningar, CV).
- **Ansökningslogg** — radera enskild ansökan.

### Beslut (med alternativ)
7. **Ort som kontroll, inte fritext.** Kommun-taxonomin (290, ändlig mängd) buntas och ort väljs från lista → concept-id → exakt API-filter. Alternativ: fritext i `q` — förkastat, fuzzy och missar/blandar träffar (langsikt: kontroller före parsers för ändliga mängder).
8. **Anställningsform-filter: Heltid/Deltid via `worktime-extent`.** Timanställd utelämnas ur *sökfiltret* (fångas ändå exakt vid ansökan från annonsen) eftersom det saknar en ren worktime-extent-motsvarighet; att gissa det client-side vore "nästan rätt"-fällan.
9. **CV i IndexedDB, inte localStorage.** En PDF spränger localStorages ~5MB. IndexedDB bakom en `FileStore`-port; `cvFileRef` pekar på nyckeln.

## 2026-07-03 — Milestone 0: walking skeleton

### Byggt
- Scaffold: Vite + React 19 + TypeScript, oxlint, Vitest, GitHub Actions CI (typecheck, lint, test, build).
- `src/model/` — Job, Profile, Application exakt enligt ARCHITECTURE.md, versionerad serialisering (schemaVersion 1) med round-trip-test.
- `src/jobs/` — mappning av JobTech JobSearch-annonser till Job, testad mot en verklig API-fixture (2026-07-03). Regler: Behovs-/timanställning → `timanstalld` (vinner över arbetstidsomfattning), annars Heltid/Deltid från `working_hours_type`, annars `unknown`. Kanal: url före e-post, annars `unknown`.
- `src/report/` — `activityReport(applications, periodStart, periodEnd)` ren derivering av Application-poster (endast `status: 'sent'`, inklusiva gränser, sorterad på datum) plus text- och CSV-export. Testad.
- `src/apply/` — `buildApplication(job, input)` bygger Application-posten deterministiskt; kräver explicit anställningsform/ort när annonsen saknar dem, validerar ISO-datum. Id skickas in av anroparen så modulen förblir ren. Testad.
- `src/services/jobtech.ts` — JobSearch-klient (enda tillåtna jobbkällan), `src/services/storage.ts` — StoragePort med localStorage-adapter, round-trip-testad mot en injicerad fake.
- `src/app/` — Zustand-store; alla ändringar går genom kommandon med apply/invert (testade), varje kommando persisterar modellen via StoragePort.
- `src/ui/` — flikar Jobb / Profil / Ansökningar / Aktivitetsrapport. Ansök-panelen öppnar annonsens sanktionerade kanal (url/e-post) och loggar ansökan med alla sex AF-fälten. Rapportvyn: periodval, kopiera som text, ladda ner CSV. CC-BY-SA-attribution i sidfoten.
- `src/architecture.test.ts` — beroenderegeln (model/jobs/report/apply importerar aldrig ui/render/services/app) körs som test.

### Beslut (med alternativ)
1. **Persistens i M0: localStorage-adapter bakom `StoragePort`, inte Supabase.** Det finns inget Supabase-projekt/nycklar ännu, och GOALS M0 kräver bara att persistensen round-trippar. Alternativ: (a) skapa Supabase-projekt nu — kräver kontouppgifter, blockerar; (b) mocka Supabase-klienten — testar ingenting verkligt. Porten är designad så att Supabase-adaptern i M1 är en drop-in. **NEEDS-DECISION (ej blockerande): Supabase-projekt behöver skapas inför M1.**
2. **JobTech utan API-nyckel.** JobSearch svarar utan nyckel (verifierat 2026-07-03). Ingen nyckel i klienten; om rate limiting blir ett problem läggs nyckel i backend-proxy senare.
3. **Anställningsform-mappning:** `Behovsanställning`/`Timanställning` → timanställd har företräde framför Heltid/Deltid, eftersom AF-rapportens fält avser anställningsform snarare än omfattning. Alternativ: alltid ta working_hours_type — förkastat, en behovsanställd deltidare rapporteras som timanställd hos AF.
4. **Ort-fältet:** annonser kan sakna kommun (t.ex. distansjobb). `buildApplication` kräver då att användaren anger ort vid ansökan i stället för att gissa.
5. **CSV med semikolon och BOM** — svensk Excel-konvention.
6. **Id-generering (`crypto.randomUUID`) sker i UI-lagret**, inte i rena moduler, så apply/model förblir deterministiska och testbara.

### Kvalitetsgrindar
- `npm run typecheck` ✅, `npm run lint` ✅, `npm test` ✅ (se commit), `npm run build` ✅.

### Nästa
- M1: jobbfeed med riktiga filter (ort/yrke/anställningsform via API-parametrar), CV-uppladdning + parsning, Supabase-adapter + auth, GDPR-grunder (samtycke, export, radera).
