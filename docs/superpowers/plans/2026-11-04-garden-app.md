# Garden App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline phone web app (PWA) that remembers garden plans, per-spot care history and due dates, spray courses and season prep, and produces a 2-hour Saturday plan.

**Architecture:** Pure domain logic lives in `src/domain/`. It is plain functions over plain data, with no DOM and no storage access, and gets heavy unit tests. `src/db/` wraps IndexedDB (via `idb`) and exposes async repo functions. `src/ui/` is Preact components that load data from the db, call domain functions to compute views, and write results back. Due dates are **computed** from logs and rules, never stored. A due item disappears only when a log entry satisfies it.

**Tech Stack:** Node 20, Vite 5, TypeScript 5 (strict), Preact 10, `idb` 8, `vite-plugin-pwa` 0.20, Vitest 2, `fake-indexeddb` 6, `@testing-library/preact`, jsdom. Hosting is GitHub Pages via a GitHub Actions workflow.

**Spec:** `docs/superpowers/specs/2026-11-04-garden-app-design.md`

## Global Constraints

- Target device: **Android phone, Chrome**. Must work offline after first load and be installable to the home screen.
- All data is stored **on-device only** (IndexedDB). No network calls for data, no accounts, no analytics.
- No push notifications.
- Spot ID prefixes: **T-** terrace, **A-** flower balcony, **B-** leafy balcony. Zero-padded to 2 digits (`T-01`).
- Dates are local calendar dates stored as `'YYYY-MM-DD'` strings (`ISODate`). Never use UTC conversion for day math.
- Pune seasons: Monsoon `Jun–Sep`, Winter `Oct–Feb`, Summer `Mar–May`.
- Defaults: fertilize every **30** days. Soil change every **365** days for fruit/veg and flowering, **after each crop** for leafy plants and for beds. Spray course **4** sprays, **3** days apart, wood vinegar. Saturday budget **120** minutes. Backup nudge after **30** days.
- Spray course **shifts**: the next spray is due `intervalDays` after the *actual* previous spray.
- Duration defaults (minutes): fertilize pot 3 / bed 8; soil change pot 15 / bed 20; spray 2 per spot; till 5 per pot; plan 15 (editable per item).
- Lead times: transplant from seed **42** days (6 weeks); direct sow **7** days; buy sapling **7** days.
- Crop names in Indian home-garden usage (e.g. "Methi (fenugreek)", "Palak (spinach)", "Bhindi (okra)").
- Wording is plain and short. The Saturday header reads `Plan ≈ {h}h {m}m of {budget} · {n} items held for next week`.

## Review Focus

1. **Day math across month ends, leap years and the device timezone.** `addDays('2026-02-28', 1)` must be `'2026-03-01'`, and dates are never shifted by UTC. Pinned in Task 2.
2. **Opening the app after a 2+ week gap.** Every missed spray, missed plan and overdue care item still appears, once each, with correct lateness. Nothing is duplicated or dropped. Pinned in Tasks 6 and 7.
3. **Opening on Saturday itself.** "This Saturday" means today, not 7 days out, and today's Saturday plan includes items due today. Pinned in Tasks 2 and 7.
4. **Two plants in one spot.** Fertilizer/soil care is due **once per spot**, not once per plant. Pinned in Task 5.
5. **Importing a bad or foreign backup file.** It is rejected with a message and existing data is left untouched. Pinned in Tasks 9 and 13.

---

## File Structure

```
index.html
vite.config.ts                 Vite + Preact + PWA + vitest config
src/main.tsx                   mounts <App/>, requests persistent storage
src/domain/types.ts            all shared data types
src/domain/dates.ts            ISODate helpers
src/domain/seasons.ts          Pune season calendar
src/data/crops.ts              built-in crop table
src/domain/care.ts             care rules + due computation + setup staggering
src/domain/spray.ts            spray course logic
src/domain/saturday.ts         Saturday plan packing
src/domain/today.ts            Today view selection
src/domain/seasonPlanner.ts    freeing-up spots, crop suggestions, prep tasks
src/domain/backup.ts           export/import + nudge
src/db/db.ts                   IndexedDB schema + repo functions
src/ui/App.tsx                 tabs, + button, data loading
src/ui/QuickAdd.tsx
src/ui/TodayScreen.tsx
src/ui/SaturdayScreen.tsx
src/ui/SpotsScreen.tsx         list + add spot + spot detail
src/ui/SeasonScreen.tsx        season view + seeds list
src/ui/SettingsScreen.tsx      budget, durations, backup/import
src/ui/styles.css
tests/**                       mirrors src/
.github/workflows/deploy.yml   GitHub Pages deploy
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `.gitignore`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` (vitest run, jsdom), `npm run dev`, `npm run build`. `vite.config.ts` sets `base: './'` so the app works from a GitHub Pages sub-path.

