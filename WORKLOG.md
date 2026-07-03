# WORKLOG

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
