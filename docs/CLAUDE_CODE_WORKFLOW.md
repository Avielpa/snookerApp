# Claude Code Workflow — Read Before Using Claude on This Repo

This doc captures how Claude Code should be used on MaxBreak, distilled from real
incidents and corrections during development. It's meant to travel with the repo
so anyone (including you) gets the same working style without re-learning it the
hard way. Project-specific commands/architecture live in `CLAUDE.md` — read that
first; this doc is the *process* layer on top of it.

## 1. Plan before code, always

- Never let Claude touch code before you've approved a plan. Use plan mode
  (`EnterPlanMode` / the plan tool) for anything non-trivial.
- Claude should use low-token tools (Glob/Grep) over full file reads while
  planning, and should trust `CLAUDE.md` + this doc instead of re-reading source
  to answer questions already covered here.
- If a task will need many file reads or heavy exploration, Claude should stop
  and discuss the approach with you first — not just start burning tokens.
- Before starting any feature, Claude should state a scope estimate ("fits in
  one session" or not) before writing code.

## 2. One function/component = one job

- A function should do at most ~2 distinct actions. If it's doing more, split it.
- Every new feature goes into its **own new file/function/component** — don't
  fold new logic into an existing function. If an existing function truly must
  change, audit every caller first.
- Why this matters in practice: during a scoreboard redesign, splitting work
  into small single-purpose components is what let a real regression (a dropped
  status line) get caught by review — it wouldn't have been isolated in one
  large component.

## 3. Testing methodology — before, during, after

**Before:** for any new feature, decide the test file up front (this repo uses
plain Node `.mjs` test files, no React needed — see `FrontMaxBreak/*_test.mjs`).
Extract core logic into small pure/testable functions so it can be tested in
isolation.

**During:** write both general/happy-path and edge-case tests as you build —
empty input, boundary/sentinel values, mixed/interleaved data, large datasets.
This applies to *every* feature, even small "just for now" ones — a small
feature shipped without tests is exactly the kind of thing that comes back to
bite later.

**After:** run the full existing suite before pushing, not just the new test
file — regressions hide in unrelated areas. On this repo:
```bash
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs
```
All must pass (1039 assertions total) before any deploy.

**Never claim "done" on command success alone.** A deploy returning
SUCCESS/exit 0 only means the code ran without crashing — it says nothing about
whether the output is correct. After any change to an API response shape or
query result, actually curl the live endpoint (or equivalent) and inspect real
output before saying it's fixed. (Real incident: a `.distinct()` + Django
`Meta.ordering` interaction silently produced ~171 duplicate values — no error,
just wrong data — and it shipped because it wasn't verified live.)

## 4. Deployment discipline

- **Preview before production, always**: `eas update --channel preview` → test
  on a real device → only then `eas update --channel production`.
- **Never deploy without explicit approval.** Finish code changes, stop, and
  ask "ready to push to preview?" — don't chain plan → implement → deploy in
  one go. The only exception is if you explicitly say "do it and push" in the
  same request.
- **Before any production OTA update, check `git status`/`git diff` first.**
  `eas update` always builds from whatever is currently on disk — if a rollback
  was just done, a fresh update from a dirty working tree can silently
  re-publish the exact bug that was just rolled back.
- **Don't guess at a production crash's cause.** Get real evidence first (Play
  Console → Android vitals → crash stack trace, or build/update logs) before
  proposing a fix.
- **Every push to `master` auto-deploys the Django backend to Railway** — and
  restarts *every* Railway service tracking the repo, including always-on
  services like the live-score monitor. Before pushing, consider whether the
  change should wait, and make sure always-on/time-sensitive services don't
  have heavy blocking startup work ahead of their core loop. One-off/manual
  backfill jobs should not auto-deploy on every push.
- A persistent daemon (infinite loop, meant to run forever) must be deployed as
  a genuine persistent worker, never as a cron-triggered job — cron re-triggers
  can stack overlapping copies and hammer external APIs.

## 5. Using Claude's Skills for tasks

This repo has tracked, repo-portable Claude Code config in `.claude/` — anyone
who clones the repo and uses Claude Code gets these automatically:
- `.claude/agents/bug-fix-expert.md` — persona for any bug investigation/fix
  (20-rule workflow: systematic debugging, full connection map before touching
  code, root-cause chain, plan approval before any edit, never deploys itself).
- `.claude/commands/pre-deploy.md`, `.claude/commands/start-feature.md` — slash
  commands for this repo's workflows.
- `.claude/skills/youtube-creator/` — a project-specific skill.

Separately, Claude Code ships general-purpose **"superpowers" skills** that are
installed at the app level (not per-repo, so a fresh Claude Code install won't
have them unless configured) — e.g. `brainstorming` (use before any creative/
feature work), `systematic-debugging` (use before proposing any bug fix),
`test-driven-development`, `writing-plans`, `subagent-driven-development`,
`verification-before-completion`. The rule Claude follows: if a skill plausibly
applies to the task, it must invoke it before responding — planning skills
(brainstorming, systematic-debugging) run first, then implementation skills.
If you want the same skill set, install/configure Claude Code's superpowers
plugin yourself — it's not something that comes along with `git clone`.

## 6. Known recurring bug patterns to check for

- **Hardcoded season/year defaults**: the real snooker season rolls over in
  May/June, not January or September. Never hardcode `season = <year>` or
  `datetime.now().year - 1` — use `constants.current_season_int()` in
  `maxBreak/oneFourSeven/constants.py`. Before touching any season/year logic,
  grep for `= 2025\b|year - 1|month >= 9` to check for other instances of this
  bug.
- **Top-level hook calls**: a `useState`/`useEffect`/etc. call sitting at
  module scope (outside a component) in a `.tsx` file causes "Rendered fewer
  hooks than expected" crashes. Since OTA updates ship the *entire* JS bundle,
  a latent bug like this can lie dormant for weeks and surface after an
  unrelated screen's update triggers a full-bundle republish. Sweep with:
  `grep -rEn "^(const|let|var).*= use(State|Effect|Memo|Callback|Ref|Context)\(" --include=*.tsx --include=*.ts`
- **Style-only mockups must match real app logic 100%**, not just colors —
  grouping/filtering/what-data-appears-where must match the real architecture
  doc exactly unless a structural change is explicitly proposed and approved
  first.
- **Railway `railway-agent` config changes**: `updateServiceTool` only stages a
  change — you must also call `commitStagedChangesTool`, then wait ~30-60s
  before deploying, or the deploy will silently pick up the stale config.