- [ ] **Step 1:** `git init` in `/Users/ajoy/Documents/gardenAPP`. Create `.gitignore` with `node_modules/`, `dist/`, `.superpowers/`.
- [ ] **Step 2:** Scaffold Vite Preact TS (`npm create vite@5 . -- --template preact-ts`, keeping existing `docs/`). Add dev deps `vitest@2 jsdom fake-indexeddb@6 @testing-library/preact vite-plugin-pwa@0.20` and dep `idb@8`. Add `"test": "vitest run"`. Set `test: { environment: 'jsdom', setupFiles: ['fake-indexeddb/auto'] }` in `vite.config.ts`. Remove template demo content. `App` renders `<h1>Garden</h1>`.
- [ ] **Step 3:** Write `tests/smoke.test.ts` rendering `<App/>` and asserting the text `Garden` is present.
- [ ] **Step 4:** Run `npm test`. Expected: 1 passed. Run `npm run build`. Expected: build succeeds.
- [ ] **Step 5:** Commit `chore: scaffold Vite Preact app`.

---

### Task 2: Types and date helpers

**Files:**
- Create: `src/domain/types.ts`, `src/domain/dates.ts`
- Test: `tests/domain/dates.test.ts`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type ISODate = string; // 'YYYY-MM-DD', local
  export type AreaId = 'terrace' | 'balconyA' | 'balconyB';
  export type SpotType = 'pot' | 'bed';
  export type SpotSize = 'small' | 'medium' | 'large';
  export type PlantKind = 'fruitveg' | 'leafy' | 'flowering';
  export interface Spot { id: string /* 'T-01' */; area: AreaId; type: SpotType; size: SpotSize; note?: string; createdAt: ISODate }
  export interface Plant { id: string; spotId: string; cropId: string; kind: PlantKind; plantedOn: ISODate; expectedEnd?: ISODate; endedOn?: ISODate }
  export type CareType = 'fertilize' | 'soil';
  export interface CareRule { id: string; spotId: string; type: CareType; intervalDays: number | 'afterCrop'; initialDue: ISODate }
  export type LogKind = 'fertilize' | 'soil' | 'spray' | 'till' | 'prune' | 'harvest' | 'plant' | 'crop_end' | 'note';
  export interface LogEntry { id: string; date: ISODate; kind: LogKind; spotId?: string; place?: string; text?: string; taskId?: string; courseId?: string }
  export interface PlanTask { id: string; title: string; due: ISODate; spotIds: string[]; doneSpotIds: string[]; place?: string; estMin: number; createdAt: ISODate; doneOn?: ISODate; source: 'user' | 'prep' }
  export interface Problem { id: string; spotId: string; text: string; seenOn: ISODate; photo?: Blob; resolvedOn?: ISODate }
  export interface SprayCourse { id: string; problemId: string; spotId: string; product: string; total: number; intervalDays: number; startDue: ISODate; doneDates: ISODate[] }
  export interface Seed { id: string; cropId: string; form: 'seed' | 'sapling'; note?: string }
  export interface Settings { budgetMin: number; durations: Durations; lastBackupOn?: ISODate }
  export interface Durations { fertilize: Record<SpotType, number>; soil: Record<SpotType, number>; spray: number; till: number; plan: number }
  ```
- Produces (dates.ts): `today(): ISODate`, `addDays(d: ISODate, n: number): ISODate`, `daysBetween(a: ISODate, b: ISODate): number` (b − a), `isSaturday(d: ISODate): boolean`, `upcomingSaturday(d: ISODate): ISODate` (returns `d` itself if Saturday), `formatShort(d: ISODate): string` (e.g. `'7 Nov'`), `newId(): string` (`crypto.randomUUID()`).

- [ ] **Step 1: Write failing tests** in `tests/domain/dates.test.ts`:
  - `addDays('2026-02-28', 1) === '2026-03-01'`; `addDays('2028-02-28', 1) === '2028-02-29'`; `addDays('2026-12-31', 1) === '2027-01-01'`; `addDays('2026-03-01', -1) === '2026-02-28'`
  - `daysBetween('2026-11-01', '2026-11-04') === 3`; `daysBetween('2026-11-04', '2026-11-01') === -3`
  - `upcomingSaturday('2026-11-04') === '2026-11-07'` (Wed); `upcomingSaturday('2026-11-07') === '2026-11-07'` (Sat → itself); `upcomingSaturday('2026-11-08') === '2026-11-14'` (Sun)
  - `formatShort('2026-11-07') === '7 Nov'`
- [ ] **Step 2:** Run `npx vitest run tests/domain/dates.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `types.ts` and `dates.ts`. Parse with `new Date(y, m-1, d)` (local) and do arithmetic with `setDate`. Format from local getters. Never use `toISOString()`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat: domain types and date helpers`.

---

### Task 3: IndexedDB storage

**Files:**
- Create: `src/db/db.ts`
- Test: `tests/db/db.test.ts`

**Interfaces:**
- Consumes: types from Task 2.
- Produces:
  ```ts
  export type StoreName = 'spots' | 'plants' | 'careRules' | 'logs' | 'plans' | 'problems' | 'courses' | 'seeds';
  export function openGardenDb(name?: string): Promise<IDBPDatabase>; // default 'garden', version 1
  export function getAll<T>(store: StoreName): Promise<T[]>;
  export function put<T extends { id: string }>(store: StoreName, item: T): Promise<void>;
  export function remove(store: StoreName, id: string): Promise<void>;
  export function getSettings(): Promise<Settings>;   // returns DEFAULT_SETTINGS when none stored
  export function saveSettings(s: Settings): Promise<void>;
  export function replaceAll(data: Record<StoreName, unknown[]>, settings: Settings): Promise<void>; // one transaction
  export function nextSpotId(area: AreaId): Promise<string>; // 'T-01', 'T-02', …; prefix T/A/B
  export function requestPersistence(): Promise<boolean>;  // navigator.storage.persist() if available
  export const DEFAULT_SETTINGS: Settings; // budgetMin 120, durations from Global Constraints
  ```
  Each store has keyPath `id`. Settings live in a `meta` store under key `'settings'`. Tests call `openGardenDb('test-' + random)` and pass it in through a module-level `useDb(db)` setter: `export function useDb(db: IDBPDatabase): void`.

- [ ] **Step 1: Write failing tests:**
  - put then getAll on `spots` returns the item
  - `getSettings()` on an empty db deep-equals `DEFAULT_SETTINGS` with `budgetMin === 120`
  - `nextSpotId('terrace')` returns `'T-01'` on empty, then `'T-02'` after putting `T-01`. `nextSpotId('balconyB')` returns `'B-01'`
  - `replaceAll` with a failing item (put a non-object into `plans`) throws and leaves the earlier `spots` content unchanged (atomic)
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with `idb`'s `openDB`. `replaceAll` clears and refills all stores inside a single `readwrite` transaction over all stores plus `meta`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: IndexedDB storage layer`.

