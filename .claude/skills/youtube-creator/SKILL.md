---
name: youtube-creator
description: Use when the user asks to add, replace, or remove a YouTube creator/channel in the Media tab's Creators sub-tab (FrontMaxBreak app). Covers resolving a @handle to a channel ID and making every required code edit.
---

# Add/replace a YouTube creator in the Creators tab

Two files only, both under `FrontMaxBreak/`:
- `services/highlightsService.ts` — channel ID constants + `fetchX()` export
- `app/NewsScreen.tsx` — sub-tab type, labels, state/load hooks, tab list, FlatList data switch

No backend involved. This is a JS-only change — ship via `eas update`, not `eas build`.

## Step 1 — Resolve the channel ID

**WebFetch on youtube.com pages is unreliable** — it truncates before reaching the `externalId` field, even though the page title usually comes through. Use `curl` via Bash instead:

```bash
curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "https://www.youtube.com/@HANDLE" -o /tmp/chan.html
grep -o 'externalId":"[^"]*"' /tmp/chan.html | head -1
grep -o '<title>[^<]*</title>' /tmp/chan.html
grep -o 'canonicalBaseUrl":"[^"]*"' /tmp/chan.html | head -1
rm -f /tmp/chan.html
```

- `externalId` gives the `UC...` channel ID.
- `<title>` and `canonicalBaseUrl` confirm you resolved the right handle (canonicalBaseUrl should equal `/@HANDLE`).

If the user gives a name but not an exact handle, use `WebSearch` first to find the likely handle/channel, then confirm with the curl steps above before touching any code — never guess a channel ID.

If ambiguous (multiple creators could match, or add-vs-replace is unclear), ask the user via `AskUserQuestion` before editing.

## Step 2 — `services/highlightsService.ts`

Four edits, following the existing pattern exactly (e.g. `ASTLEY_CHANNEL_ID`, `fetchAstley`):

1. Add a line to the `Channel IDs:` comment block near the top.
2. Add a `const X_CHANNEL_ID = 'UC...';` near the other constants.
3. Add `export const fetchX = () => fetchWithCache('highlights_x', () => fetchChannelVideos(X_CHANNEL_ID, 'X'));` in the "Creators tab channels" section.
4. If **replacing** a creator, remove the old constant/export/comment line instead of adding — don't leave orphaned unused exports.

## Step 3 — `app/NewsScreen.tsx`

Follow every existing creator (`astley`/`sasa`/`shachar`) as the template. Places to touch, in order:

1. Import the new `fetchX` from `highlightsService`.
2. `CreatorsSubTab` union type — add/rename the tab key.
3. `CREATORS_SUB_LABELS` and `CREATORS_BADGE` — add/rename the display label (keep it short; these are `flex: 1` in a row, so 4+ tabs need short labels like `ASTLEY` not `JOHN ASTLEY`).
4. `fetched` ref object — add/rename the `false` tracking flag.
5. State hooks block — add `const [xHighlights, setXHighlights] = useState<Highlight[]>([])`, `xLoading`, `xRefreshing` (or rename existing ones).
6. `loadX` `useCallback` — mirrors `loadShachar` exactly.
7. `handleCreatorsSubTabPress` — add the `if (sub === 'x' && !fetched.current.x) loadX();` branch and add `loadX` to the deps array.
8. `creatorsLoading` / `creatorsRefreshing` / `onCreatorsRefresh` ternary chains — add the new branch.
9. `tabs={[...] as CreatorsSubTab[]}` array passed to `SubTabRow`.
10. `FlatList`'s `data={...}` ternary chain.

For a **replace**, do a plain rename of every `mubeen`-style identifier (old key → new key) rather than deleting one branch and adding another — keeps the diff clean. `sed -i 's/oldkey/newkey/g'` across the file works well since these identifiers are consistently cased per pattern (`OLDKEY`/`Oldkey`/`oldkey`).

## Step 4 — Verify no leftovers

```bash
grep -rin "oldname" FrontMaxBreak/
```
Should return nothing after a replace.

## Step 5 — Ship

This is JS-only — no native change, no migration, no new permission. Per `CLAUDE.md` deployment rules:
1. `eas update --channel preview --message "..."` from `FrontMaxBreak/`.
2. Ask the user to test the Creators tab on the preview APK.
3. Only after confirmation: `eas update --channel production --message "..."`.
4. Get explicit approval before any `git push` to master, same as any other change — this skill does not grant standing deploy approval.
