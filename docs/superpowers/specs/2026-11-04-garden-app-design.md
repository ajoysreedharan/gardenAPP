# Garden App — Design

Date: 2026-11-04
Status: Draft, awaiting owner approval

## 1. Intent and why

The owner keeps a home garden in Pune, India:

- **Terrace**: about 50 spots growing fruits and vegetables. Roughly 40 are pots of varied sizes and 10 are beds.
- **Balcony A**: flowering plants.
- **Balcony B**: leafy vegetables.

The owner knows how to garden. What they lack is **memory and follow-through**:

- Ideas come up during the week, at work or on a walk ("pluck the guavas", "spray the chillies", "clean the corner by the tap"), and are forgotten by Saturday.
- There is no record of when each spot last had its soil changed, was fertilized or was sprayed.
- Multi-pot jobs such as "till these 8 pots" get partly done, and nobody can tell which pots are left.
- Compost goes on about once a month per plant, but fertilizing everything takes more than one Saturday, so each plant's next cycle has to be tracked on its own.
- Pest treatment (wood vinegar, every 3 days, at least 4 times) is started when a problem is noticed, then sprays are missed.
- When a bed or pot frees up, seeds or saplings usually aren't ready, and it isn't always clear what suits the season.

The owner works in the garden for **about 2 hours on Saturdays** and does a **15-minute check on other days**. They always have their **mobile phone** with them.

**Success:** on Saturday the owner opens the app and gets a 2-hour plan they trust. It contains everything they planned plus everything that's due, and nothing falls through the cracks. During the week, capturing a thought takes seconds.

## 2. Goals

1. **Quick capture** from the phone: a plan, a problem seen, or something just done. Takes a few seconds, and linking to a spot or area is optional.
2. **Per-spot history** answering "when did I last ___ here?"
3. **Per-spot recurring care** (fertilize, soil change, others), with the next due date counted from when the job was *actually* done on that spot.
4. **Spray courses**: logging a problem creates a series of N sprays, D days apart (default: wood vinegar, 4 sprays, every 3 days). Each spray appears on its day. A missed spray stays overdue and is never dropped silently.
5. **Today view** for the weekday 15-minute check, showing sprays due today or overdue, problems being watched and a light "coming up Saturday" hint.
6. **Saturday view** with a plan sized to about **2 hours** (configurable). Order: things the owner planned, then overdue care (most overdue first), then season prep. Whatever doesn't fit is held for next week and shown as a count. Each item has an estimated duration.
7. **Multi-spot tasks** (for example "till 8 pots"), each spot with its own checkbox, so progress is visible ("3 of 8 done").
8. **Season planner for Pune**. It looks ahead to spots that will free up (crop ending) and to upcoming season changes, then suggests crops that fit the season and pot size. It creates prep tasks with crop-specific lead times:
   - transplant crops raised from seed (tomato, chilli, brinjal…): start seedlings about 5–6 weeks ahead
   - direct-sown crops (spinach, methi, radish…): get seeds about 1 week ahead
   - buying a sapling: about 1 week ahead
   It checks against a simple **seeds-in-hand list**, so it only says "buy seeds" when they're needed.
9. **Rough harvest window** for a plant, based on its planting date and crop. "Pluck fruit" is otherwise a normal planned task.
10. **Backup**: a button exports all data to a file and a matching import restores it. A gentle nudge appears if there has been no backup for about 30 days.

## 3. Non-goals