---

### Task 4: Seasons and crop table

**Files:**
- Create: `src/domain/seasons.ts`, `src/data/crops.ts`
- Test: `tests/domain/seasons.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Season = 'monsoon' | 'winter' | 'summer';
  export function seasonOf(d: ISODate): Season;            // Jun–Sep monsoon, Oct–Feb winter, Mar–May summer
  export function nextSeasonStart(d: ISODate): { season: Season; start: ISODate }; // 1 Jun / 1 Oct / 1 Mar
  export const SEASON_LABEL: Record<Season, string>;       // 'Monsoon (Jun–Sep)' etc.
  // crops.ts
  export type SowMethod = 'transplant' | 'direct' | 'sapling';
  export interface Crop { id: string; name: string; kind: PlantKind; seasons: Season[]; method: SowMethod; daysToHarvest: number; minSize: SpotSize; creeper?: boolean }
  export const CROPS: Crop[];
  export function cropById(id: string): Crop | undefined;
  ```
- The `CROPS` table must include at least these. Season(s), method, rough days to harvest, minimum size:
  - Tomato (winter, summer; transplant; 75; medium)
  - Chilli (all three seasons; transplant; 80; medium)
  - Brinjal (monsoon, winter; transplant; 80; medium)
  - Capsicum (winter; transplant; 80; medium)
  - Bhindi (okra) (summer, monsoon; direct; 50; medium)
  - Karela (bitter gourd) (summer, monsoon; direct; 60; large; creeper)
  - Dudhi (bottle gourd) (summer, monsoon; direct; 60; large; creeper)
  - Cucumber (summer, monsoon; direct; 50; medium; creeper)
  - Beans (monsoon, winter; direct; 55; medium)
  - Peas (winter; direct; 65; medium)
  - Radish (winter; direct; 35; medium)
  - Carrot (winter; direct; 75; medium)
  - Palak (spinach) (winter, monsoon; direct; 35; small; leafy)
  - Methi (fenugreek) (winter; direct; 25; small; leafy)
  - Coriander (winter; direct; 35; small; leafy)
  - Amaranth (chauli) (summer, monsoon; direct; 30; small; leafy)
  - Lettuce (winter; direct; 45; small; leafy)
  - Spring onion (winter; direct; 50; small; leafy)
  - Marigold (all; transplant; 60; small; flowering)
  - Zinnia (summer, monsoon; direct; 50; small; flowering)
  - Guava, Lemon and Papaya as `sapling`, `fruitveg`, all seasons, `daysToHarvest` 365, `large`

