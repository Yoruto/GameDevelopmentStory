---
name: career-balance-audit
description: Audit and tune the GameDevelopmentStory career simulation with reproducible rule checks and many-seed balance runs. Use for career progression, offers, event lines, releases, awards, endings, or save/resume; not for visual design or unrelated code review.
---

# Career balance audit

Use this skill to turn a balance concern into a reproducible check and an actionable report. The current game is a single career from January 1995 through December 2025. Company-management gameplay was removed; do not reintroduce it as a test expectation.

## Work within the current phase

1. Run `python skills/runbook/state.py current` before project work. Follow its current phase, permitted reads, and gates. Use `python3` only where that executable works.
2. Treat older requirement notes as history when they say a rule was removed. Use the current allowed design and configuration sources for exact formulas and probabilities.
3. If the phase does not permit implementation or interface tests, prepare the scenario matrix and test design without executing prohibited tests. Never use a browser in a phase that forbids browser self-testing.

## Build the audit

- Identify the simulator's existing entry point and test harness once project reads are allowed. Exercise the same transition functions the game uses; avoid a second model of the rules.
- Separate deterministic rule checks from statistical balance checks. For each rule check, capture the starting state, seed if relevant, player choice, month, and expected transition. Keep a failing case replayable.
- Cover the player-controlled monthly step and the January 1995 to December 2025 boundary; offer limits and one application per company; career-rank and producer eligibility; event-line independence and monthly beat limits; releases, chart order, and November award windows; save and resume at offer selection and active play; final settlement.
- For balance checks, run many independent seeds with a documented choice policy. Report the sample count and distributions for promotions, employer changes, producer conversion, optional event-line completion, awards, and endings. Compare against targets only when the current design or developer provides targets. Flag suspicious extremes as observations, not automatic failures.
- Keep fixture data and simulated saves isolated from production accounts or cloud state. Do not deploy, publish, or reset real player progress to run an audit.

## Report

Summarize what ran, the configuration or commit used, passing invariants, reproducible failures, and balance observations. Give each failure a seed or minimal state and the shortest replay steps. Distinguish untested areas from passing ones. When a fix is requested, change the narrowest source of truth, rerun the failing case and relevant distribution, and report any changed odds or player outcomes.
