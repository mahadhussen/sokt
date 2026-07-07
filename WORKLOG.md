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