- [ ] **Step 1: Write failing tests:**
  - `seasonOf('2026-06-01') === 'monsoon'`, `seasonOf('2026-09-30') === 'monsoon'`, `seasonOf('2026-10-01') === 'winter'`, `seasonOf('2027-02-28') === 'winter'`, `seasonOf('2027-03-01') === 'summer'`
  - `nextSeasonStart('2026-11-04')` deep-equals `{ season: 'summer', start: '2027-03-01' }`; `nextSeasonStart('2026-05-20')` deep-equals `{ season: 'monsoon', start: '2026-06-01' }`
  - every `CROPS` id is unique, and `cropById('methi')?.kind === 'leafy'`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: Pune seasons and crop table`.

---

### Task 5: Care rules and due computation

**Files:**
- Create: `src/domain/care.ts`
- Test: `tests/domain/care.test.ts`

**Interfaces:**
- Consumes: Task 2 types and dates. `cropById` from Task 4.
- Produces:
  ```ts
  export type LastDoneAnswer = 'thisWeek' | 'twoWeeks' | 'monthPlus' | 'unknown';
  export function defaultCareRules(spot: Spot, kind: PlantKind, answers: { fertilize: LastDoneAnswer; soil: LastDoneAnswer }, today: ISODate, unknownIndex: number): CareRule[];
  export interface CareDue { spotId: string; type: CareType; due: ISODate; daysOverdue: number /* ≥0 when due today/past; negative = in future */ }
  export function careDueFor(rule: CareRule, logs: LogEntry[], plants: Plant[], today: ISODate): CareDue | null;
  export function allCareDue(rules: CareRule[], logs: LogEntry[], plants: Plant[], today: ISODate): CareDue[];
  ```
- Rules:
  - **Interval** comes from the spot's dominant kind: `'afterCrop'` for soil if the spot is a bed or the kind is leafy, otherwise 365. Fertilize is always 30.
  - **initialDue** from the answer:
    - `thisWeek` → `today − 3 + interval`
    - `twoWeeks` → `today − 14 + interval`
    - `monthPlus` → `today`
    - `unknown` → `addDays(upcomingSaturday(today), 7 * (unknownIndex % 3))`, spreading unknowns over the next 3 Saturdays
    - For `afterCrop` soil rules, `initialDue` is unused. Store `today`.
  - **Numeric interval:** if a log of the rule's `type` exists for the spot, `due = latestLog.date + interval`, else `initialDue`.
  - **afterCrop:** due = date of the latest `crop_end` log for the spot that is *after* the latest `soil` log. Returns `null` if there is no such `crop_end`.
  - A spot gets **one rule per type**, whatever the number of plants. `defaultCareRules` is called once per spot.

- [ ] **Step 1: Write failing tests:**
  - fertilize rule with log on `2026-10-28` → `due '2026-11-27'`, and `daysOverdue === -23` on `2026-11-04`
  - fertilize rule, no logs, answer `unknown`, `unknownIndex` 0, 1, 2, 3 on `2026-11-04` → initialDue `'2026-11-07'`, `'2026-11-14'`, `'2026-11-21'`, `'2026-11-07'`
  - answer `monthPlus` → due today, daysOverdue 0
  - leafy pot: soil rule is `'afterCrop'`. With logs `soil 2026-09-01`, `crop_end 2026-11-01` → due `'2026-11-01'`. With logs `crop_end 2026-08-01`, `soil 2026-09-01` → `null`
  - medium pot of fruitveg: soil interval 365. A bed of fruitveg: soil `'afterCrop'`
  - **Review Focus 4:** `defaultCareRules` for a spot with tomato + karela returns exactly 2 rules (one fertilize, one soil), and `allCareDue` yields one fertilize entry for that spot
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: per-spot care schedules`.

---

### Task 6: Spray courses

**Files:**
- Create: `src/domain/spray.ts`
- Test: `tests/domain/spray.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function startCourse(problem: Problem, today: ISODate, opts?: { total?: number; intervalDays?: number; product?: string }): SprayCourse; // defaults 4, 3, 'Wood vinegar'; startDue = today
  export function nextSprayDue(c: SprayCourse): ISODate | null;  // null when doneDates.length >= total
  export function markSprayDone(c: SprayCourse, on: ISODate): SprayCourse; // appends; pure
  export interface SprayDue { courseId: string; spotId: string; number: number /* 1-based */; total: number; due: ISODate; daysLate: number }
  export function spraysDue(courses: SprayCourse[], today: ISODate): SprayDue[]; // only courses whose next due ≤ today
  ```