- No push notifications or reminders. Everything shows when the app is opened (owner's explicit choice).
- No cloud sync, accounts or login. Data lives on the phone only (owner's explicit choice).
- No multi-user or sharing (owner: "just me for now").
- No watering schedule (not raised as a problem).
- No yield or weight tracking, cost tracking, or plant-disease diagnosis.
- No app-store app.

## 4. Anti-goals (failures even if it "works")

- Capturing a thought takes long enough that the owner doesn't bother.
- The Saturday list dumps 40 items and becomes overwhelming. It must respect the time budget.
- A spray in a course, or a planned task, silently disappears when its day passes.
- Data is lost with no backup path.
- Initial setup of about 60 spots feels like a chore that never gets finished.

## 5. Domain model (as discussed)

- **Area**: Terrace, Balcony A (flowers), Balcony B (leafy greens). Free-floating areas are allowed for tasks like "the corner by the tap".
- **Spot**: a physical pot or bed with an ID tag. Prefixes are **T-** (terrace), **A-** (flower balcony) and **B-** (leafy balcony), for example T-01…T-50. A spot has a type (pot/bed), a size (small/medium/large, or similar) and an area.
- **Plant**: what is growing in a spot. A spot usually holds **one plant** and sometimes **two together** (for example tomato with a bitter-gourd creeper). A plant has a crop, a planting date, and optionally an expected end, which feeds the season planner.
- **Care rule**: a recurring job with an interval, for example fertilize (compost) every 30 days or soil change on a longer cycle or after each crop. Defaults come from the plant type (fruit/veg, leafy, flowering) and can be overridden per spot.
- **Log entry**: something done, on a date, at a spot, plant or area. This is the history.
- **Task**: something to do. It may be one-off (a plan), generated (care due, a spray in a course, season prep) or multi-spot.
- **Problem**: something noticed at a spot, with an optional photo. It can start a spray course and stays "watching" until resolved.
- **Seed/sapling inventory**: a simple list of what the owner has on hand.

The owner is willing to physically tag every pot. Setup must be fast: add a spot, pick its size and plant, done. The terrace should be doable in one Saturday.

## 6. Screens (owner reviewed mockups and approved)

Bottom tabs: **Today · Saturday · Spots · Season**, plus a **+** button for quick add.

1. **Today**: sprays due (with course progress, "2 of 4", and lateness), problems being watched, a light hint of what's coming Saturday.
2. **Saturday**: a header such as "Plan ≈ 1h 55m of 2h · 4 items held for next week". Groups are *You planned*, *Overdue* and *Get ready for the season*. Every item can be ticked, and multi-spot items expand to per-spot ticks. Each item shows an estimated time.
3. **Spot detail**: name, type and size, plants, *Next due* list, then full history newest first.
4. **Quick add**: text, a kind (Plan / Problem seen / Done just now), an optional spot or area, and a when (This Saturday / Today / pick date). Choosing *Problem seen* offers to start a spray course.
5. **Season** (not mocked): upcoming season change, spots freeing up, suggested crops for each, and the seeds-in-hand list.

The mockup is saved at `.superpowers/brainstorm/88684-1793790543/content/screens.html`.

## 7. Constraints

- **Platform:** a web app that runs in the phone browser and can be added to the home screen (PWA). It must work offline once loaded. (Platform choice is Claude's call, accepted by the owner when proposed.)
- **Storage:** on-device only, in browser storage, with export/import of a backup file.
- **Single user**, single **Android phone (Chrome)** (owner's answer). The backup should use Android's normal download and file-picker flow, and the builder should request persistent storage so the browser doesn't evict the data.
- **Hosting:** a free static host such as GitHub Pages or Netlify, serving the app over HTTPS (owner's answer). The host only serves app code. Garden data never leaves the phone.
- **Spray courses shift:** if a spray is done late, the remaining sprays in that course are rescheduled to D days after the actual spray. Gaps stay at 3 days and the course runs longer (owner's answer).
- **Pune climate calendar**, three seasons:
  - Monsoon / kharif: June–September
  - Winter / rabi: October–February. Best season for most vegetables and leafy greens.
  - Summer: March–May. Gourds, okra and other heat-tolerant crops.
- Times, dates and wording should suit an Indian home gardener (common crop names such as methi and palak are fine).

## 8. Claude's calls (owner can override)

- Default intervals: fertilize every 30 days (owner's habit). Soil change: yearly for fruit/veg and flowering, after each crop cycle for leafy greens and beds.
- Default spray course: wood vinegar, 4 sprays, 3 days apart.
- Default task durations, such as about 3 minutes to fertilize a pot and about 20 minutes to change a bed's soil. These are editable.
- Spot IDs use the T-/A-/B- prefixes.
- Backup nudge after 30 days without a backup.
- Crop list and season data: a built-in starter list of common Pune home-garden crops with season, transplant vs direct sow, lead time, rough days-to-harvest and suitable pot sizes.
- **Starting dates at setup:** when a spot is added, one optional tap asks when it was last fertilized and last had its soil changed (this week / ~2 weeks / a month or more / don't know). Spots marked "don't know" are spread across the first few Saturdays, never all due at once.
- **Crop end and season prep:** a spot is "freeing up" when the owner sets an end date, or otherwise when planting date + days-to-harvest is reached (shown as an estimate). The owner ends a crop with a "Crop finished / pulled out" action, which logs it and triggers any "soil change after each crop" rule. The Season screen *suggests* crops. Prep tasks (start seedlings / buy seeds) are created only once the owner **chooses** a crop for a spot.
- **Weekday plans:** a plan dated for a weekday shows on Today on that date. If it isn't done, it stays on Today as overdue and is also pulled into the next Saturday's "You planned" group. Nothing is dropped.

## 9. Left to the builder

- Framework, libraries and code structure.
- Visual design, within the approved mockup layout.
- Exact Saturday packing algorithm, as long as it puts planned items first, then most overdue, respects the time budget and carries the rest forward.
- Exact storage format and backup file format.
- Photo handling (compression, size limits) for problem photos.
