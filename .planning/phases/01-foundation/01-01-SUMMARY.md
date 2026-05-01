---
plan: 01-01
status: complete
completed: 2026-05-01
---

# Phase 1 Plan 01: Project Scaffold Summary

**One-liner:** SvelteKit 2 + Svelte 5 project scaffolded with adapter-node, PocketBase/Zod/date-fns dependencies, shadcn-svelte v1.2.7 initialized, and VS3 medieval gold palette applied.

## Files Created/Modified

- `vs3-panel/package.json` — SvelteKit project with all runtime and dev deps
- `vs3-panel/package-lock.json` — lockfile with pinned versions
- `vs3-panel/svelte.config.js` — adapter-node configured with vitePreprocess
- `vs3-panel/src/app.d.ts` — App.Locals.pb declared (PocketBase type)
- `vs3-panel/src/app.css` — VS3 medieval gold palette (single source of truth)
- `vs3-panel/src/routes/layout.css` — re-exports src/app.css
- `vs3-panel/src/routes/+layout.svelte` — root layout (from scaffold)
- `vs3-panel/src/routes/+page.svelte` — minimal home page (from scaffold)
- `vs3-panel/.env.example` — env var documentation (POCKETBASE_URL, PUBLIC_POCKETBASE_URL)
- `vs3-panel/.gitignore` — pb_data/ added; .env already present
- `vs3-panel/components.json` — shadcn-svelte registry config (nova style, stone base, $lib aliases)
- `vs3-panel/src/lib/utils.ts` — shadcn-svelte utility (cn helper)
- `vs3-panel/src/lib/components/ui/button/` — button component
- `vs3-panel/src/lib/components/ui/card/` — card component (7 sub-components)
- `vs3-panel/src/lib/components/ui/table/` — table component (8 sub-components)
- `vs3-panel/src/lib/components/ui/badge/` — badge component
- `vs3-panel/src/lib/components/ui/dialog/` — dialog component (10 sub-components)
- `vs3-panel/src/lib/components/ui/separator/` — separator component
- `vs3-panel/src/lib/components/ui/input/` — input component
- `vs3-panel/src/lib/components/ui/label/` — label component
- `vs3-panel/src/lib/assets/favicon.svg` — default SvelteKit favicon (from scaffold)
- `vs3-panel/src/lib/index.ts` — lib barrel (from scaffold)
- `vs3-panel/vite.config.ts` — Vite config with Tailwind plugin (from sv add tailwindcss)
- `vs3-panel/tsconfig.json` — TypeScript config (from scaffold)

## Dependency Versions (confirmed in package.json)

- pocketbase: 0.26.8
- zod: 3.24.1
- date-fns: 4.1.0
- @sveltejs/adapter-node: 5.5.4
- svelte: 5.55.5
- @sveltejs/kit: 2.59.0
- tailwindcss: 4.2.4

## shadcn Components Installed

button, card, table, badge, dialog, separator, input, label

## Deviations from Plan

### Auto-handled Differences

**1. [Rule 3 - Blocking] sv create non-interactive flags required --no-add-ons**
- Plan suggested `--template minimal --types ts --no-install`; the sv CLI v0.15.2 also requires `--no-add-ons` to suppress the add-ons prompt
- Used: `npx sv@0.15.2 create vs3-panel --template minimal --types ts --no-add-ons --no-install`

**2. [Rule 3 - Blocking] shadcn-svelte preset is a base62-encoded config string**
- shadcn-svelte v1.2.7 uses a new preset system. The `--preset` flag requires a base62-encoded config string, not a named preset like "slate"
- Generated a stone-base preset code (`bIRvSC`) from the library's own `encodePreset()` function
- Resulted in equivalent stone base color as requested

**3. [Rule 3 - Blocking] shadcn-svelte uses $lib aliases, not @/ aliases**
- shadcn-svelte v1.2.7 with SvelteKit requires `$lib/...` style path aliases (not `@/lib/...`)
- Used `--components-alias '$lib/components'` etc. — components.json reflects this correctly

**4. [Info] Tailwind CSS layout split**
- sv add tailwindcss creates `src/routes/layout.css` with `@import 'tailwindcss'`
- shadcn-svelte init creates `src/app.css` separately
- Resolved by making `layout.css` re-export `src/app.css` (single source of truth maintained)

**5. [Info] svelte.config.js runes configuration replaced**
- sv add sveltekit-adapter added `compilerOptions.runes` to svelte.config.js
- Plan requires `preprocess: vitePreprocess()` format; replaced to match plan exactly
- Note: Svelte 5 defaults to runes mode in SvelteKit 2 regardless of this setting

**6. [Info] shadcn-svelte style is "nova" not legacy shadcn format**
- shadcn-svelte v1.2.7 uses "nova" style (new design system); older docs reference "slate"
- The VS3 palette in app.css overrides all shadcn default color variables — visual output is determined entirely by the custom palette regardless of base style

## Build Verification

`npm run build` exit code: 0
build/index.js exists: yes

## Commits

- `f6a9a09` — initial scaffold (sv create)
- `239a860` — add tailwindcss (sv add tailwindcss)
- `acf2ce2` — temp commit for shadcn clean working directory check
- `c639ef9` — feat(01-01): configure adapter-node, app.d.ts, env example, dependencies
- `bcdeee5` — feat(01-01): initialize shadcn-svelte with VS3 medieval gold palette

## Self-Check: PASSED

- [x] `vs3-panel/components.json` exists
- [x] `vs3-panel/src/app.css` contains `--background: #1a1410`
- [x] `vs3-panel/src/app.css` contains `--primary: #c4a45a`
- [x] `vs3-panel/src/app.css` contains `--destructive: #8b2b2b`
- [x] `vs3-panel/src/app.css` contains `--success: #3d6b3d`
- [x] `vs3-panel/src/app.css` contains `@theme inline`
- [x] `vs3-panel/src/app.css` contains `@import "tailwindcss"`
- [x] `vs3-panel/src/lib/components/ui/` exists with 8 component directories
- [x] `npm run build` exits 0 and produces `build/index.js`
- [x] `svelte.config.js` contains `adapter-node`, does not contain `adapter-auto`
- [x] `src/app.d.ts` contains `pb: PocketBase`
- [x] `.env.example` contains `POCKETBASE_URL=` and `PUBLIC_POCKETBASE_URL=`
- [x] `.gitignore` contains `.env`