- Shift rule: `nextSprayDue = doneDates.length === 0 ? startDue : addDays(last(doneDates), intervalDays)`.

- [ ] **Step 1: Write failing tests:**
  - new course on `2026-11-01` → next due `'2026-11-01'`, number 1 of 4
  - done on `2026-11-01`, then next due `'2026-11-04'`. Done late on `2026-11-06` → next due `'2026-11-09'` (shifted)
  - after 4 dones, `nextSprayDue` is `null` and `spraysDue` excludes it
  - **Review Focus 2:** a course started `2026-10-01` with one done on `2026-10-01`, viewed on `2026-10-20`, gives exactly **one** `SprayDue` with `number 2` and `daysLate 16`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: spray courses that shift after late sprays`.

---

### Task 7: Today view and Saturday plan

**Files:**
- Create: `src/domain/today.ts`, `src/domain/saturday.ts`
- Test: `tests/domain/today.test.ts`, `tests/domain/saturday.test.ts`

**Interfaces:**
- Consumes: `CareDue`/`allCareDue` (Task 5), `SprayDue`/`spraysDue` (Task 6), `PlanTask`, `Spot`, `Durations`.
- Produces:
  ```ts
  // today.ts
  export interface TodayView { sprays: SprayDue[]; plans: PlanTask[] /* open, due ≤ today */; watching: Problem[] /* unresolved */; saturdayHint: { careDueCount: number; saturday: ISODate } }
  export function buildToday(i: { courses: SprayCourse[]; plans: PlanTask[]; problems: Problem[]; careDue: CareDue[]; today: ISODate }): TodayView;

  // saturday.ts
  export type PlanGroup = 'planned' | 'overdue' | 'season';
  export interface PlanItem { key: string; group: PlanGroup; title: string; spotIds: string[]; estMin: number; daysOverdue: number; ref: { kind: 'plan'; id: string } | { kind: 'care'; type: CareType } | { kind: 'spray'; courseIds: string[] } }
  export interface SaturdayPlan { saturday: ISODate; items: PlanItem[]; totalMin: number; heldCount: number; budgetMin: number }
  export function buildSaturdayPlan(i: { plans: PlanTask[]; careDue: CareDue[]; sprays: SprayDue[]; spots: Spot[]; durations: Durations; budgetMin: number; today: ISODate }): SaturdayPlan;
  export function headerText(p: SaturdayPlan): string; // 'Plan ≈ 1h 55m of 2h · 4 items held for next week'
  ```
- Packing algorithm:
  1. `saturday = upcomingSaturday(today)`.
  2. **Planned:** every open `PlanTask` with `due ≤ saturday` is included regardless of budget. `source:'user'` goes to group `planned`, `source:'prep'` goes to `season`. `estMin` is the task's.
  3. **Candidates:** each spray with due ≤ saturday at `durations.spray` each, plus each `CareDue` with `due ≤ saturday` at `durations[type][spot.type]`. Sort by `daysOverdue` relative to `saturday`, descending.
  4. Add candidates while `totalMin + est ≤ budgetMin`. Count the rest as `heldCount` (per spot).
  5. Merge the chosen candidates into display items. Sprays become one item `Spray: T-12, B-03`. Care becomes one item per type, `Fertilizer: T-04, T-07` / `Soil change: B-05`. All go in group `overdue`, using the max `daysOverdue` of the members.
  6. Item order: `planned`, then `overdue`, then `season`.
- `headerText` formats `{h}h {m}m` (omit `0h `). The budget prints as `2h`. The `· {n} items held for next week` part is omitted when `heldCount` is 0.

- [ ] **Step 1: Write failing tests:**
  - **Review Focus 3:** on Saturday `2026-11-07`, a care item due `2026-11-07` is included and `plan.saturday === '2026-11-07'`
  - planned tasks totalling 130 min with budget 120 are all included, and every care candidate is held (`heldCount` = number of candidate spots)
  - 50 fertilize-due pots (3 min each) with budget 120 → 40 included, `heldCount 10`. The most overdue are included first
  - fertilize due on T-04 and T-07 → one item titled `'Fertilizer: T-04, T-07'` with `spotIds ['T-04','T-07']`
  - `headerText` gives `'Plan ≈ 1h 55m of 2h · 4 items held for next week'` for total 115, budget 120, held 4, and `'Plan ≈ 45m of 2h'` for total 45, held 0
  - **Review Focus 2 (today.test):** a user plan due Wed `2026-11-04` that isn't done shows in `buildToday` on `2026-11-06` *and* in `buildSaturdayPlan` for `2026-11-07` group `planned`, appearing once in each
  - `buildToday` excludes done plans (`doneOn` set) and resolved problems
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: Today view and time-budgeted Saturday plan`.

