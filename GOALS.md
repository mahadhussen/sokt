# GOALS.md

Detail in `BUILD_SPEC.md`. Rules in `CLAUDE.md`. All code conforms to `ARCHITECTURE.md`.

## Prime directive
Turn `BUILD_SPEC.md` into a working, tested product one thin slice at a time. A goal is done when it runs, its tests pass, and it is committed on a branch with the pull request updated.

## Working loop
1. Read `CLAUDE.md`, `ARCHITECTURE.md`, and this file.
2. Take the highest unchecked task.
3. Build the smallest working slice.
4. Quality gates: type check, lint, build, tests.
5. Commit, update the pull request, tick the box, note it in `WORKLOG.md`.
6. Compact context if long, continue.

> Persistens körs lokalt (localStorage + IndexedDB) bakom `StoragePort`, inte Supabase — användarens Supabase-projekt är fullt (se WORKLOG). Porten är en drop-in för Supabase när det finns.

## Milestone 0 — Walking skeleton (do this first)
> All code conforms to `ARCHITECTURE.md`.
- [x] Scaffold: React, TypeScript, lint, type check, test runner, CI.
- [x] Set up model, jobs, report modules and the types exactly as in `ARCHITECTURE.md`, dependency rule enforced.
- [x] JobTech JobSearch client: fetch a page of ads, map to the Job type (title, employer, ort, employment type, application channel, url).
- [x] List those jobs in a plain view.
- [x] Create a Profile and persist it (localStorage bakom StoragePort), round trip test green.
- [x] Log one Application with all six Arbetsförmedlingen fields, and export just that application's fields as a row.

## Milestone 1 — MVP
- [x] Job feed with filters for ort, yrke, and employment type.
- [x] Reusable profile: CV upload and parse, a base personal letter, personal details.
- [x] Apply flow: build the application, open the ad's sanctioned channel (email or url), capture the Application record.
- [x] Application log showing the six fields per application.
- [x] Aktivitetsrapport export for a chosen period, printable and easy to enter in Mina sidor.
- [x] GDPR basics: consent, export, delete. Field mapping tested.
- [x] Meets the Definition of Done in `BUILD_SPEC.md`.

## Milestone 2 — Phase 2
- [x] AI assisted letter tailoring per job (letters only, never report fields). (M8: deterministiskt default + valfri egen Anthropic-nyckel.)
- [x] JobStream local mirror for freshness. (M9: lokal freshness-cache av senaste sökning; äkta stream-mirror kräver backend — se NEEDS-DECISION.)
- [x] Taxonomy based job title mapping. (M2.)
- [x] Coach and provider view for Rusta och matcha. (M6: översikt/statistik för deltagaren; äkta multi-user-coach kräver auth — se NEEDS-DECISION.)
- [x] Saved searches and alerts. Plain Swedish, Arabic, Somali. (M3 språk, M2 sparade sökningar, M7 nya-sedan-sist.)

## Milestone 3 and beyond
- [x] Deeper sanctioned apply integrations (M5: prefill/kopiera-uppgifter; enkel-ansökan-filter M4), provider analytics (M6).
- [ ] BankID where appropriate — kräver certifierad backend-integration. Se NEEDS-DECISION.

## Stop conditions
Leave a NEEDS-DECISION note only for irreversible or out of scope choices, or anything touching real personal data in production. Otherwise keep going.
