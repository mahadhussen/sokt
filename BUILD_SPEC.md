# Sökt — Build Prompt: frictionless job applications for Sweden, with automatic Arbetsförmedlingen activity reporting

Working name is Sökt, change it later. Read this fully, then build in the phase order below. Build a working, tested core first.

## 1. Mission
A tool for Sweden that does three things. It aggregates every applyable job through Arbetsförmedlingen's official open APIs, it lets a jobseeker apply with just a reusable CV and personal letter and no unnecessary questions in one to four minutes, and it automatically captures each application into an Arbetsförmedlingen aktivitetsrapport that is ready to review and submit. Built for jobseekers, especially Rusta och matcha participants, and the coaches who help them.

## 2. Audience and the wedge
For jobseekers, in particular labour market programme participants, and the providers and coaches who support them. Incumbents: Platsbanken is a listing, not an apply optimizer. Third party application systems like Teamtailor do not save what you typed and add friction. No tool builds the Arbetsförmedlingen activity report for you. The wedge is one reusable profile, a frictionless apply, and the activity report assembled automatically. Nobody does the Arbetsförmedlingen integration.

## 3. Core pillars (non negotiable)
1. All jobs come from the official JobTech APIs (JobSearch and JobStream). Never scrape Platsbanken, Teamtailor, LinkedIn, Indeed, or any site.
2. One reusable applicant profile: CV, a base personal letter, and personal details entered once.
3. Frictionless apply, target one to four minutes, no unnecessary questions.
4. Automatic Arbetsförmedlingen aktivitetsrapport capture and export.
5. Strict data protection for sensitive jobseeker data.

## 4. Golden rules for correctness and safety (read before building anything)
1. The activity report fields are captured deterministically from a real logged application event, never invented or guessed by the language model.
2. Job data comes only from the official JobTech APIs, with the required CC-BY-SA attribution. No scraping.
3. The tool does not covertly auto submit into third party application systems, since that breaks their terms and hits CAPTCHAs. It prepares, prefills, and streamlines, and submits only through a sanctioned channel (the ad's application email or URL).
4. Personal data (CV, letter, identity) is sensitive. Encrypt at rest, minimize, get consent, and support export and delete. GDPR by design.
5. The aktivitetsrapport is assembled and exported for the user to review and submit through Arbetsförmedlingen's own portal. The tool does not auto submit into Arbetsförmedlingen, there is no public submit API.
6. Where relevant, the job title maps to the JobTech taxonomy (for example lokalvårdare, diskare), and the mapping is tested.

## 5. Features
- Job feed from JobSearch, with filters for ort, yrke, and employment type, and a JobStream mirror for freshness.
- Applicant profile: CV upload and parse, a base personal letter, personal details, all reusable.
- Apply flow: for each job, produce a tailored letter, attach the CV, apply through the ad's sanctioned channel, and capture the application record.
- Application log with the exact Arbetsförmedlingen fields: job title, employer, employment type (heltid, deltid, timanställd), date applied, survey answered yes or no, ort, plus the source link.
- Aktivitetsrapport export: a per period list matching the required fields, printable and easy to enter in Mina sidor.

## 6. Phasing
- Walking skeleton: fetch jobs from JobSearch, list them, create a profile, log one application with all activity report fields, export that one application's fields. Persistence round trips. Tests green.
- MVP: full job feed with filters, reusable profile with CV and base letter, apply flow that captures the application and opens the sanctioned channel, application log, aktivitetsrapport export for a period, GDPR basics (consent, export, delete). Field mapping tested.
- Phase 2: AI assisted letter tailoring, JobStream local mirror, taxonomy based title mapping, a coach and provider view for Rusta och matcha, saved searches and alerts, plain Swedish plus Arabic and Somali.
- Later: deeper sanctioned apply integrations, provider analytics, BankID where appropriate.

## 7. Definition of done for the MVP
A participant can search jobs by ort, apply with a saved CV and letter in a few minutes with the application auto logged with all six Arbetsförmedlingen fields, and export a clean aktivitetsrapport for the period, with consent and delete working, everything numeric and rule based covered by tests.

## 8. Tech stack
React and TypeScript, Supabase for auth, storage, and database, the JobTech APIs (JobSearch and JobStream) as the job source, a CV and PDF parser, and the Anthropic API behind the backend for letter tailoring. Build with Claude Code and GitHub as one pipeline.

## 9. Safety, liability, and compliance
Handle jobseeker personal data under GDPR with consent, minimization, export, and delete. Attribute JobTech data under CC-BY-SA. Do not scrape or bot third party sites. The activity report is a preparation and export aid, the user submits it through Arbetsförmedlingen.