---

### Task 8: Season planner

**Files:**
- Create: `src/domain/seasonPlanner.ts`
- Test: `tests/domain/seasonPlanner.test.ts`

**Interfaces:**
- Consumes: `seasonOf`, `nextSeasonStart`, `CROPS`, `cropById` (Task 4).
- Produces:
  ```ts
  export interface FreeingSpot { spotId: string; freeOn: ISODate; estimated: boolean /* true when from daysToHarvest */ }
  export function spotsFreeingUp(spots: Spot[], plants: Plant[], today: ISODate, horizonDays?: number /* default 56 */): FreeingSpot[]; // empty spots → freeOn today
  export function suggestCrops(spot: Spot, freeOn: ISODate): Crop[]; // season of freeOn, size ≥ crop.minSize; leafy first for balconyB, flowering only for balconyA
  export function prepTaskFor(crop: Crop, spot: Spot, freeOn: ISODate, seeds: Seed[], today: ISODate): PlanTask; // source 'prep'
  ```
- A spot's active plants are those with no `endedOn`. Free date = min over active plants of `expectedEnd ?? plantedOn + daysToHarvest`. A spot with no active plants is free today.
- `prepTaskFor`:
  - transplant → title `Start {name} seedlings (for {spotId})`, due `freeOn − 42`
  - direct → `Get {name} seeds (for {spotId})` if no matching seed, else `Sow {name} in {spotId}`, due `freeOn − 7`
  - sapling → `Buy {name} sapling (for {spotId})`, due `freeOn − 7`
  - due is clamped to ≥ today. estMin 15, `spotIds [spot.id]`
- Size order: small < medium < large.

- [ ] **Step 1: Write failing tests:**
  - plant tomato planted `2026-09-01`, no expectedEnd → freeOn `'2026-11-15'`, `estimated true`. With expectedEnd `2026-12-01` → `'2026-12-01'`, `estimated false`
  - an ended plant does not count, so the spot is free today
  - `suggestCrops` for a small balconyB pot freeing `2026-11-20` includes Methi and Palak, excludes Tomato (size) and Bhindi (season)
  - `prepTaskFor(tomato, T-03, '2026-12-20', [], '2026-11-04')` → title `'Start Tomato seedlings (for T-03)'`, due `'2026-11-08'`. With freeOn `'2026-11-20'` → due clamped to `'2026-11-04'`
  - methi with a matching seed in inventory → title starts with `'Sow'`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: season planner with lead-time prep tasks`.

---

### Task 9: Backup export/import

**Files:**
- Create: `src/domain/backup.ts`
- Test: `tests/domain/backup.test.ts`

**Interfaces:**
- Consumes: `getAll`, `getSettings`, `replaceAll`, `saveSettings` (Task 3).
- Produces:
  ```ts
  export interface BackupFile { app: 'garden-app'; version: 1; exportedOn: ISODate; settings: Settings; data: Record<StoreName, unknown[]> }
  export function exportBackup(today: ISODate): Promise<Blob>;           // JSON; problem photos base64-encoded as data URLs
  export function backupFileName(today: ISODate): string;               // 'garden-backup-2026-11-04.json'
  export function parseBackup(text: string): BackupFile;                 // throws Error('Not a garden backup file') on wrong shape
  export function importBackup(text: string): Promise<void>;            // parseBackup then replaceAll; decodes photos
  export function needsBackupNudge(s: Settings, today: ISODate): boolean; // no lastBackupOn and any data, or ≥30 days since
  ```
- `exportBackup` also sets `settings.lastBackupOn = today`.

- [ ] **Step 1: Write failing tests:**
  - round trip: put 2 spots and 1 log, export, wipe via `replaceAll` with empties, import, and getAll returns the same items
  - **Review Focus 5:** `importBackup('{"hello":1}')` rejects with `'Not a garden backup file'` and existing spots are unchanged. `importBackup('not json')` rejects the same way
  - `needsBackupNudge({..., lastBackupOn: '2026-10-05'}, '2026-11-04') === true` (30 days). With `'2026-10-06'` → false
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Validate `app`, `version === 1`, and that each `StoreName` key is an array.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: backup export and safe import`.

---

### Task 10: App shell, Quick add and Today screen

