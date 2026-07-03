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

## Milestone 0 — Walking skeleton (do this first)
> All code conforms to `ARCHITECTURE.md`.
- [ ] Scaffold: React, TypeScript, lint, type check, test runner, CI.
- [ ] Set up model, jobs, report modules and the types exactly as in `ARCHITECTURE.md`, dependency rule enforced.
- [ ] JobTech JobSearch client: fetch a page of ads, map to the Job type (title, employer, ort, employment type, application channel, url).
- [ ] List those jobs in a plain view.
- [ ] Create a Profile and persist it (Supabase), round trip test green.
- [ ] Log one Application with all six Arbetsförmedlingen fields, and export just that application's fields as a row.

## Milestone 1 — MVP
- [ ] Job feed with filters for ort, yrke, and employment type.
- [ ] Reusable profile: CV upload and parse, a base personal letter, personal details.
- [ ] Apply flow: build the application, open the ad's sanctioned channel (email or url), capture the Application record.
- [ ] Application log showing the six fields per application.
- [ ] Aktivitetsrapport export for a chosen period, printable and easy to enter in Mina sidor.
- [ ] GDPR basics: consent, export, delete. Field mapping tested.
- [ ] Meets the Definition of Done in `BUILD_SPEC.md`.

## Milestone 2 — Phase 2
- [ ] AI assisted letter tailoring per job (letters only, never report fields).
- [ ] JobStream local mirror for freshness.
- [ ] Taxonomy based job title mapping.
- [ ] Coach and provider view for Rusta och matcha.
- [ ] Saved searches and alerts. Plain Swedish, Arabic, Somali.

## Milestone 3 and beyond
- [ ] Deeper sanctioned apply integrations, provider analytics, BankID where appropriate.

## Stop conditions
Leave a NEEDS-DECISION note only for irreversible or out of scope choices, or anything touching real personal data in production. Otherwise keep going.
