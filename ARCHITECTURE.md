# ARCHITECTURE.md

Authoritative technical foundation. Do not drift. A change here is a `NEEDS-DECISION`, stop and flag it.

## Core invariants
1. The Application record is the single source of truth for the activity report. Every report is a pure derivation of Application records. No field is entered twice or invented.
2. Objects, not loose primitives. Job, Profile, Application are typed objects with stable ids.
3. Dates in ISO internally, money and enums canonical, converted only at the display edge.
4. Job data comes only through the JobTech client. The language model never produces a report field value.
5. Pure core, thin edges. model, jobs mapping, report derivation never import UI or services. UI may import pure modules, never the reverse.
6. Everything rule based (field mapping, taxonomy, report grouping) is test driven.
7. The stored model is versioned and round trips exactly.

## Module structure (lock this)
    src/
      model/         Job, Profile, Application types, serialization      (pure)
      jobs/          JobTech response mapping to Job                       (pure)
      report/        activity report derived from Application records      (pure)
      apply/         build the tailored application, pick channel          (pure)
      render/ ui/    components and panels                                 (UI)
      services/      JobTech API client, Supabase storage, email or apply, ai letter (edge)
      app/           wiring and state
    tests colocated as *.test.ts.

Dependency rule: model, jobs, report, apply are pure and never import render, ui, or services.

## The model (the contract)
    type Id = string;

    interface Job {                         // from JobTech, mapped
      id: Id; title: string; employer: string;
      municipality: string;                 // ort
      employmentType: 'heltid'|'deltid'|'timanstalld'|'unknown';
      applicationChannel: { kind: 'url'|'email'|'unknown'; value?: string };
      source: 'platsbanken'; publishedAt: string; url: string;
    }

    interface Profile {
      id: Id; firstName: string; lastName: string; email: string;
      cvFileRef?: string; baseLetter: string; details: Record<string,string>;
    }

    interface Application {                  // single source of truth for the report
      id: Id;
      jobTitle: string;                     // AF field
      employerName: string;                 // AF field
      employmentType: 'heltid'|'deltid'|'timanstalld';  // AF field
      appliedAt: string;                    // AF field, ISO date
      surveyAnswered: boolean;              // AF field, ja or nej
      municipality: string;                 // AF field, ort
      channel: string; jobUrl?: string; status: 'sent'|'draft';
    }

## Views and outputs are derivations
`activityReport(applications, periodStart, periodEnd)` groups Application records into the Arbetsförmedlingen field rows. It never reads anything but Application records.

## Editing, state, undo
One store holds the model. Edits are commands with apply and invert. Nothing mutates outside a command.

## Persistence
The model serializes with a schema version. A round trip test is part of the walking skeleton. CVs and letters are stored encrypted with consent, and are deletable.

## What counts as drift (stop and flag)
- A report field entered or invented anywhere but from an Application record.
- Job data obtained by scraping instead of the JobTech client.
- Business logic inside a UI component, or a pure module importing UI or a service.
- Auto submitting into a third party application system.