**Files:**
- Create: `src/ui/App.tsx` (replace), `src/ui/QuickAdd.tsx`, `src/ui/TodayScreen.tsx`, `src/ui/styles.css`, `src/ui/useGarden.ts`
- Modify: `src/main.tsx` (call `requestPersistence()`)
- Test: `tests/ui/quickadd.test.tsx`, `tests/ui/today.test.tsx`

**Interfaces:**
- Consumes: db repo (Task 3), `buildToday` (Task 7), `startCourse`/`markSprayDone` (Task 6), `allCareDue` (Task 5).
- Produces: `useGarden(): { state: GardenState; reload(): Promise<void> }` where `GardenState = { spots; plants; careRules; logs; plans; problems; courses; seeds; settings; today }`. Later screens use it.
- `App` has bottom tabs **Today · Saturday · Spots · Season** plus a gear icon for Settings, and a floating **+** button opening `QuickAdd`. It is a mobile layout matching the approved mockup (`.superpowers/brainstorm/88684-1793790543/content/screens.html`), with large tap targets (≥44px).
- QuickAdd fields: text, then kind chips **Plan / Problem seen / Done just now**, then optional spot chips (recently used first) plus a picker that also allows a free-text place, then a When control (**This Saturday** default / **Today** / date) hidden for "Done just now". Saving:
  - Plan → `PlanTask` with `due`, `source 'user'`, `estMin = durations.plan`
  - Problem seen → requires a spot, optional photo (`<input type=file accept=image/* capture=environment>`), then saves the `Problem` and a `SprayCourse` via `startCourse`. A "Start spray course" toggle defaults to on
  - Done just now → a `LogEntry` of kind chosen from chips (fertilize, soil, spray, till, prune, harvest, note)
- TodayScreen: sections *Sprays due* (each has a tick that calls `markSprayDone` and writes a `spray` log, shows `n of N` and `{k} days late`), *Planned for today* (tick sets `doneOn`), *Watching* (tap to mark resolved), and a hint line `Fertilizer/soil due on {n} spots by Sat {date}`.

- [ ] **Step 1: Write failing tests:**
  - QuickAdd: type "Pluck guavas", leave Plan and This Saturday on, then Save → `plans` store has one task with title `'Pluck guavas'` and due = upcoming Saturday
  - QuickAdd: Problem seen on T-12 → one problem and one course with `total 4`, `intervalDays 3`
  - Today: with a course due today, the screen shows `T-12` and `1 of 4`. Ticking it → the course's `doneDates` has today and the item disappears
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: all PASS. Run `npm run dev`, open it at phone width, add a plan and a problem, and confirm they appear.
- [ ] **Step 5:** Commit `feat: app shell, quick add and Today screen`.

---

### Task 11: Saturday screen

**Files:**
- Create: `src/ui/SaturdayScreen.tsx`
- Test: `tests/ui/saturday.test.tsx`

**Interfaces:**
- Consumes: `buildSaturdayPlan`, `headerText` (Task 7), `useGarden` (Task 10).
- Behaviour: show the header, then groups titled **You planned**, **Overdue**, **Get ready for the season**, then each item with its est time and `+{n} days` lateness. Items with more than one spot show `{done} of {total} done ▸` and expand into per-spot ticks. Ticking:
  - Plan spot → add to `doneSpotIds`. When all are done (or the plan has no spots and is ticked), set `doneOn = today`
  - Care spot → write a `LogEntry` (`kind = care type`, `spotId`, `date = today`). It drops out because due is recomputed
  - Spray spot → `markSprayDone` + spray log
  - The plan is recomputed after each tick, but items ticked in this session stay visible with strikethrough until the screen is left, so the list doesn't jump

- [ ] **Step 1: Write failing tests:**
  - a plan "Till pots" on T-01…T-08 shows `0 of 8 done`. Ticking T-01..T-03 shows `3 of 8 done`, and the stored `doneSpotIds` has those 3
  - ticking fertilize on T-04 writes a `fertilize` log for T-04 dated today
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: Saturday plan screen with per-spot ticks`.

---

### Task 12: Spots screens: list, add, detail, crop finished

**Files:**
- Create: `src/ui/SpotsScreen.tsx`
- Test: `tests/ui/spots.test.tsx`

**Interfaces:**
- Consumes: `nextSpotId`, `put` (Task 3), `defaultCareRules`, `careDueFor` (Task 5), `CROPS` (Task 4), `useGarden`.
- **List:** grouped by area, each row showing ID, plant names and the soonest due item.
- **Add spot** (fast path, aims for about 15 seconds): area (remembers last), type pot/bed, size S/M/L, crop picker (search over `CROPS` with up to 2 plants, plus a "nothing planted" option), planted-on (default today), then two optional rows *Last fertilized* and *Last soil change*, each with chips `This week / ~2 weeks / A month or more / Don't know` (default Don't know). Save creates the Spot with `nextSpotId`, the Plants, and the CareRules. `unknownIndex` is the count of existing spots. An **Add another** button keeps area/type/size.
- **Detail:** header `{id} · {Bed|Pot} ({size})`, area and plant names. *Next due* (fertilize, soil, `Harvest from ~{date}` per plant using `daysToHarvest`). *History* (logs for the spot, newest first, formatted `{d MMM} · {kind label} {text}`). Actions **Log something** (prefilled QuickAdd "Done just now"), **Add plant**, **Crop finished / pulled out** (pick plant, sets `endedOn = today`, writes a `crop_end` log), **Edit / delete spot** (delete asks for confirmation inline, not `window.confirm`).

