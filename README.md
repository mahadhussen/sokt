# Sökt

Working name. Autonomous build repo for a frictionless Swedish job application tool with automatic Arbetsförmedlingen activity reporting.

## What is here
`BUILD_SPEC.md`, `ARCHITECTURE.md`, `GOALS.md`, `CLAUDE.md`, `OPEN_SOURCE_TOOLKIT.md`, `WORKLOG.md`, `.gitignore`, and `.claude/` with settings and the `/goal` command.

## One time setup
Create an empty repo named `sokt` on your GitHub account, then:

    git init
    git add .
    git commit -m "chore: Sökt setup, spec, architecture, goals, agent config"
    git branch -M main
    git remote add origin git@github.com:YOURNAME/sokt.git
    git push -u origin main

Get a free JobTech API key at apirequest.jobtechdev.se and put it in a local `.env` (never commit it). Open the folder in Claude Code.

## Cost rules, stay within Max and pay nothing extra
- Sign in with your Max subscription. Do NOT set an ANTHROPIC_API_KEY, that bills per token.
- Work interactively. Avoid `claude -p` and headless runs.
- Cut prompts with the allow list in `.claude/settings.json` plus Shift+Tab to auto accept edits.
- At the Max limit the session pauses until reset. No overage.

## Running the loop
Type `/goal`. Focus a milestone with `/goal M0`. Re nudge with `/loop /goal`.

## Honest expectations
Do milestone 0 first, then review the pull request. On Max with no extra spend it runs in bounded stretches and pauses at the limit.

## Kickoff prompt
> Read CLAUDE.md, ARCHITECTURE.md, and GOALS.md. Work autonomously through milestone 0 only for now, conforming to ARCHITECTURE.md exactly. Use the JobTech JobSearch API for job data, never scraping. Keep a WORKLOG.md with your decisions and alternatives. Build thin working slices, run the quality gates, commit on a feature branch after each passing slice, and do not ask for permission for routine work. When milestone 0 is complete and its tests pass, open a pull request and stop.
