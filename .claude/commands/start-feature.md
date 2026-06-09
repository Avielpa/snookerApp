# Start Feature: $ARGUMENTS

You are starting a new feature for the MaxBreak snooker app.
Follow this exact process — do NOT skip or reorder steps.

---

## Step 1 — Orient yourself (no code yet)
- Read CLAUDE.md to understand the project structure and rules
- Identify which files will be affected (backend, frontend, or both)
- State out loud: what layers need to change and in what order

## Step 2 — Enter plan mode
- Switch to plan mode immediately
- Present a full plan with:
  - Every file you will create or modify
  - Every function you will add or change
  - The exact order of implementation
  - Any migration needed (model changes require makemigrations)
  - Any tests that need to be written
- **Wait for explicit user approval before writing a single line of code**

## Step 3 — Backend first (if backend changes needed)
Build in this exact order, pausing after each for user confirmation:
1. Model change (if any) → immediately remind user to run `makemigrations` and commit the file
2. Serializer
3. View / endpoint
4. URL registration
5. Test the endpoint from terminal before touching frontend

## Step 4 — Frontend second (only after backend is confirmed working)
Build in this exact order:
1. Service (API call)
2. Screen / component logic
3. UI presentation
4. Add logs at: service call triggered → API response received → UI rendered

## Step 5 — Tests
- Write tests covering the new feature
- Run existing tests to confirm nothing broke:
  ```
  node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs
  ```
- All 1039 assertions must still pass

## Rules
- Never write code before plan approval
- Never touch production before preview is tested
- Never add functions, helpers, or abstractions beyond what the feature requires
- If you add anything not in the approved plan, explain why before committing to it
- Dark mode only — use `colors.textPrimary`, never `colors.text`
