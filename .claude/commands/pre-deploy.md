# Pre-Deploy Checklist

Run this checklist before any deployment (preview or production).
Work through every item in order. Stop and report any failure — do NOT continue past a failed step.

---

## 1. Tests — all 1039 assertions must pass
Run from `FrontMaxBreak/`:
```
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs
```
- Report pass/fail count for each file
- If any test fails: STOP. Do not proceed until fixed.

## 2. Migration check (backend changes only)
- Did any Django model change in this branch?
- If yes: confirm the migration file exists and is committed alongside the model change
- Run `python manage.py migrate --check` to verify no pending migrations
- If migrations are pending on Railway: they will run on next `git push master` — confirm this is intentional

## 3. Git status
- Run `git status` — no untracked secrets (.env, google-services.json, google-services-preview.json)
- Confirm only the intended files are staged
- Never use `git add .` — add files by name

## 4. Preview deploy (ALWAYS before production)
```
cd FrontMaxBreak
npx eas update --channel preview --message "$ARGUMENTS"
```
- Wait for confirmation that preview APK received the update
- **Ask the user: "Have you tested on the preview APK device? Type YES to continue to production."**
- Do NOT proceed to production without explicit YES

## 5. Production deploy (only after preview confirmed)
```
cd FrontMaxBreak
npx eas update --channel production --message "$ARGUMENTS"
```
- Only run after user has confirmed preview works on device

## 6. Backend deploy (git push — only if backend changed)
- `git push master` auto-deploys Django to Railway
- Confirm with user before pushing: "This will deploy backend changes to production Railway. Approve?"
- Only push after explicit approval

## 7. Summary
After completing all steps, report:
- Which channels were updated (preview / production)
- Whether backend was pushed
- Any issues encountered
