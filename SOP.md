# Development SOP

How every change gets made, from "I want to change something" to "it's live on pomo.site" — without anything reaching production untested.

The short version: **branch → verify locally → push → CI + preview URL → PR → merge (only then does it go live)**.

This isn't optional discipline anymore — GitHub is configured to physically reject direct pushes to `main` (see [How the guardrails work](#how-the-guardrails-work) below), so following the flow below isn't a courtesy, it's the only way a change actually lands.

---

## 1. Start from a branch, never `main` directly

```bash
git checkout main
git pull
git checkout -b <type>/<short-description>
```

`<type>` is whatever's honest about the change — `fix/`, `feat/`, `chore/` are the common ones. Examples: `fix/lobby-autojoin`, `feat/matrix-theme`.

## 2. Make the change

Normal editing. No special process here beyond: keep the branch scoped to one change or one closely-related group of changes, not an unrelated grab-bag — makes the PR (and any later revert) much easier to reason about.

## 3. Verify locally, before pushing anything

```bash
npx tsc --noEmit      # typecheck
npm run build          # production build must succeed
npm run dev             # then actually look at it in the browser
```

`npm run dev` starts a local server (usually `http://localhost:5173`) that reflects your current uncommitted changes instantly — this is the fastest feedback loop there is, always check here first. For anything touching layout, positioning, or a specific device (iPad/Safari-only bugs have bitten this project more than once), don't stop at "it typechecks" — actually look at it.

## 4. Push the branch

```bash
git add -A
git commit -m "clear, specific message"
git push -u origin <branch-name>
```

Two things happen automatically on push, no extra steps needed:

- **GitHub Actions runs CI** (the same typecheck + build from step 3, run independently) — check status at `github.com/noob-slayer/pomo/actions`, or it'll show inline once you open a PR.
- **Vercel builds a Preview Deployment** — a real, live, fully working URL for just this branch, completely separate from pomo.site. It has the same Supabase login/sync working as production (env vars are scoped to both Production and Preview), so it's a faithful test environment, not a stripped-down one.

## 5. Open the PR

```bash
gh pr create --fill
```
(or open it on github.com — same result)

Then **wait for both signals before doing anything else**:
1. The CI check goes green.
2. The Vercel preview URL (posted automatically as a comment/check on the PR) actually looks and works right.

If either one is red or wrong, fix it on the same branch and push again — the PR updates automatically, no need to open a new one.

## 6. Merge — this is the only thing that goes live

```bash
gh pr merge --squash --delete-branch
```

Merging into `main` is the one action that triggers the real production deploy to pomo.site. Nothing before this point ever touched production.

Give it 30–60 seconds, then confirm:
```bash
curl -s https://pomo.site/ | grep -o '/assets/index-[A-Za-z0-9_-]*\.js'
```
compared against a fresh local `npm run build` — the hashes should match once the deploy lands.

---

## How the guardrails work

- **`main` is a protected branch.** A direct `git push origin main` is rejected by GitHub outright — a brand-new commit has no CI result yet, and the branch protection rule requires one. This applies even to repo admins (`enforce_admins` is on), so there's no accidental bypass.
- **The only door in is a PR whose CI check has passed.** That's not a convention anyone has to remember to follow — it's enforced server-side by GitHub.

## If something breaks in production anyway

Don't panic-edit `main` — you can't push to it directly regardless. Two real options, fastest first:

1. **Instant rollback, no code change:** Vercel dashboard → the project → Deployments → find the last known-good one → **⋯ → Promote to Production**. Live again in seconds, buys time to fix properly.
2. **Revert via the normal flow:** `git revert -m 1 <merge-commit-sha>` on a new branch, push, PR, merge — same path as any other change, just reverting instead of adding.

Then fix the actual issue through the normal branch → PR → merge flow once things are stable.

---

## Project-specific notes

- **Vercel's Hobby-tier plan caps deploys at 100 per rolling 24h window**, and preview deployments count toward that same limit, not just production ones. This has been hit repeatedly during this project's build. Batching related changes into fewer, slightly larger PRs — rather than many tiny ones — helps stay under it. If it's hit, deploys queue up and go out once the rolling window clears; there's no way to force through it short of upgrading to Pro.
- **The "make it fun" personal-mode background themes are the most visually finicky area** — positioning/alignment issues here have taken multiple rounds of screenshot verification to actually get right in the past (not just "compiles," but "looks correct at more than one browser-window size"). Worth specifically opening the preview URL for these and checking more than one window width before merging.
- **No automated test suite exists yet** beyond typecheck + build. "CI is green" means the app compiles and builds, not that a specific feature or fix actually works — that still needs a real look at the preview URL or local dev server.

---

## Cheat sheet

```bash
git checkout main && git pull
git checkout -b fix/short-description

# ...make changes...

npx tsc --noEmit && npm run build && npm run dev   # verify locally
git add -A && git commit -m "clear message"
git push -u origin fix/short-description

gh pr create --fill
# wait for CI to go green + check the preview URL

gh pr merge --squash --delete-branch
```
