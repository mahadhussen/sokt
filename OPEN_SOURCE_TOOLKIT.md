# Open Source Toolkit for Sökt

Re verify each license at the pinned version.

## Job data (the backbone, not a library, an official API)
- JobTech Dev JobSearch API, search over Platsbanken ads. Request a free key at apirequest.jobtechdev.se. Data is licensed CC-BY-SA, so attribute Arbetsförmedlingen and keep the same license on derived data. Docs on gitlab.com/arbetsformedlingen.
- JobTech Dev JobStream API, a stream of all publications and updates so you can keep a fresh local mirror. Same key and license.
- JobTech Taxonomy, occupations and skills, for mapping the job title field.
Never scrape Platsbanken or third party sites, the API gives full Platsbanken coverage legally.

## App and data
- React and TypeScript. License: MIT. Safe.
- Supabase JS client for auth, database, and storage. License: MIT. Safe. Store CVs and letters encrypted.
- A state library (Zustand). License: MIT. Safe.

## CV and PDF parsing (verify at integration)
- A permissively licensed PDF text extractor for parsing uploaded CVs. Prefer MIT or Apache. Avoid any GPL parser in the closed core.

## Letter tailoring
- Anthropic API behind the backend for tailoring the personal letter per job. Never expose the key client side. The letter is content, not a report field, so this is allowed. Report fields never come from the model.

## Licensing policy
MIT, Apache, BSD safe. MPL usually fine. LGPL only as a separate dependency. GPL and AGPL never in the closed core. Note the CC-BY-SA attribution and share alike obligation on the JobTech job data specifically.
