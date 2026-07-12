# Akyos — Your Answer to Chaos

Akyos is a personal goal-tracking PWA. On first run you pick one or more
goal domains — **exam/certification prep, fitness, diet, productivity, or
a custom goal** — and the app builds itself around that combination: a
NEET aspirant who also wants to bulk gets exam *and* fitness *and* diet
tabs and content in the same account, rather than being forced into a
single app "type."

## How it works

### Onboarding

`OnboardingWizard.tsx` walks a new account through goal-domain selection,
then a branching questionnaire specific to whichever domain(s) were
picked. The answers feed AI content generation for whatever's relevant —
checklist, timeline, targets, training plan, diet plan, exam syllabus.

Every one of those generators has a **local fallback** that runs if the
AI call fails or is unavailable, so the app is never left with empty
content. Worth being upfront about this one: across every phase of this
project's development, this sandbox has never had real network access to
call the live AI edge function, so the fallback path is by a wide margin
the most exercised and best-tested part of content generation. Treat the
live-AI path as comparatively less battle-tested until it's been run for
real.

### Dynamic tabs and sections

Which tabs an account sees is domain-driven:

- **`CORE_TAB_KEYS`** — Overview, Timeline, History — shown to every
  account regardless of domain.
- **`DOMAIN_TAB_KEYS`** — additional tabs added per selected domain (e.g.
  fitness/diet content, exam syllabus).
- **`SECTION_DOMAIN_KEYS`** / `isSectionVisibleForDomains` — finer-grained
  than a whole tab: some tabs are shared by multiple domains but contain
  sections that should only show for one of them.

Accounts with `domains === null` (pre-multi-domain, legacy accounts, or
anyone who skipped onboarding) always see everything, unrestricted — this
is deliberate, matching the app's original pre-domain-gating behavior
exactly, not a bug.

### Account isolation & auth

Authentication is handled through Supabase (`AuthGate.tsx`). Because
`localStorage` is shared by the whole browser rather than scoped per
account, the app enforces isolation itself: it tracks which user last
"owned" the browser's local storage and wipes every account-scoped key the
moment it detects a different (or no previous) account, before anything
is pulled from or pushed to the cloud. This prevents a new signup, or a
sign-in on a shared/previously-used device, from silently inheriting the
previous account's config, logs, or passcode.

### Cloud sync, push notifications, integrations

- **Cloud sync** — a defined set of `localStorage` keys (config, logs,
  onboarding state, etc.) sync to Supabase, the same list used by the
  app's manual backup/restore export.
- **Push notifications** — a service worker (`public/sw.js`) plus a VAPID
  key pair (public half in client code, private half kept as a Supabase
  Edge Function secret) power reminders and live Pomodoro-style
  notifications.
- **Spotify / Strava** — OAuth callback and sync endpoints live under
  `api/` (`spotify-callback.ts`, `spotify-sync.ts`, `strava-callback.ts`,
  `strava-sync.ts`) for connecting external accounts.

## Dev setup

```bash
npm install
npm run dev      # start the dev server
npm test         # run the test suite (vitest)
npm run build    # production build
npm run lint     # oxlint
```

**Note:** none of the commands above have ever been run for real in any
Claude sandbox across this project's development — every attempt at
`npm install` hit a `403 Forbidden` against the npm registry, so the
project has only ever been verified by reading and reasoning about the
source, never by an actual toolchain run. Treat your first real
`npm install` / `npm test` / `npm run build` as genuinely first-run
territory, not something already validated.

## Known limitations

- **Equipment tiers**: `contentGen.ts`'s training generator has two
  equipment tiers, not three — `home-basic` (a few dumbbells/bands) and
  `bodyweight-only` currently share one exercise pool. This was a
  deliberate simplification, not an oversight, and hasn't been revisited.
- **`EXAM_SUBJECT_PRESETS`** (in `contentGen.ts`) is a small list (~10
  entries) of exam-name → subject-list presets used to seed syllabus
  generation. Extending it is optional, low-risk future work, not
  something the app depends on — exams outside the list fall back to a
  generic single-subject shape.
- **PWA icons**: `public/manifest.json` references five icon files under
  `/icons/` (`icon-192.png`, `icon-256.png`, `icon-384.png`,
  `icon-512.png`, `icon-512-maskable.png`) that **do not exist yet** —
  `public/icons/` currently only has `apple-touch-icon.png`. Until real
  PNGs are generated (from the existing `favicon.svg`/`icons.svg` brand
  assets) and placed there, installing Akyos as a PWA will show a
  broken/missing home-screen icon, and push notifications will fail to
  load their icon/badge image. `public/sw.js` has been updated to use the
  same `/icons/` path convention as the manifest, so this is now a single
  well-defined gap (missing files) rather than two conflicting paths.

## Project history

This app was built across an 11-phase plan. Each phase (and multi-part
phase) left behind a `PHASE_*_HANDOFF.md` document in the repo root —
these are the real build history and design-decision log, including the
reasoning behind things like the account-isolation model, the domain
gating mechanism, and generation fallback strategy. If you want the full
"why" behind something rather than just the "what," start with
`PHASE_11_HANDOFF.md` (the final closeout doc) and follow its references
backward.