- [ ] **Step 1: Write failing tests:**
  - add a terrace pot, medium, Tomato → stored spot `T-01` with 1 plant and 2 care rules
  - add a second spot with **Add another** → `T-02`, same area/type/size preselected
  - Crop finished on a leafy pot → plant `endedOn` set, a `crop_end` log is written, and the detail shows Soil change due today
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: spot setup, detail and history`.

---

### Task 13: Season, Settings and backup UI

**Files:**
- Create: `src/ui/SeasonScreen.tsx`, `src/ui/SettingsScreen.tsx`
- Test: `tests/ui/season.test.tsx`, `tests/ui/settings.test.tsx`

**Interfaces:**
- Consumes: `seasonOf`, `nextSeasonStart`, `SEASON_LABEL`, `spotsFreeingUp`, `suggestCrops`, `prepTaskFor` (Tasks 4, 8), backup functions (Task 9).
- **Season screen:** banner `Now: {season label} · {next season} starts {date} ({n} weeks)`. Then *Freeing up soon*: each spot with `free ~{date}` (`~` when estimated), suggested crop chips, and **Choose** saves `prepTaskFor(...)` into `plans`. Prep tasks only exist after the owner chooses. Then *Seeds & saplings I have*: a list with add (crop picker + seed/sapling) and remove.
- **Settings:** Saturday budget (minutes), the duration fields from `Durations`, **Back up now** (downloads via `<a download>` with `backupFileName`, then `saveSettings` with `lastBackupOn`), **Restore from backup** (`<input type=file accept=application/json>`, shows the error text on failure, confirms inline before replacing), last backup date.
- **Nudge:** when `needsBackupNudge` is true, App shows a dismissible banner on Today: `It's been a while since your last backup. Back up now` (links to Settings).

- [ ] **Step 1: Write failing tests:**
  - Season: an empty small B-spot on `2026-11-04` lists Methi. Tapping Choose → the `plans` store has a task titled `'Get Methi (fenugreek) seeds (for B-01)'` (or `Sow…` if a seed exists) with `source 'prep'`
  - Settings: restoring `{"hello":1}` shows `Not a garden backup file`, and the spots store is unchanged
  - Nudge banner is visible when `lastBackupOn` is 31 days ago and hidden at 10
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: season planner, settings and backup UI`.

---

### Task 14: PWA, offline and deploy

**Files:**
- Modify: `vite.config.ts` (add `VitePWA`), `index.html` (theme-color, title "Garden")
- Create: `public/icon-192.png`, `public/icon-512.png` (simple leaf on green, generated), `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- `VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Garden', short_name: 'Garden', display: 'standalone', start_url: '.', scope: '.', background_color: '#ffffff', theme_color: '#2e8b57', icons: [192, 512] } , workbox: { globPatterns: ['**/*.{js,css,html,png,svg}'] } })`
- Workflow: on push to `main`, run `npm ci`, `npm test` and `npm run build`, then deploy `dist/` with `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`.

- [ ] **Step 1:** Add the PWA config and icons. Run `npm run build`. Expected: `dist/manifest.webmanifest` and `dist/sw.js` exist.
- [ ] **Step 2:** Run `npx vite preview`, open in Chrome, go offline in DevTools and reload. Expected: the app loads and the data is still there.
- [ ] **Step 3:** Write `README.md` with the owner's one-time steps: create a GitHub account/repo, push, enable Pages (Source: GitHub Actions), open the URL on the Android phone in Chrome, then ⋮ → **Add to Home screen**. Also note that data lives on the phone, so back up monthly.
- [ ] **Step 4:** Add the workflow file. Run `npm test && npm run build`. Expected: pass.
- [ ] **Step 5:** Commit `feat: installable offline PWA and Pages deploy`. Pushing to GitHub needs the owner's account, so stop and hand over the README steps.
